# Stage 1: Base
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Stage 2: Builder
FROM base AS builder

# Build arguments for Next.js public environment variables
# These are baked into the frontend bundle at build time
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3010
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY package*.json ./
COPY back-end/package*.json ./back-end/
COPY front-end/package*.json ./front-end/
RUN npm install

COPY . .
# Generate Prisma client
RUN cd back-end && npx prisma generate
# Build backend
RUN npm run build -w back-end
# Build frontend with standalone output
RUN npm run build -w front-end

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

# Copy EVERYTHING from builder to ensure all workspace links and modules are preserved
COPY --from=builder /app ./

# Expose ports
EXPOSE 3010 3011

# Start both services using the workspace-aware scripts
# We run prisma generate, migrate deploy, and seed mappings in the runner. Seeding is non-blocking.
CMD ["sh", "-c", "npx prisma generate --schema back-end/prisma/schema.prisma && npx prisma migrate deploy --schema back-end/prisma/schema.prisma && (cd back-end && npx tsx src/seed_mappings.ts || echo 'Seeding skipped or failed') && cd .. && npx concurrently --raw -n back,front \"npm run start:prod -w back-end\" \"npm run start -w front-end\""]
