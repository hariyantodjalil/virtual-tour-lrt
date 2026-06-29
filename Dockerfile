FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://virtualtour:virtualtour@localhost:5432/virtual_tour_lrt?schema=public
ENV NEXTAUTH_SECRET=build-secret
ENV S3_ENDPOINT=http://127.0.0.1:9000
ENV S3_ACCESS_KEY_ID=build
ENV S3_SECRET_ACCESS_KEY=build
ENV S3_REGION=us-east-1
ENV S3_BUCKET=virtual-tour-lrt
RUN npm run db:generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init openssl wget

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/package-lock.json ./package-lock.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=5 --start-period=20s \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["dumb-init", "npm", "run", "start"]
