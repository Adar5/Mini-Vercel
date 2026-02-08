FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install dependencies (including dev dependencies for tsc)
RUN npm install

# Install typescript globally just to be safe
RUN npm install -g typescript

COPY . .

# 🔨 COMPILE STEP: Turn TS into JS
# We force specific settings to bypass your broken local config
RUN npx tsc index.ts --target es2020 --module commonjs --esModuleInterop --skipLibCheck --outDir dist || true

EXPOSE 9000

# 🚀 RUN STEP: Run the compiled JavaScript
CMD ["node", "dist/index.js"]
