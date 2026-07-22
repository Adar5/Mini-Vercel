import { createClient } from "redis";
import { simpleGit } from "simple-git";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import util from "util";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";

const execPromise = util.promisify(exec);

// Initialize Redis Client
const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (err) => console.log("Redis Client Error", err));


// Configure S3 Client for Oracle Cloud Compatibility
const s3Client = new S3Client({
  region: process.env.ORC_REGION || "us-east-1",
  endpoint: process.env.ORC_ENDPOINT_URL!, 
  forcePathStyle: true, 
  credentials: {
    accessKeyId: process.env.ORC_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.ORC_SECRET_ACCESS_KEY || "",
  },
});

// Helper to push logs to Redis Pub/Sub
async function publishLog(projectId: string, message: string) {
  console.log(message);
  await redis.publish(`logs:${projectId}`, message);
}

// Recursive function to gather all compiled asset paths
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });
  return arrayOfFiles;
}

async function main() {
  await redis.connect();
  console.log("👷 Build Server Ready. Waiting for jobs...");

  while (true) {
    const res = await redis.brPop("build-queue", 0);
    if (!res) continue;

    const job = JSON.parse(res.element);
    const repoUrl = job.repoUrl;
    const projectId = job.projectId;

    await publishLog(projectId, `🚀 Picked up job: ${projectId}`);
    
    const outputDir = path.join(process.cwd(), "output", projectId);
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    try {
      // 1. Clone repository
      await publishLog(projectId, `Cloning ${repoUrl}...`);
      await simpleGit().clone(repoUrl, outputDir);
      await publishLog(projectId, `✅ Cloned successfully!`);

      // 2. Install dependencies
      await publishLog(projectId, "📦 Installing dependencies...");
      await execPromise(`npm install`, { cwd: outputDir });

      // 3. Build project
      await publishLog(projectId, "🔨 Building project...");
      await execPromise(`npm run build`, {
        cwd: outputDir,
        env: { ...process.env, NODE_OPTIONS: "--openssl-legacy-provider" },
      });
      await publishLog(projectId, `🎉 BUILD COMPLETE! Starting upload...`);

      // 4. Locate compiled output folder ('dist' or 'build')
      let buildFolder = path.join(outputDir, "dist");
      if (!fs.existsSync(buildFolder)) {
        buildFolder = path.join(outputDir, "build");
      }

      if (!fs.existsSync(buildFolder)) {
        throw new Error("Build directory ('dist' or 'build') not found.");
      }

      // 5. Upload files to Object Storage
      const distFiles = getAllFiles(buildFolder);
      const bucketName = process.env.ORC_BUCKET_NAME || process.env.AWS_BUCKET_NAME;

      for (const file of distFiles) {
        const contentType = mime.lookup(file) || "application/octet-stream";
        const relativePath = path.relative(buildFolder, file);

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: `dist/${projectId}/${relativePath}`,
          Body: fs.createReadStream(file),
          ContentType: contentType,
        });

        await s3Client.send(command);
        console.log(`Uploaded: ${relativePath}`);
      }

      await publishLog(projectId, `✅ DEPLOYMENT SUCCESS: ${projectId} uploaded successfully!`);
    } catch (err: any) {
      console.error("❌ Error:", err);
      await publishLog(projectId, `❌ Error: ${err.message || "Build Failed"}`);
    }
  }
}

main();