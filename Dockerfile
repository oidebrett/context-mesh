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
# Build backend
RUN npm run build -w back-end
# Build frontend
RUN npm run build -w front-end

# Prune dev dependencies to save space
RUN npm prune --omit=dev && npm cache clean --force

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

# Copy production node_modules and builds
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/back-end/package*.json ./back-end/
COPY --from=builder /app/back-end/dist ./back-end/dist
COPY --from=builder /app/back-end/prisma ./back-end/prisma
COPY --from=builder /app/back-end/src/seed_mappings.ts ./back-end/src/seed_mappings.ts
COPY --from=builder /app/front-end/package*.json ./front-end/
COPY --from=builder /app/front-end/.next ./front-end/.next
COPY --from=builder /app/front-end/public ./front-end/public
COPY --from=builder /app/front-end/next.config.js ./front-end/

# Expose ports
EXPOSE 3010 3011

# Start both services
CMD ["sh", "-c", "npx prisma generate --schema back-end/prisma/schema.prisma && npx prisma migrate deploy --schema back-end/prisma/schema.prisma && (cd back-end && npx tsx src/seed_mappings.ts || echo 'Seeding skipped or failed') && npx concurrently --raw -n back,front \"npm run start:prod -w back-end\" \"npm run start -w front-end\""]
