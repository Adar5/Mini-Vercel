import express from 'express';
const { generateSlug } = require('random-word-slugs');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const http = require('http');
const cors = require('cors');

const app = express();
const PORT = 9000;
const server = http.createServer(app);

// 1. Allow Socket.io connections from anywhere
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const publisher = new Redis(process.env.REDIS_URL || '');
const subscriber = new Redis(process.env.REDIS_URL || '');

// 2. Allow API Requests (Axios) from anywhere
app.use(cors()); 
app.use(express.json());

io.on('connection', (socket) => {
    socket.on('subscribe', (channel) => {
        socket.join(channel);
        socket.emit('message', `Joined channel: ${channel}`);
    });
});

subscriber.on('connect', () => {
    console.log('✅ Connected to Redis (Subscriber)');
});

subscriber.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err);
});

// Subscribe to the channel
subscriber.psubscribe('logs:*', (err, count) => {
    if (err) console.error('❌ Failed to subscribe:', err);
    else console.log(`📢 Subscribed to ${count} channels. Listening for updates...`);
});

// Log EVERY message received from the Worker
subscriber.on('pmessage', (pattern, channel, message) => {
    console.log(`📨 Received from Worker: [${channel}] -> ${message}`); 
    io.to(channel).emit('message', message);
});

// --- NEW: Helper to extract "owner/repo" from a GitHub URL ---
function parseGitHubUrl(url) {
    if (!url) return null;
    const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
    const parts = cleaned.split('/');
    if (parts.length < 2) return null;
    return {
        owner: parts[parts.length - 2],
        repo: parts[parts.length - 1]
    };
}

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body;

    if (!gitURL) {
        return res.status(400).json({ error: "gitURL is required" });
    }

    // 1. Create a predictable Redis key using the GitHub URL
    const redisKey = `repo:${gitURL}`;

    // 2. Check if this repository has been deployed before
    const existingSlug = await publisher.get(redisKey);
    let projectSlug;

    if (existingSlug) {
        // 3a. If found, reuse the existing subdomain
        projectSlug = existingSlug;
        console.log(`Re-deploying existing project: ${projectSlug}`);
    } else {
        // 3b. If not found, use the provided slug or generate a new one
        projectSlug = slug ? slug : generateSlug();
        
        // 4. Save this new mapping to Redis for all future deployments
        await publisher.set(redisKey, projectSlug);
        console.log(`Creating new project mapping: ${projectSlug}`);
    }

    // --- NEW: GIT COMMIT CHECK ---
    try {
        const parsed = parseGitHubUrl(gitURL);
        if (parsed) {
            const { owner, repo } = parsed;
            
            // Fetch latest commit metadata from GitHub API
            const githubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits`, {
                headers: { 'User-Agent': 'Mini-Vercel-App' }
            });

            if (githubRes.ok) {
                const commitData = await githubRes.json();
                const latestCommitHash = commitData[0].sha; // Get the most recent commit SHA
                
                const commitKey = `commit:${projectSlug}`;
                const lastDeployedCommit = await publisher.get(commitKey);

                // If the commit hasn't changed, skip the build entirely
                if (lastDeployedCommit && lastDeployedCommit === latestCommitHash) {
                    console.log(`⚡ No changes detected for ${projectSlug} (${latestCommitHash.substring(0, 7)}). Skipping build.`);
                    return res.json({
                        status: 'skipped',
                        message: 'Repository is already up to date with the latest commit.',
                        data: {
                            projectSlug,
                            url: `https://${projectSlug}.gitlift.in`,
                            commit: latestCommitHash
                        }
                    });
                }

                // Save the new commit hash in Redis for the next deployment
                await publisher.set(commitKey, latestCommitHash);
            }
        }
    } catch (error) {
        console.warn('⚠️ Git commit check failed, defaulting to full build:', error.message);
    }
    // -----------------------------

    console.log(`Queuing Job: ${projectSlug}`);

    // Push to the build queue as usual
    await publisher.lpush('build-queue', JSON.stringify({
        projectId: projectSlug, 
        repoUrl: gitURL 
    }));

    return res.json({ 
        status: 'queued', 
        data: { 
            projectSlug, 
            url: `https://${projectSlug}.gitlift.in` 
        } 
    });
});

app.get('/', (req, res) => {
    res.json({ message: "My Mini-Vercel is LIVE!" })
});

server.listen(PORT, () => {
    console.log(`🚀 API Server + Socket.io running on Port ${PORT}`);
});