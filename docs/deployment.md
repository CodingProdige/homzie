# Homzie Deployment Guide

Homzie is a self-hosted, web-first Next.js application for property discovery, agent creator profiles, vertical property video, leads, and viewing bookings. It is a modular monolith: one Next.js app, one PostgreSQL database, one Redis service, one Caddy reverse proxy, and one Cloudflare Tunnel entrypoint.

This guide is written for future developers and AI coding agents. Keep deployments boring, repeatable, and protective of user-generated media.

## Linux VPS deployment (Domains.co.za)

### Verified deployment: 18 November 2026

- Public site: `https://homzie.co.za`; `www` redirects to it.
- Origin: `41.222.38.130`, Ubuntu 24.04 LTS, 1 vCPU, 2 GB RAM, 4 GB swap.
- Source: `/srv/homzie/app`; Compose project: `homzie_vps`.
- Private configuration: `/srv/homzie/config/homzie.env` (mode `600`).
- Restored source: 9 accounts and 2 listings, including 1 published listing; the recovered database contains no reels.
- Original database archive remains at `/srv/homzie/config/homzie-source.dump`. Pre-restore and pre-migration snapshots are under `/srv/homzie/storage/backups`.
- Cloudflare nameservers: `nena.ns.cloudflare.com` and `thaddeus.ns.cloudflare.com`. Web records are DNS only; existing mail records were preserved.
- Checked public HTTPS, canonical redirects, admin credentials/session, public pages, messaging transport, media byte ranges, and media persistence across a web restart. Scheduled broadcasts remain opt-in.

Use `docker-compose.vps.yml` **on its own**, not as an override of the Windows/WSL configuration. It runs PostgreSQL, Redis, Next.js, the reel worker, realtime messaging, and Caddy with direct HTTPS. It does not require Cloudflare Tunnel, cPanel, or a self-hosted GitHub runner. The older Windows deployment below remains available.

For a small buyer demo, use Ubuntu 24.04 LTS. A practical starting point is 4 vCPU / 8 GB RAM when building images and processing video on the same server; this is a sizing estimate, not a measured minimum. Keep enough disk for the database, uploaded media, Docker builds, and backups.

### Prepare the server and DNS

