# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install pnpm and ffmpeg
RUN npm install -g pnpm
RUN apk add --no-cache ffmpeg

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code and prisma schema
COPY . .

EXPOSE 5000

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm run build

# Start the application
CMD ["pnpm", "run", "start:dev"]