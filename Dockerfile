# syntax=docker/dockerfile:1

# ==========================================
# Base Stage
# ==========================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ==========================================
# Dependencies Stage
# ==========================================
FROM base AS deps
WORKDIR /app

# Install build dependencies if needed
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all dependencies (including devDependencies required for build & type checking)
RUN npm ci

# ==========================================
# Builder Stage
# ==========================================
FROM base AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/slotbook?schema=public"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js production application
RUN npm run build

# ==========================================
# Production Runner Stage
# Shared by Web Service and Background Worker
# ==========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy runtime artifacts from builder and deps
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Ensure nextjs user owns runtime working directory
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Default CMD runs the Next.js web application
# For Worker service, override start command with: npm run worker
CMD ["npm", "run", "start"]

