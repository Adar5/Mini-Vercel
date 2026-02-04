# 1. Start with a fresh Linux machine that has Node.js v22 installed
FROM node:22-alpine

# 2. Install Git (Alpine Linux doesn't have it by default)
RUN apk add --no-cache git

# 3. Create a folder inside the container to work in
WORKDIR /app

# 4. Copy your package.json and install YOUR script's dependencies
COPY package*.json ./
RUN npm install

# 5. Copy your source code (main.ts) into the container
COPY . .

# 6. Run your worker
# We use "npx tsx" to run the TypeScript file directly
CMD ["npx", "tsx", "main.ts"]