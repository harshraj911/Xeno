FROM node:20

# The full node:20 image already includes openssl and build tools.

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY src ./src/

# Create logs dir
RUN mkdir -p logs

EXPOSE 4000

# Sync database and start
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node src/index.js"]
