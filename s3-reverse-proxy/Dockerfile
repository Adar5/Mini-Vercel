FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Install typescript globally
RUN npm install -g typescript

COPY . .

# 🔨 COMPILE STEP: TS -> CommonJS (.cjs)
RUN npx tsc index.ts --target es2020 --module commonjs --esModuleInterop --skipLibCheck --outDir dist || true     && mv dist/index.js dist/index.cjs

EXPOSE 8000

# 🚀 RUN STEP
CMD ["node", "dist/index.cjs"]
