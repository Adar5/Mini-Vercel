# Stage 1: Build the app
FROM node:20-slim AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# INCREASE TIMEOUTS & INSTALL (More robust than 'ci')
RUN npm config set fetch-retry-maxtimeout 600000 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm install

COPY . .
RUN npm run build

# Stage 2: Run the app
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
