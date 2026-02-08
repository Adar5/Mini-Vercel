FROM node:18-alpine

# ⚠️ FIX: Install Git (Alpine doesn't have it by default)
RUN apk add --no-cache git

WORKDIR /app

COPY package*.json ./

RUN npm install

# Install typescript globally
RUN npm install -g typescript

COPY . .

# 🔨 COMPILE STEP: TS -> CommonJS (.cjs)
RUN npx tsc main.ts --target es2020 --module commonjs --esModuleInterop --skipLibCheck --outDir dist || true     && mv dist/main.js dist/main.cjs

# ⚠️ FIX: Ensure the script is executable
RUN chmod +x main.sh || true

CMD ["node", "dist/main.cjs"]
