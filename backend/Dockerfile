FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install

# Copy prisma schema
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy prisma schema and generated client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy built files
COPY --from=builder /app/dist ./dist

EXPOSE 3001

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
