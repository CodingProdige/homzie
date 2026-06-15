# Homzie Engineering Principles

Homzie is a modern property discovery platform, a media-first real estate platform, and an agent creator platform. It is web-first, not a native mobile app. Desktop web should support classic property browsing and search, while mobile web should support vertical discovery feeds and creator-led exploration.

The product should feel closer to TikTok, Instagram, Zillow, and Airbnb than to a commerce platform. Agents are creators. Listings are properties. Content is vertical property video and reels. Leads and viewing bookings are the conversion layer.

These principles guide future developers and AI coding agents working in this repo.

## 1. KISS

Keep the architecture simple.

Homzie should use:

- One Next.js app
- One PostgreSQL database
- One Redis service
- One Caddy reverse proxy
- One Docker Compose stack per environment
- A modular monolith structure

Do not introduce microservices for normal product development. Most Homzie features should be modules inside the same app, sharing one database and one deployment flow.

Prefer explicit code over clever abstractions. A small amount of clear duplication is better than a premature framework that makes feature work harder to understand.

## 2. Media-First Architecture

Homzie is video-heavy. Media is not an afterthought.

Treat these as first-class infrastructure concerns:

- Uploads
- Property videos
- Reels
- Property photos
- Thumbnails
- Future transcoded outputs
- Exports
- Backups
- Moderation assets

Uploaded media and generated files must live outside deployable app code. Deployments may replace application containers and build artifacts, but must never remove user media, thumbnails, exports, backups, database data, or Docker volumes.

Media features should be designed around predictable storage keys, durable paths, server-side validation, and clear ownership by user, agent profile, property, or moderation workflow.

## 3. Agents Are Creators

Agents are not sellers. Homzie should help agents build trust and visibility through content, not just submit listings.

The platform should help agents:

- Build rich public profiles
- Publish vertical videos
- Attach listings to media
- Generate leads
- Book viewings
- Build audience trust
- Grow visibility
- Understand performance through analytics
- Use boosts and subscriptions where appropriate

Agent profiles live inside the main app like TikTok or Instagram profiles. Public agent pages should support browsing the agent's videos, active listings, and trust signals without feeling like a separate portal.

Use Homzie domain language:

- users
- agentProfiles
- agencies
- properties
- propertyMedia
- propertyVideos
- reels
- savedProperties
- follows
- leads
- viewingBookings
- neighborhoods
- moderation
- reports
- boosts
- subscriptions

Agent profiles are also reputation surfaces. Listing outcomes, verified sales, conversion rate, mandate history, and disputed sale claims should be treated as long-lived reputation data, not disposable listing metadata. Published listings should not be hard-deleted through normal product flows; they should move through lifecycle states such as active, under offer, sold, sold externally, withdrawn, expired, disputed, or archived.

Once a listing reaches an outcome state, core facts must be locked or treated as historical evidence: property identity, location/address, asking price, mandate type, listed date, outcome status, sold date, and sale price. If two agents claim the same underlying property sale, both claims should stop counting toward public success stats until proof is reviewed and the correct outcome is verified. Reels linked to unavailable or sold listings should not pretend the property is still active.

## 4. Discovery-First UX

Homzie combines search, social discovery, and creator-led browsing.

The UX should support:

- SEO-friendly listing and search pages
- Reel-style discovery
- Creator-led browsing
- Mobile vertical feeds
- Classic desktop property browsing
- Saved properties
- Follows
- Lead capture
- Viewing booking flows

Discovery and engagement matter as much as search. A user might arrive from Google, browse a property detail page, open an agent profile, watch several videos, follow the agent, save a property, and book a viewing. Build flows that make those transitions feel natural.

## 5. SEO-First Public Pages

Public pages are acquisition surfaces. They must be crawlable, indexable, and useful without requiring client-only rendering.

Use:

- Server Components where possible
- Proper metadata
- Crawlable content
- Rich indexing
- Neighborhood and location pages
- Property detail pages
- Agent profile pages
- Clean canonical URLs
- Meaningful titles and descriptions

