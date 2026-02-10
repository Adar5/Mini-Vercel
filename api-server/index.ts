import express from 'express';
const { generateSlug } = require('random-word-slugs');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const http = require('http');
const cors = require('cors'); // <--- NEW IMPORT

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

// 2. Allow API Requests (Axios) from anywhere <--- THIS WAS MISSING
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

// 2. Subscribe to the channel
subscriber.psubscribe('logs:*', (err, count) => {
    if (err) console.error('❌ Failed to subscribe:', err);
    else console.log(`📢 Subscribed to ${count} channels. Listening for updates...`);
});

// 3. Log EVERY message received from the Worker
subscriber.on('pmessage', (pattern, channel, message) => {
    console.log(`📨 Received from Worker: [${channel}] -> ${message}`); // <--- THIS IS KEY
    io.to(channel).emit('message', message);
});

app.post('/project', async (req, res) => {
    const { gitURL, slug } = req.body;
    const projectSlug = slug ? slug : generateSlug();

    console.log(`Received Job: ${projectSlug}`);


    // FIX: Use the EXACT names the Worker expects (projectId, repoUrl)
    await publisher.lpush('build-queue', JSON.stringify({
        projectId: projectSlug,  // Worker wants 'projectId'
        repoUrl: gitURL          // Worker wants 'repoUrl'
    }));

    return res.json({ 
        status: 'queued', 
        data: { 
            projectSlug, 
            url: `http://${projectSlug}.localhost:8000` 
        } 
    });
});
app.get('/', (req, res) => {
    res.json({ message: "My Mini-Vercel is LIVE on AWS!" })
});

server.listen(PORT, () => {
    console.log(`🚀 API Server + Socket.io running on Port ${PORT}`);
});