FROM node:20-slim

WORKDIR /app

# Install OpenSSL 3.x — required by Prisma query engine on Debian Bookworm
RUN apt-get update -y && \
    apt-get install -y openssl libssl-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and generate client (uses debian-openssl-3.0.x binary)
COPY prisma ./prisma
RUN npx prisma generate

# Copy source
COPY src ./src

# Create uploads and public dirs (generated at runtime)
RUN mkdir -p uploads public/qr

EXPOSE 4000

# Push schema to DB, seed, then start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node prisma/seed.js && node src/index.js"]
