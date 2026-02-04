import 'dotenv/config'
import process = require('process');
const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = 8000;

// 👇 PASTE THE ID OF THE PROJECT YOU WANT TO SEE ON YOUR PHONE 👇
const BASE_PROJECT_ID = 'acidic-greasy-salesclerk';

const s3 = new S3Client({
    region: 'us-east-1',
    credentials: {
       accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

app.use(async (req, res) => {
    const hostname = req.hostname;
    let subdomain = hostname.split('.')[0];

    // 🔧 PHONE FIX: 
    // If coming from Ngrok (random URL), force it to use your Project ID
    if (subdomain.includes('ngrok') || subdomain === 'localhost') {
        console.log(`⚠️ Ngrok/Localhost detected. Serving Project: ${BASE_PROJECT_ID}`);
        subdomain = BASE_PROJECT_ID;
    }

    // 1. Get the requested URL
    let url = req.url;

    // 2. Strip "/calculator" from the path if it exists
    if (url.startsWith('/calculator')) {
        url = url.replace(/^\/calculator/, '');
    }

    // 3. Handle Root Request
    if (url === '/' || url === '') {
        url = '/index.html';
    }

    // 4. Remove leading slash to make a valid S3 Key
    const s3FilePath = url.startsWith('/') ? url.slice(1) : url;
    
    const key = `dist/${subdomain}/${s3FilePath}`;

    console.log(`🔎 Requesting: ${key}`);

    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const response = await s3.send(command);
        
        if (response.ContentType) {
            res.setHeader('Content-Type', response.ContentType);
        }

        response.Body.pipe(res);

    } catch (error) {
        console.error(`❌ S3 Error for ${key}: File not found`);
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, () => {
    console.log(`Reverse Proxy Running on port ${PORT}`);
});