Important public routes include:

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

Video-heavy discovery can be interactive, but the underlying property and agent pages should still expose meaningful server-rendered content.

## 6. Server Components By Default

Use Server Components by default in the Next.js App Router.

Use Client Components only when the feature needs browser-side behavior, such as:

- Local interactivity
- Vertical video feeds
- Upload widgets
- Modals
- Charts
- Browser APIs
- Dashboard controls
- Optimistic UI

Keep Client Components small and purposeful. Data loading, permission checks, and durable business logic should stay server-side whenever possible.

## 7. Mutations

Use Server Actions for standard forms.

Do not create custom Route Handlers or API endpoints for ordinary app queries or mutations. Homzie should avoid middleman calls that add latency, duplicate validation, or split business rules across multiple surfaces. Keep normal database reads in Server Components and normal writes in Server Actions so the UI gets the shortest practical path to server-side logic.

API routes are not the default backend abstraction in Homzie. Unless something absolutely requires an HTTP API, do not create one. Simple backend calls, product mutations, analytics writes, settings updates, profile edits, dashboard actions, and internal app workflows should use Server Components, Server Actions, or server-side module functions with direct database access. If an API route is introduced, the implementer must be able to point to the protocol or integration requirement that makes it necessary.

Homzie owns its physical server and infrastructure, so favor direct database
queries through the app's server-side code over unnecessary API layers. Real-time
feedback features such as listing presence heartbeats should use direct
server-side database reads/writes through Server Actions or server modules, with
short enough intervals to make the product feel live. Create a new endpoint only
when there is no viable Server Component, Server Action, or server-module
alternative.

Use Route Handlers for:

- Auth.js internals and provider callbacks
- Uploads
- Webhooks
- Media endpoints
- Integrations
- Streaming or range-sensitive media behavior

If a feature can be handled by a Server Component or Server Action, do that first. Add a Route Handler only when HTTP semantics are genuinely required, such as third-party callbacks, file uploads, webhooks, public media serving, range requests, or protocol-level integrations.

Every mutation must:

- Validate input with Zod
- Authenticate server-side
- Authorize server-side
- Use database transactions for multi-step writes
- Return predictable errors
- Avoid trusting hidden form fields for ownership or role decisions

Examples of multi-step writes that need transactions include creating a property with media rows, recording a viewing booking and lead, applying moderation decisions, and updating boost or subscription state.

## 8. Permissions

Never trust client roles.

Permission rules must be enforced server-side. The UI can hide actions for usability, but hidden buttons are not security.

Server-side code must verify:

- Who the current user is
- Whether the user has an agent profile
- Whether the agent profile owns the property, video, lead, or booking being modified
- Whether an admin action is actually authorized
- Whether agency-level access applies

Admin routes and dashboard routes must not rely on client-provided role flags.

## 9. Media Path Rules

Database rows should store portable relative paths only.

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

The app can resolve relative paths into local filesystem paths or public URLs at runtime based on environment configuration.

This keeps data portable between:

- Local development on Mac
- Self-hosted Ubuntu/WSL production
- Future storage backends if Homzie adopts them

## 10. Storage Rules

Do not use user-provided filenames as storage keys.

Generate collision-resistant filenames grouped by domain and date.

Recommended path shape:

```text
videos/YYYY/MM/generated-id.ext
thumbnails/YYYY/MM/generated-id.webp
media/YYYY/MM/generated-id.ext
exports/YYYY/MM/generated-id.ext
backups/YYYY/MM/generated-id.ext
```

User-provided filenames may be stored as display metadata only after validation and sanitization. They must not decide the physical storage location.

Validate uploads server-side for expected type, size, ownership, and workflow. Media workflows should be designed so future thumbnail generation and transcoding can be added without rewriting the data model.

## 11. Cache Rules

PostgreSQL is the source of truth.

Redis is for:

- Rate limiting
- Expensive aggregates
- Future queues
- Short-lived computed data
- Temporary workflow state

