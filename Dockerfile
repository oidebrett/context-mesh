# Stage 1: Base
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Stage 2: Builder
FROM base AS builder
# Build arguments for Next.js
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3010
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY package*.json ./
COPY back-end/package*.json ./back-end/
COPY front-end/package*.json ./front-end/
RUN npm install

COPY . .
# Generate Prisma client
RUN cd back-end && npx prisma generate
# Build backend and frontend
RUN npm run build -w back-end
RUN npm run build -w front-end

# Prune dev dependencies and clean cache to save space BEFORE copying
RUN npm prune --omit=dev && npm cache clean --force

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

# Copy the entire pruned app to preserve workspace links and production node_modules
# This is much safer than selective copying for complex monorepos
COPY --from=builder /app ./

# Expose ports
EXPOSE 3010 3011

# Start both services
# Note: Using Compiled JS for seeding and start:prod scripts
CMD ["sh", "-c", "npx prisma generate --schema back-end/prisma/schema.prisma && npx prisma migrate deploy --schema back-end/prisma/schema.prisma && (node back-end/dist/seed_mappings.js || echo 'Seeding failed') && npx concurrently --raw -n back,front \"npm run start:prod -w back-end\" \"npm run start -w front-end\""]
