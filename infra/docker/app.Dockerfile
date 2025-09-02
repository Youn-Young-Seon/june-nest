# Stage 1: Builder
FROM node:20-alpine AS builder

# Install pnpm and ffmpeg
RUN npm install -g pnpm
RUN apk add --no-cache ffmpeg

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code and prisma schema
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm run build

# Stage 2: Runner
FROM node:20-alpine

# Install ffmpeg system dependency
RUN apk add --no-cache ffmpeg

WORKDIR /usr/src/app

# Copy artifacts from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
# Copy package.json to be able to run pnpm commands
COPY --from=builder /usr/src/app/package.json ./

# Set node environment to production
ENV NODE_ENV=production

# Expose the application port 
EXPOSE 5000

# Start the application
CMD ["node", "dist/main.js"]