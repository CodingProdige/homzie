# Homzie Deployment Guide

Homzie is a self-hosted, web-first Next.js application for property discovery, agent creator profiles, vertical property video, leads, and viewing bookings. It is a modular monolith: one Next.js app, one PostgreSQL database, one Redis service, one Caddy reverse proxy, and one Cloudflare Tunnel entrypoint.

This guide is written for future developers and AI coding agents. Keep deployments boring, repeatable, and protective of user-generated media.

## Production Architecture

Homzie production runs on an Ubuntu/WSL environment hosted on a Windows server.

Core infrastructure:

- Next.js 16 App Router
- PostgreSQL
- Redis
- Drizzle ORM migrations
- Auth.js
- Docker Compose
- Caddy reverse proxy
- Cloudflare Tunnel
- GitHub Actions
- Self-hosted GitHub runner
- Persistent storage on the Windows filesystem mounted into WSL

The application is self-hosted-first. Do not assume a managed platform, object storage provider, or external platform-specific deployment target unless the project explicitly adopts one later.

## Deployment Flow

The standard production flow is:

1. Push to `main`.
2. GitHub Actions runs on the self-hosted runner on the Windows server.
3. The runner installs dependencies with `npm ci`.
4. The runner checks code with `npm run lint`.
5. The runner builds the app with `npm run build`.
6. The runner runs database migrations.
7. Docker Compose rebuilds and restarts the Homzie services.

Deployment should be automated through GitHub Actions, but the same steps must remain understandable and reproducible manually on the server.

## Non-Destructive Deployment Rule

Deployments must never remove or overwrite persistent user and system data.

Never delete:

- Uploaded videos
- Uploaded media
- Generated thumbnails
- Exports
- Backups
- PostgreSQL data
- Redis data
- Docker named volumes
- Caddy state
- Cloudflare Tunnel state

Uploaded media and generated files must stay outside deployable app code. A deployment may replace application containers and build output, but it must not replace persistent storage.

## Project Paths

Local development path on Mac:

```text
/Users/dillonjurgens/Dev/homzie
```

Local storage paths inside the repo:

```text
./storage/media
./storage/videos
./storage/thumbnails
./storage/exports
./storage/backups
```

Production storage paths on the Windows server through WSL:

```text
/mnt/c/Homzie/storage/media
/mnt/c/Homzie/storage/videos
/mnt/c/Homzie/storage/thumbnails
/mnt/c/Homzie/storage/exports
/mnt/c/Homzie/storage/backups
```

Production environment file:

```text
/mnt/c/Homzie/config/homzie.env
```

Inside Docker, media should be mounted at:

```text
/data/media
```

## Docker Compose Project Names

Use separate Compose project names so local and self-hosted environments cannot accidentally share data.

Local development:

```text
homzie_dev
```

Self-hosted production:

```text
homzie_selfhost
```

Do not reuse local project names in production. Do not reuse production project names locally.

## Environment Files

Homzie uses one environment file per running environment. Do not add additional environment variants.

Do not introduce:

- `.env.example`
- `.env.local`
- `.env.production`
- `.env.selfhost`

Local development uses the root `.env` file in the project directory. Production uses the server-managed file at:

```text
/mnt/c/Homzie/config/homzie.env
```

Treat real environment files as secrets. They must not be committed.

## Local Development Environment

Local development intentionally uses PostgreSQL port `5433` and Redis port `6380` to avoid conflicts with other local projects.

Use these values in the root `.env` file for local development:

```dotenv
APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-secret

DOMAIN=homzie.co.za
ADMIN_HOSTNAME=admin.localhost
CADDY_EMAIL=admin@homzie.co.za

POSTGRES_DB=homzie
POSTGRES_USER=homzie
POSTGRES_PASSWORD=replace-with-your-local-database-password
DATABASE_URL=postgres://homzie:replace-with-your-local-database-password@localhost:5433/homzie

REDIS_URL=redis://localhost:6380

MEDIA_ROOT=./storage/media
MEDIA_STORAGE_PATH=./storage/media
VIDEO_STORAGE_PATH=./storage/videos
THUMBNAIL_STORAGE_PATH=./storage/thumbnails
EXPORT_STORAGE_PATH=./storage/exports
BACKUP_STORAGE_PATH=./storage/backups

ADMIN_EMAIL=admin@homzie.co.za
ADMIN_PASSWORD=change-me-now
ADMIN_NAME=Homzie Admin

CLOUDFLARE_TUNNEL_TOKEN=
```

Local storage directories should be created before upload or media workflows are exercised.

## Self-Hosted Production Environment

Use these values in `/mnt/c/Homzie/config/homzie.env` for production, replacing secrets with real strong values:

```dotenv
APP_URL=https://homzie.co.za
AUTH_URL=https://homzie.co.za
AUTH_SECRET=replace-with-a-long-random-production-secret

DOMAIN=homzie.co.za
ADMIN_HOSTNAME=admin.homzie.co.za
CADDY_EMAIL=admin@homzie.co.za

POSTGRES_DB=homzie
POSTGRES_USER=homzie
POSTGRES_PASSWORD=replace-with-a-strong-database-password
DATABASE_URL=postgres://homzie:replace-with-a-strong-database-password@localhost:5432/homzie

REDIS_URL=redis://localhost:6379

MEDIA_ROOT=/data/media
MEDIA_STORAGE_PATH=/mnt/c/Homzie/storage/media
VIDEO_STORAGE_PATH=/mnt/c/Homzie/storage/videos
THUMBNAIL_STORAGE_PATH=/mnt/c/Homzie/storage/thumbnails
EXPORT_STORAGE_PATH=/mnt/c/Homzie/storage/exports
BACKUP_STORAGE_PATH=/mnt/c/Homzie/storage/backups

ADMIN_EMAIL=admin@homzie.co.za
ADMIN_PASSWORD=replace-with-a-strong-admin-password
ADMIN_NAME=Homzie Admin

CLOUDFLARE_TUNNEL_TOKEN=replace-with-cloudflare-tunnel-token
```

