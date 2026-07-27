# 🚀 Mini-Vercel (GitLift)

A custom, containerized Platform as a Service (PaaS) inspired by Vercel. 

This project was built to understand the internal mechanics of automated cloud deployments and to solve common frustrations associated with serverless architectures, specifically **cold starts** and **API execution timeouts**. By utilizing a fully containerized environment, this platform ensures persistent execution states and gives developers more control over their deployment infrastructure.

## 💡 Motivation

While serverless platforms like Vercel offer incredible developer experience, they come with constraints on their free tiers, such as 10-second execution limits for serverless functions and noticeable cold starts for low-traffic applications. 

I built this platform to bypass these limitations by deploying applications into persistent Docker containers. Originally architected on AWS, the infrastructure was successfully transitioned to Oracle Cloud to optimize resource allocation and hosting costs, while maintaining a robust reverse proxy routing system.

## ✨ Key Features

* **Automated Deployments:** Paste a public GitHub repository URL, and the platform handles the cloning, dependency installation, and building processes automatically.
* **Intelligent Build Caching:** The pipeline queries the GitHub API to check the latest commit hash. If no new commits are detected, it instantly bypasses the build process and fast-forwards to the existing deployment, saving compute resources.
* **Real-Time Log Streaming:** Integrated WebSockets provide live, streaming deployment logs directly to the frontend UI so users can monitor their build progress.
* **Dynamic Subdomain Routing:** Automatically assigns a unique project slug and dynamically maps it to the deployed container (e.g., `project-name.gitlift.in`) using a customized Nginx reverse proxy.
* **Persistent Execution:** Containerized environments eliminate serverless cold starts and execution timeouts, ensuring APIs and heavy computational tasks run without arbitrary platform interruptions.

## 🏗️ Architecture & Tech Stack

**Frontend:**
* Next.js & React
* Tailwind CSS
* Socket.io-client (for real-time build logs)

**Backend & API Pipeline:**
* Node.js & Express
* Redis (for build queues and project state management)
* Socket.io (for emitting build events)
* Docker (for containerizing the build-worker and the deployed applications)

**Infrastructure & Networking:**
* Oracle Cloud Infrastructure (OCI)
* Nginx (Reverse Proxy for handling wildcard subdomains and API routing)
* Cloudflare (DNS management and SSL/HTTPS termination)

## ⚙️ How It Works

1. **Request:** The user submits a GitHub repository URL via the Next.js frontend.
2. **State Check:** The API server checks Redis to see if the repository has been deployed before. It compares the latest GitHub commit hash with the currently deployed hash. 
3. **Queue / Skip:** 
   * If the hashes match, the build is skipped, and the existing URL is instantly returned.
   * If there are changes, the job is pushed to a Redis build queue.
4. **Build Phase:** A Dockerized worker picks up the job, clones the repository, installs dependencies, and builds the application.
5. **Routing:** Once the build is successful, Nginx routes incoming traffic from the custom subdomain to the specific port of the newly deployed container.
6. **Live Feedback:** Throughout the process, the worker emits logs via WebSockets back to the user's browser.

   <img width="710" height="518" alt="Screenshot 2026-07-27 at 2 37 59 PM" src="https://github.com/user-attachments/assets/19479fde-9232-4eaa-95b9-f9d7a8cd65b8" />


## 🚀 Lessons Learned

* **Infrastructure Migration:** Successfully migrating the deployment architecture from AWS (S3/EC2) to Oracle Cloud, managing networking rules, and adapting the pipeline for a new cloud provider.
* **Advanced Nginx Configurations:** Managing exact-match blocks for API traffic vs. wildcard blocks for dynamic subdomains to prevent routing conflicts.
* **Docker Layer Caching:** Optimizing Dockerfiles to drastically reduce build times by caching `node_modules` and utilizing multi-stage builds.
* **State Management:** Using Redis not just as a message queue, but as a reliable state store to map GitHub repositories to consistent project slugs and track commit history.
