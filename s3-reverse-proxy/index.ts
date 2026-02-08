import 'dotenv/config'
import express from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const app = express();
const PORT = 8000;

const s3 = new S3Client({
    region: 'us-east-1',
    credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
       secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
    }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

app.use(async (req, res) => {
    const hostname = req.hostname;
    let subdomain = hostname.split('.')[0];

    if (subdomain === 'localhost') {
        subdomain = 'rich-round-computer';
    }

    let url = req.url;
    console.log(`🔹 INCOMING URL: ${url}`); // Debug Log

    // ⚠️ FORCE REMOVE /calculator
    if (url.includes('/calculator')) {
        url = url.replace('/calculator', '');
        console.log(`🔸 FIXED URL: ${url}`); // Debug Log
    }

    if (url === '/' || url === '') {
        url = '/index.html';
    }

    const s3FilePath = url.startsWith('/') ? url.slice(1) : url;
    const key = `dist/${subdomain}/${s3FilePath}`;

    console.log(`🔎 Requesting S3 Key: ${key}`);

    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const response = await s3.send(command);
        
        if (response.ContentType) {
            res.setHeader('Content-Type', response.ContentType);
        }

        if (response.Body instanceof Readable) {
             response.Body.pipe(res);
        } else {
             const bytes = await response.Body?.transformToByteArray();
             res.send(Buffer.from(bytes));
        }

    } catch (error) {
        console.error(`❌ S3 Error for ${key}: File not found`);
        res.status(404).send('File not found');
    }
});

app.listen(PORT, () => {
    console.log(`Reverse Proxy Running on port ${PORT}`);
});