Production containers should receive only the environment values they need. Keep the canonical production file outside the deployable app directory.

## Media Mounts

Media is first-class infrastructure in Homzie. The app is video-heavy, and uploads must survive every deployment.

Production media paths on the host:

- `/mnt/c/Homzie/storage/media`
- `/mnt/c/Homzie/storage/videos`
- `/mnt/c/Homzie/storage/thumbnails`
- `/mnt/c/Homzie/storage/exports`
- `/mnt/c/Homzie/storage/backups`

Container path for media:

- `/data/media`

Caddy should serve public media from:

```text
/media/*
```

Database records should store portable relative paths, not local machine paths or absolute URLs.

Good:

```text
videos/2026/05/abc123.mp4
thumbnails/2026/05/abc123.webp
```

Bad:

```text
/Users/dillonjurgens/Dev/homzie/storage/videos/file.mp4
http://localhost:3000/media/file.mp4
```

## GitHub Actions Runner

The self-hosted runner lives on the Windows server and executes deployment commands inside the Ubuntu/WSL environment.

Runner responsibilities:

- Check out the latest `main` branch.
- Install dependencies with `npm ci`.
- Run `npm run lint`.
- Run `npm run build`.
- Run Drizzle migrations.
- Rebuild and restart Docker Compose services for `homzie_selfhost`.

Runner responsibilities do not include cleaning persistent media directories, resetting database volumes, or pruning Compose state that belongs to Homzie production.

## Database Migrations

Drizzle migrations should run as part of deployment after a successful lint and build.

Migration rules:

- Migrations must be forward-only for normal deployment.
- Multi-step data changes should be designed to tolerate partially deployed app versions when possible.
- Destructive schema changes require a deliberate migration plan and backup.
- Migrations must not assume local storage paths.
- Migrations must not rewrite media path rows into absolute machine paths.

Before risky migrations, create or verify a recent backup under:

```text
/mnt/c/Homzie/storage/backups
```

## Caddy and Cloudflare Tunnel

Caddy is the reverse proxy for the web app and static media routes. Cloudflare Tunnel exposes the self-hosted server without requiring direct public inbound traffic.

Caddy should preserve:

- Caddy data
- Caddy config
- TLS state
- Media serving routes

Cloudflare Tunnel should preserve:

- Tunnel token
- Tunnel identity
- Tunnel service configuration

Do not recreate tunnel state during normal app deployment.

## Public Routing Expectations

Homzie is web-first. Public pages should remain crawlable and fast because SEO is part of the product.

Public app routes:

- `/`
- `/discover`
- `/for-you`
- `/search`
- `/properties`
- `/properties/[slug]`
- `/agents`
- `/agents/[username]`
- `/agents/[username]/videos`
- `/agents/[username]/listings`
- `/book-viewing/[propertyId]`

Agent dashboard routes:

- `/dashboard`
- `/dashboard/profile`
- `/dashboard/listings`
- `/dashboard/videos`
- `/dashboard/leads`
- `/dashboard/bookings`
- `/dashboard/analytics`
- `/dashboard/billing`
- `/dashboard/boosts`

Admin routes:

- `/admin`
- `/admin/agents`
- `/admin/agencies`
- `/admin/properties`
- `/admin/videos`
- `/admin/reports`
- `/admin/subscriptions`
- `/admin/boosts`

## Manual Deployment Checklist

Use this checklist when validating or reproducing a production deploy manually.

1. Confirm the runner is operating inside the correct WSL environment.
2. Confirm the production env file exists at `/mnt/c/Homzie/config/homzie.env`.
3. Confirm production storage directories exist under `/mnt/c/Homzie/storage`.
4. Confirm media is mounted into Docker at `/data/media`.
5. Pull or check out the intended `main` commit.
6. Run `npm ci`.
7. Run `npm run lint`.
8. Run `npm run build`.
9. Run database migrations.
10. Rebuild and restart Docker Compose with project name `homzie_selfhost`.
11. Confirm the web app responds at `https://homzie.co.za`.
12. Confirm admin responds at `https://admin.homzie.co.za`.
13. Confirm `/media/*` routes still serve existing media.
14. Confirm PostgreSQL and Redis data survived the restart.
15. Confirm Cloudflare Tunnel is connected.

## Rollback Guidance

Rollback should prefer redeploying a known-good app commit while preserving current data.

Safe rollback actions:

- Rebuild the app container from an earlier known-good commit.
- Restart Caddy without deleting Caddy state.
- Restart the Cloudflare Tunnel without recreating tunnel identity.
- Restore database from a deliberate backup only when the data impact is understood.

Unsafe rollback actions:

- Removing storage directories.
- Removing Docker named volumes.
- Recreating PostgreSQL from scratch.
- Rewriting media paths to local development paths.
- Deleting generated thumbnails or uploaded videos to make a deploy pass.

## Operational Priorities

For deployment decisions, prioritize in this order:

1. Preserve user media and production data.
2. Preserve authentication and access control.
3. Keep public property and agent pages crawlable.
4. Keep media delivery stable.
5. Keep the deployment process simple enough to debug on the server.

Homzie should feel modern, media-rich, and reliable, but the deployment system should stay intentionally plain.
