# 1. Use Node.js v22 (Same as your build server)
FROM node:22-alpine

# 2. Create app directory
WORKDIR /app

# 3. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 4. Copy the rest of the code
COPY . .

# 5. Open port 8000 (Crucial for the proxy to work)
EXPOSE 8000

# 6. Run the proxy
CMD ["npx", "tsx", "index.ts"]