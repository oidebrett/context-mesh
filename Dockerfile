# Stage 1: Base
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Stage 2: Builder
FROM base AS builder
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
# We run prisma generate in the runner to ensure the client is correctly initialized
CMD ["sh", "-c", "npx prisma generate --schema back-end/prisma/schema.prisma && npx concurrently -n back,front \"npm run start:prod -w back-end\" \"npm run start -w front-end\""]
