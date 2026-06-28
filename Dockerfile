FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache ffmpeg

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG APP_URL
ARG AUTH_SECRET
ARG AUTH_URL
ARG DATABASE_URL
ARG NEXT_DEPLOYMENT_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ARG NEXTAUTH_URL

RUN APP_URL="$APP_URL" \
  AUTH_SECRET="$AUTH_SECRET" \
  AUTH_URL="$AUTH_URL" \
  DATABASE_URL="$DATABASE_URL" \
  HOMZIE_SKIP_DATABASE_DURING_BUILD=1 \
  NEXT_DEPLOYMENT_ID="$NEXT_DEPLOYMENT_ID" \
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" \
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY" \
  NEXTAUTH_URL="$NEXTAUTH_URL" \
  npm run build

FROM builder AS worker
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/reel-render-worker.ts"]

FROM builder AS cron
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/cron-worker.ts"]

FROM builder AS realtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV MESSAGE_SOCKET_PORT=3001

CMD ["node", "scripts/message-realtime-server.mjs"]

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]

FROM caddy:2-alpine AS caddy

COPY Caddyfile /etc/caddy/Caddyfile
