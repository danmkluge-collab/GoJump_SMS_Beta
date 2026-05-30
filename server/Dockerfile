FROM node:20-slim

WORKDIR /app

# Install OpenSSL — required by Prisma's query engine
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY src ./src

# Create uploads and public dirs (generated at runtime)
RUN mkdir -p uploads public/qr

EXPOSE 4000

# Push schema to DB, seed, then start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node src/index.js"]