1. Establish SSH access, then install Docker Engine, Buildx, and the Compose plugin using [Docker's Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/). Install Node.js 22 or newer for the deployment script, plus Git/rsync for transferring source and media.
2. Keep the active SSH port allowed. Allow inbound TCP 80 and 443, plus optional UDP 443 for HTTP/3. PostgreSQL, Redis, the web app, and realtime have no published host ports in this configuration. Docker-published ports can bypass UFW; use the provider firewall or Docker-aware rules for additional restrictions.
3. Point the chosen hostname's A record to the VPS IPv4 address, and its `www` hostname to the same server (an A record or CNAME). Caddy redirects `www` to the chosen hostname. Add an AAAA record only if IPv6 reaches this VPS. Replace an old tunnel CNAME for those hostnames if necessary; preserve unrelated email/DNS records. For the first certificate, use DNS-only records if Cloudflare is the DNS provider.
4. Check that no other web server owns ports 80/443. Caddy obtains and renews certificates after DNS resolves and those ports are reachable; see [Caddy's HTTPS requirements](https://caddyserver.com/docs/automatic-https).
5. Put the application source at `/srv/homzie/app`, excluding `.env*`, `node_modules`, `.next`, and `storage`. Upload persistent media separately. Use the current working tree if it contains deployment changes that have not been committed yet.

On a fresh server, create the storage directories (commands below assume an administrator shell):

```sh
install -d -m 700 /srv/homzie/config
install -d -o 1001 -g 1001 -m 755 /srv/homzie/storage/{media,videos,thumbnails,exports,backups}
install -d -o 1001 -g 1001 -m 755 /srv/homzie/storage/media/{videos,thumbnails,exports,backups}
```

Copy each existing storage directory to its corresponding server directory without deleting existing files. The web container writes as UID 1001, so copied media and directories must remain writable by that UID. Keep database dumps outside `storage/media`, which Caddy serves publicly. Do not copy a running PostgreSQL data directory; use a logical database backup.

### Create the one server-managed environment file

Create `/srv/homzie/config/homzie.env` with mode `600`. This is the only environment file for the VPS; do not commit it or copy the development `.env` wholesale. Start with:

```dotenv
HOMZIE_ENV_FILE=/srv/homzie/config/homzie.env
HOMZIE_STORAGE_ROOT=/srv/homzie/storage
HOMZIE_BUILD_NODE_OPTIONS=--max-old-space-size=1536
DOMAIN=demo.your-domain.co.za
CADDY_EMAIL=you@your-domain.co.za
APP_URL=https://demo.your-domain.co.za
AUTH_URL=https://demo.your-domain.co.za
NEXTAUTH_URL=https://demo.your-domain.co.za
NEXT_PUBLIC_SITE_URL=https://demo.your-domain.co.za
AUTH_SECRET=replace-with-a-generated-secret

POSTGRES_DB=homzie
POSTGRES_USER=homzie
POSTGRES_PASSWORD=replace-with-a-generated-database-password
DATABASE_URL=postgres://homzie:replace-with-a-generated-database-password@postgres:5432/homzie
REDIS_URL=redis://redis:6379

ADMIN_EMAIL=you@your-domain.co.za
ADMIN_NAME=Homzie Admin
ADMIN_PASSWORD=replace-with-a-generated-admin-password
```

Generate separate values with `openssl rand -hex 32` for the auth secret, database password, and admin password. Use the same database password in `POSTGRES_PASSWORD` and `DATABASE_URL`. Hex avoids URL-encoding issues. Retain the existing PostgreSQL password when reusing an already initialized VPS volume; changing the environment file alone does not change the database user's password.

Add the integration settings needed for the demo from the existing secure configuration. Email/password login does not require Google OAuth. Google login needs the new `/api/auth/callback/google` redirect URI; Google Maps needs the new hostname allowed on its browser key. Browser-facing `NEXT_PUBLIC_*` settings are fixed at build time, so changing them requires rebuilding. Check the active Stripe mode in admin settings before exercising checkout: database settings can override environment values.

```sh
chmod 600 /srv/homzie/config/homzie.env
cd /srv/homzie/app
export HOMZIE_ENV_FILE=/srv/homzie/config/homzie.env
vps() { docker compose --env-file "$HOMZIE_ENV_FILE" -f docker-compose.vps.yml -p homzie_vps "$@"; }
```

### Restore data or start fresh, then deploy

If an old database dump is available, restore it into the **new, empty** VPS database before deploying. Verify its origin and keep the original backup. Do not restore over a database with data you need to preserve. Source media and the database should come from the same installation.

For a custom-format `pg_dump` archive, after confirming the target is empty:

```sh
vps up -d --wait postgres redis
vps exec -T postgres sh -c 'exec pg_restore --no-owner --no-privileges --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /secure/path/old-homzie.dump
```

If no database is recoverable, deploy with the fresh empty database. From the app directory:

```sh
node scripts/deploy-vps.mjs /srv/homzie/config/homzie.env
```

The script validates settings, builds images, waits for PostgreSQL/Redis, saves a private database dump under `storage/backups`, runs migrations inside the worker image, then starts the app and HTTPS proxy. A failed backup stops the migration. It never removes volumes or storage. Image builds need outbound access for npm, Alpine packages, and Google Fonts.

Create the admin account only when needed:

```sh
vps run --rm --no-deps worker node scripts/seed-admin.mjs
```

This command also resets the password and activates/promotes an existing account with `ADMIN_EMAIL`; it is deliberately separate from deployment. Sign in at `/sign-in`, open `/admin`, and use **Show / Refresh demo profile**, or configure `/admin/settings/demo-profile`, to populate the bundled sample agent and listings on a fresh database.

### Verify before the meeting

- Confirm HTTPS has a valid certificate and HTTP redirects to it.
- Sign in and confirm the admin dashboard loads.
- Open the demo agent and a listing, and play an existing property video.
- Upload a small image and confirm it remains after restarting the web container.
- Exercise messaging with two accounts if it is part of the demonstration.
- Confirm `vps ps` shows running services and review `vps logs --tail=100 web worker realtime caddy` for failures. Logs may contain account information; redact before sharing.

Scheduled broadcasts and billing transitions are opt-in because restored data can contain old queued work. After reviewing those records, enable with `vps --profile scheduled up -d --build cron`. A normal deployment leaves an already-running optional service alone; explicitly use `vps stop cron` to stop it.

If calls are needed, set `TURN_SHARED_SECRET`, `TURN_EXTERNAL_IP`, `TURN_REALM`, and `TURN_URLS` (using the public VPS address and UDP/TCP port 3478). Allow inbound TCP/UDP 3478 and UDP 49160–49200, then start `vps --profile calls up -d coturn`. Match any custom ports/range in both the environment and firewall.

For later deployments use the same script and project name `homzie_vps`. Retain database dumps, source revision, environment file, media, and Docker volumes. Never use `down -v` or `docker volume prune` as a deployment or rollback step.

### GitHub Actions production deployment

Pushes to `main` now run validation on GitHub-hosted Ubuntu runners, then deploy the exact main commit to this VPS over SSH. The retired self-hosted runner is not part of this workflow. Validation covers lint, TypeScript, listing visibility against an isolated PostgreSQL service, auth loading, email transport, and deployment safeguards.

The server installs `scripts/github-vps-deploy.py` as `/usr/local/sbin/homzie-github-deploy`. Its dedicated SSH public key has `restrict,command="/usr/local/sbin/homzie-github-deploy"` in `authorized_keys`; it accepts only `deploy <40-character-main-commit-SHA>`. The existing administrator key is not stored in GitHub. Repository configuration contains:

- Variable `HOMZIE_VPS_HOST`: the VPS hostname or IP.
- Secret `HOMZIE_VPS_DEPLOY_KEY`: the dedicated restricted deployment private key.
- Secret `HOMZIE_VPS_KNOWN_HOSTS`: the already-verified SSH host keys; strict host verification stays enabled.

The deploy command validates the SHA against GitHub `main`, downloads a clean release into `/srv/homzie/releases`, and uses the existing external environment and storage paths. It locks deployments, retains the previous source and Docker images, builds, backs up the database before migration, and starts the ordinary services. Cron and demo/admin seeding remain opt-in. Private logs and the resulting commit/image metadata are kept under `/srv/homzie/config`; build environment values are not streamed to Actions logs.

After HTTPS and deployment-ID checks pass, `/srv/homzie/app` points to the verified release. The GitHub production environment reports the result, and the workflow performs final public HTTPS checks. A failed build keeps the running release; a failed post-deploy health check restores the previous application images without restoring or deleting database records.

### Buyer demonstration dataset

The fictional dataset deployed on 18 November 2026 adds 10 marked agencies, 30 agents, 14 buyers, and 71 listings (51 published, 10 under offer, 10 sold), plus sample conversations, offers, saves, follows, and analytics. It uses 166 local photo/avatar/logo files under `listings/demo`, `avatars/demo`, and `agencies/demo`. It does not create reels. Original production records were backed up and their row hashes checked before and after seeding.

The seed and clear scripts retain their database-host whitelist. Production or a public `APP_URL` additionally requires `--allow-vps-demo`; production seeding requires a private `DEMO_PASSWORD` of at least 16 characters. Cleanup refuses mixed real/demo ownership or conversations rather than deleting real records. Always take a fresh database backup before re-seeding; fixture IDs change.

On this VPS, the generated account document is private at `/srv/homzie/config/demo-seed/DEMO_ACCOUNTS.md`, with a private local copy at `storage/backups/vps-demo-accounts.md`. The production demo password differs from the shared local default. Run the seed in a private working directory so the generated document remains outside the app and public media:

```sh
vps run --rm --no-deps -T --workdir /demo-seed \
  -v /srv/homzie/config/demo-seed:/demo-seed \
  worker node /app/scripts/seed-demo.mjs --allow-vps-demo
```

Ordinary email notifications were disabled for these 44 fictional accounts through `user_notification_preferences.email_enabled`; in-app sample notifications remain available. Reapply that setting to the marked accounts after any re-seed. Billing bypass is enabled only on the fictional agencies, and the scheduled cron profile remains off.

Post-deployment checks covered the principal and buyer logins, public agency/profile/property pages, performance analytics, sample media, control-room members/billing, and messaging inboxes. The performance-page check exposed a share-dialog SSR error (`window is not defined`); the server now supplies the canonical share URL, with regression coverage for closed-dialog SSR and all share links. Final live checks produced no additional errors. Error-log history was retained, including the original restored entries and that corrected performance-page failure.

### Email hosting and outgoing provider selection

Incoming mail is hosted separately from the application. Domains.co.za Email Only hosting provides the mailboxes, webmail, and SMTP relay; SendGrid can also send the application's mail without Google Workspace. Both providers can use `no-reply@homzie.co.za` once that sender/domain is authenticated.

The Homzie email hosting service purchased on 18 November 2026 is on `cp58.domains.co.za` (`169.239.218.58`). Use the current cPanel **Connect Devices** and **Email Deliverability** values when configuring DNS and mail clients. The older Domains DNS zone still referred to `cp69` and must not be treated as the new service's configuration.

Create the application mailbox in cPanel. Keep its password private. Configure SMTP in the one server-managed environment file:

```dotenv
SMTP_HOST=cp58.domains.co.za
SMTP_PORT=465
SMTP_USER=no-reply@homzie.co.za
SMTP_PASSWORD=your-private-mailbox-password
EMAIL_FROM_EMAIL=no-reply@homzie.co.za
EMAIL_FROM_NAME=Homzie
EMAIL_REPLY_TO_EMAIL=support@homzie.co.za
```

Alternatively, set `SMTP_PASSWORD_BASE64` to the Base64 encoding of the mailbox password, and leave `SMTP_PASSWORD` unset. This preserves special characters through Compose/environment-file parsing. Base64 is encoding, not encryption: protect the file with mode `600`, just like every other secret. Plaintext `SMTP_PASSWORD` takes precedence if both are present. Use port `465` for TLS from connection start or `587` for required STARTTLS; certificate validation stays enabled.

After changing environment credentials, recreate the services that send email so their environments refresh. Keep the scheduled cron profile off unless it has deliberately been enabled. Provider selection itself is stored in `platform_settings`, and changing that selection does not require a restart:

1. Open `/admin/settings/email` as an active admin.
2. Check SMTP connection/sign-in. This button does not send an email.
3. Choose **SMTP** or **SendGrid**, enter the allowed sender and reply-to addresses, and save.
4. Use `/admin/email-templates` to send a test to an address you choose and inspect the result.

The server retains both providers' credentials. Each email uses exactly one selected provider; failures do not trigger an automatic send through the other provider, which could duplicate a message after ambiguous acceptance. Transactional and broadcast logs record the actual provider. SMTP confirms relay acceptance; SendGrid's delivery/open/click webhooks apply only to SendGrid messages. Respect the hosting plan's actual sending limits; standard mailbox SMTP is intended for ordinary mail rather than large campaigns.

Cloudflare remains authoritative for `homzie.co.za`. Apply the new cPanel mail A, SPF, and DKIM records there, keeping the website's A/www/vps records and nameservers intact. Existing MX remains `10 mx1.tld-mx.com` unless the new hosting service instructs otherwise. SendGrid authentication uses separate DNS-only CNAME records under `sgmail` and `s1/s2._domainkey`, alongside cPanel's `default._domainkey` TXT record. Do not replace the mailbox MX with SendGrid records. Keep one SPF record at each hostname, and use the provider's exact authentication values.

On 18 November 2026, the live VPS was configured with **SMTP selected**, sender `Homzie <no-reply@homzie.co.za>`, and reply-to `support@homzie.co.za`. The support address is a cPanel forwarding alias into the no-reply mailbox. SMTP TLS/sign-in and the admin provider switch were checked; SendGrid confirmed domain authentication. With the owner's approval, one test email from each provider was accepted and received in the new mailbox, verified through an encrypted, read-only IMAP connection. Scheduled broadcasts remain disabled.

## Legacy Windows deployment reference

The current production architecture and GitHub deployment flow are the Linux VPS configuration above. The following Ubuntu/WSL configuration is retained for the former Windows server.

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
NEXT_PUBLIC_SITE_URL=http://localhost:3000
AUTH_SECRET=replace-with-a-long-random-secret

DOMAIN=homzieproperty.com
ADMIN_HOSTNAME=admin.localhost
CADDY_EMAIL=admin@homzieproperty.com

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

ADMIN_EMAIL=admin@homzieproperty.com
ADMIN_PASSWORD=change-me-now
ADMIN_NAME=Homzie Admin

CLOUDFLARE_TUNNEL_TOKEN=
```

Local storage directories should be created before upload or media workflows are exercised.

## Self-Hosted Production Environment

Use these values in `/mnt/c/Homzie/config/homzie.env` for production, replacing secrets with real strong values:

```dotenv
APP_URL=https://homzieproperty.com
AUTH_URL=https://homzieproperty.com
NEXT_PUBLIC_SITE_URL=https://homzieproperty.com
AUTH_SECRET=replace-with-a-long-random-production-secret

DOMAIN=homzieproperty.com
ADMIN_HOSTNAME=admin.homzieproperty.com
CADDY_EMAIL=admin@homzieproperty.com

POSTGRES_DB=homzie
POSTGRES_USER=homzie
POSTGRES_PASSWORD=replace-with-a-strong-database-password
DATABASE_URL=postgres://homzie:replace-with-a-strong-database-password@postgres:5432/homzie

REDIS_URL=redis://redis:6379

MEDIA_ROOT=/data/media
MEDIA_STORAGE_PATH=/data/media
VIDEO_STORAGE_PATH=/data/media/videos
THUMBNAIL_STORAGE_PATH=/data/media/thumbnails
EXPORT_STORAGE_PATH=/data/media/exports
BACKUP_STORAGE_PATH=/data/media/backups

ADMIN_EMAIL=admin@homzieproperty.com
ADMIN_PASSWORD=replace-with-a-strong-admin-password
ADMIN_NAME=Homzie Admin

CLOUDFLARE_TUNNEL_TOKEN=replace-with-cloudflare-tunnel-token
```

Production containers should receive only the environment values they need. Keep the canonical production file outside the deployable app directory.

## Domain Cutover

The public canonical domain is `https://homzieproperty.com`. The Caddy configuration sends `homzie.co.za`, `www.homzie.co.za`, and `www.homzieproperty.com` to it with permanent redirects, preserving each path and query string.

Before deploying the domain change:

1. In Cloudflare, add public hostnames for `homzieproperty.com`, `www.homzieproperty.com`, `homzie.co.za`, and `www.homzie.co.za` to the existing tunnel, all pointing to the Caddy service on port `80`. Keep the old hostnames active so their redirects can be served.
2. Update the production environment file with the production values above, including `NEXT_PUBLIC_SITE_URL`. This value is compiled into browser code, so rebuild the images after changing it.
3. Add `https://homzieproperty.com/api/auth/callback/google` to the Google OAuth client's authorized redirect URIs, and keep the previous URI during the transition.
4. Update Stripe's webhook endpoint, SendGrid link branding/sender authentication, Google Maps browser key referrers, and any analytics/Search Console properties to include the new domain. Configure the `admin@`, `no-reply@`, and `support@` mailboxes before using the new email addresses.
5. Submit `https://homzieproperty.com/sitemap.xml` in Search Console after deploy. Do not remove the old domain until its redirects have been live long enough for search engines and saved links to move over.

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
- `/users/[username]`
- `/users/[username]/videos`
- `/users/[username]/listings`
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
11. Confirm the web app responds at `https://homzieproperty.com`.
12. Confirm `https://homzie.co.za` and `https://www.homzie.co.za` permanently redirect to the matching new-domain URL.
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
