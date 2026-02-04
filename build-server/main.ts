import { createClient } from "redis";
import { simpleGit } from "simple-git";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import util from "util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";

const execPromise = util.promisify(exec);

const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
    }
});

redis.on('error', (err) => console.log('Redis Client Error', err));

// --- HELPER: Send logs to Redis Pub/Sub ---
async function publishLog(projectId: string, message: string) {
    console.log(message); // Print to Docker Console
    await redis.publish(`logs:${projectId}`, message); // Shout to API Server
}

async function main() {
    await redis.connect();
    console.log("👷 Build Server Ready. Waiting for jobs...");

    while (1) {
        const res = await redis.brPop("build-queue", 0);
        if (!res) continue;

        const job = JSON.parse(res.element);
        const repoUrl = job.repoUrl;
        const projectId = job.projectId;

        // Notify: Started
        await publishLog(projectId, `🚀 Picked up job: ${projectId}`);
        
        const outputDir = path.join(process.cwd(), "output", projectId);
        
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }

        await publishLog(projectId, `Cloning ${repoUrl}...`);

        try {
            await simpleGit().clone(repoUrl, outputDir);
            await publishLog(projectId, `✅ Cloned successfully!`);

            await publishLog(projectId, "📦 Installing dependencies...");
            await execPromise(`npm install`, { cwd: outputDir });
            
            await publishLog(projectId, "🔨 Building project...");
            await execPromise(`npm run build`, { 
                cwd: outputDir, 
                env: { ...process.env, NODE_OPTIONS: '--openssl-legacy-provider' } 
            });
            
            await publishLog(projectId, `🎉 BUILD COMPLETE! Starting S3 Upload...`);

            const buildFolder = path.join(outputDir, "build");
            const distFiles = getAllFiles(buildFolder);

            for (const file of distFiles) {
                const contentType = mime.lookup(file) || "application/octet-stream";
                const relativePath = path.relative(buildFolder, file); 
                
                const command = new PutObjectCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `dist/${projectId}/${relativePath}`,
                    Body: fs.createReadStream(file),
                    ContentType: contentType
                });

                await s3Client.send(command);
                // Optional: Don't spam logs for every single file, maybe just major milestones
                console.log(`uploaded ${relativePath}`); 
            }

            await publishLog(projectId, `✅ DEPLOYMENT SUCCESS: ${projectId} uploaded to S3!`);
            
        } catch (err) {
            console.error("❌ Error:", err);
            await publishLog(projectId, `❌ Error: Build Failed`);
        }
    }
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            arrayOfFiles.push(path.join(dirPath, "/", file));
        }
    });
    return arrayOfFiles;
}

main();