Do not store durable business records only in Redis. If losing Redis would destroy important application state, that state belongs in PostgreSQL.

Caddy serves media from:

```text
/media/*
```

Media delivery should not require the Next.js app to stream every public file unless authorization, transformation, or auditing requires an application-controlled endpoint.

## 12. Local vs Self-Hosted Separation

Local and production must never share:

- Docker project names
- Environment files
- Storage paths
- Data paths

Local Docker Compose project name:

```text
homzie_dev
```

Self-hosted Docker Compose project name:

```text
homzie_selfhost
```

Local storage paths:

```text
./storage/media
./storage/videos
./storage/thumbnails
./storage/exports
./storage/backups
```

Production storage paths:

```text
/mnt/c/Homzie/storage/media
/mnt/c/Homzie/storage/videos
/mnt/c/Homzie/storage/thumbnails
/mnt/c/Homzie/storage/exports
/mnt/c/Homzie/storage/backups
```

Local development intentionally uses PostgreSQL port `5433` and Redis port `6380`.

## 13. Code Organization

Keep pages thin and business logic modular.

Routes and pages:

```text
app/*
```

Business logic:

```text
src/modules/*
```

Database:

```text
src/db/*
```

Cache:

```text
src/cache/*
```

Media helpers:

```text
src/media/*
```

Route files should compose modules, load data, and render UI. They should not become large containers for business rules, permission systems, upload naming, or database orchestration.

## 14. UI Rules

Use shadcn/ui primitives first when building interface components.

The UI must be responsive. Mobile web matters because Homzie is a web app, not a native mobile app yet.

No modal, panel, feed card, dropdown, or toolbar may overflow the viewport. This is especially important for:

- Mobile vertical video feeds
- Upload interfaces
- Dashboard tables
- Analytics charts
- Booking forms
- Admin moderation views

Desktop web should support classic property search and browsing. Mobile web should support vertical discovery and quick engagement. Both should feel like one coherent product.

Avoid UI patterns that make Homzie feel like a generic admin system when the user is in public discovery flows. Public discovery should feel media-rich, fast, and creator-led. Dashboard and admin areas should be quieter, denser, and optimized for repeated work.

## 15. Testing

Minimum checks before a change is considered ready:

```bash
npm run lint
npm run build
```

Broaden testing when a change touches:

- Auth
- Permissions
- Uploads
- Media path generation
- Viewing bookings
- Leads
- Payments or subscriptions
- Boost state
- Admin moderation
- Database migrations
- Deployment scripts

For high-risk changes, add focused tests around the business rule rather than relying only on manual UI verification.

## Route Ownership

Public app routes are for property discovery, SEO, agent profiles, video browsing, lead capture, and viewing bookings.

Agent dashboard routes are for agents managing profiles, listings, videos, leads, bookings, analytics, billing, and boosts.

Admin routes are for platform operations: agents, agencies, properties, videos, reports, subscriptions, and boosts.

Keep route intent clear. Do not move agent workflows into admin unless they truly require platform-level authority.

## Product Boundary

Homzie is not a commerce marketplace. Do not add assumptions from commerce platforms.

The core domain is:

- Property discovery
- Agent creator profiles
- Property media
- Vertical video
- Saved properties
- Follows
- Leads
- Viewing bookings
- Neighborhood discovery
- Moderation
- Reports
- Boosts
- Subscriptions

When in doubt, ask whether a feature helps users discover properties, trust agents, engage with media, request information, or book a viewing. If it does not support that loop, it may not belong in the core product.

## Decision Order

When engineering tradeoffs conflict, prioritize:

1. Protect production data and uploaded media.
2. Keep public property and agent pages crawlable.
3. Keep permissions server-side and explicit.
4. Keep media paths portable.
5. Keep the modular monolith simple.
6. Keep mobile web discovery excellent.
7. Keep desktop property browsing efficient.

Homzie should be ambitious in product experience and conservative in infrastructure complexity.
