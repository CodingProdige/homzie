# Homzie Product Plan

Homzie is a web-first property discovery platform where agents act like creators, properties are listings, vertical property video drives discovery, and leads/viewing bookings are the conversion layer.

This plan defines the first production slices so future development stays focused.

## Product Shape

Homzie should support two browsing modes from the beginning:

- Desktop web: classic search, property lists, filters, agent profiles, property detail pages.
- Mobile web: vertical discovery feeds, agent videos, quick save/follow actions, lead and viewing prompts.

Homzie is not a native mobile app yet. The first product must feel excellent in a mobile browser while remaining a strong desktop property search experience.

## First Production Milestones

### 1. Auth and Identity

Build auth first because every later workflow depends on it.

Initial scope:

- Email/password sign in.
- Admin bootstrap from server env.
- User sessions with Auth.js.
- Server-side permission helpers.
- Protected dashboard routes.
- Protected admin routes.
- Agent profile onboarding after sign-in.

Roles should be server-authoritative. The client can show or hide navigation, but all access decisions must be checked on the server.

### 2. Agent Profiles

Agents are creators. The first signed-in workflow should help an agent create a profile that can later anchor listings, videos, leads, bookings, analytics, boosts, and subscriptions.

Initial scope:

- Create/edit agent profile.
- Public profile route at `/agents/[username]`.
- Basic agency association placeholder.
- Profile status for moderation readiness.

### 3. Properties

Properties are the core listing object.

Initial scope:

- Agent dashboard listing management.
- Public property detail pages.
- SEO metadata.
- Neighborhood/location fields.
- Draft/published/moderation states.

### 4. Media and Reels

Media is first-class infrastructure.

Initial scope:

- Upload property media to configured storage paths.
- Store portable relative paths.
- Attach videos/media to properties and agent profiles.
- Public media serving through `/media/*`.

Video feeds can start simple, but all path rules and ownership checks must be correct from day one.

### 5. Leads and Viewing Bookings

Conversion is leads and bookings, not checkout.

Initial scope:

- Lead capture from property pages.
- Viewing booking request form.
- Agent dashboard lead/bookings inbox.
- Admin visibility for moderation and support.

## Auth Flow Design

Public users can browse without signing in. Signed-in users can save properties, follow agents, and request/book viewings. Agents can manage their creator profile, listings, videos, leads, bookings, analytics, billing, and boosts. Admins can manage platform operations.

Primary flows:

1. Visitor browses public pages.
2. Visitor signs in or creates an account.
3. User can save properties, follow agents, and book viewings.
4. User can create an agent profile.
5. Agent gains access to `/dashboard`.
6. Admin users gain access to `/admin`.

Route protection:

- Public routes remain crawlable.
- `/dashboard/*` requires a signed-in user with an agent profile.
- `/admin/*` requires a signed-in admin.
- Mutations must validate, authenticate, authorize, and use transactions for multi-step writes.

## Initial Route Priorities

Build in this order:

1. `/sign-in`
2. `/sign-up`
3. `/dashboard`
4. `/dashboard/profile`
5. `/admin`
6. `/agents/[username]`
7. `/properties`
8. `/properties/[slug]`
9. `/book-viewing/[propertyId]`
10. `/for-you`

The public routes can start with real layouts and placeholder data. Protected routes should enforce real server-side access checks from the start.

## UI Foundation

Use shadcn/ui primitives first. Keep components reusable and boring.

Initial UI primitives:

- Button
- Input
- Label
- Card
- Form-related layout components
- Dialog and dropdown primitives when needed

Do not build bespoke controls when a shadcn primitive fits. Keep public discovery visually richer than admin/dashboard surfaces, but keep both responsive and viewport-safe.

## Next Implementation Slice

The next engineering slice should implement:

- Auth.js configuration.
- User/admin database tables.
- Admin seed script.
- Sign-in page using shadcn UI.
- Sign-out action.
- Server-side `getCurrentUser` helper.
- `/dashboard` and `/admin` guards.

This gives Homzie a secure spine before property, media, and booking workflows are added.
