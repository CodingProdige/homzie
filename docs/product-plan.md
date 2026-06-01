# Homzie Product Plan

Homzie is a web-first property discovery platform where agents act like creators, properties are listings, vertical property video drives discovery, and leads/viewing bookings are the conversion layer.

This plan defines the first production slices so future development stays focused.

## Product Shape

Homzie should support two browsing modes from the beginning:

- Desktop web: classic search, property lists, filters, agent profiles, property detail pages.
- Mobile web: vertical discovery feeds, agent videos, quick save/follow actions, lead and viewing prompts.

Homzie is not a native mobile app yet. The first product must feel excellent in a mobile browser while remaining a strong desktop property search experience.

## First Production Milestones

### 1. Agent Profiles and Agent Creator Presence

Agents are the center of Homzie. The first product surface should prove that agents can be creators, publishers, and lead generators inside the main app.

Initial scope:

- Public profile route at `/users/[username]`.
- Profile bio, location, stats, links, highlights, testimonials, and active listings.
- Reels grid where each reel can optionally link to a listing.
- If a reel is not linked to a listing, it should route users back into the agent profile.
- Clear calls to follow, message, and view listings.
- Agent-owned dashboard actions for uploading a reel or adding a listing once auth is implemented.

This is the product spine: users discover agents through media, then move into listings, leads, and viewing bookings.

### 2. Auth, Agent Onboarding, and Subscription Access

Auth exists to support agent workflows first. Agents should be able to sign up, subscribe, create a profile, and start publishing.

Initial scope:

- Email/password sign in.
- Admin bootstrap from server env.
- User sessions with Auth.js.
- Server-side permission helpers.
- Protected dashboard routes.
- Protected admin routes.
- Agent onboarding after sign-in.
- Subscription gate for agent publishing tools.

Initial monetization:

```text
R99/pm agent subscription
```

The subscription unlocks the ability for agents to use the platform, maintain their profile, upload listings, publish reels, receive leads, and manage viewing bookings. Boosts can be introduced later as a visibility layer on top of the base subscription.

Roles and subscription access should be server-authoritative. The client can show or hide navigation, but all access decisions must be checked on the server.

### 3. Properties

Properties are the core listing object.

Initial scope:

- Agent dashboard listing management.
- Public property detail pages.
- SEO metadata.
- Neighborhood/location fields.
- Draft/published/moderation states.
- Listing attachment from reels.

### 4. Media and Reels

Media is first-class infrastructure.

Initial scope:

- Upload property media to configured storage paths.
- Store portable relative paths.
- Attach videos/media to properties and agent profiles.
- Allow reels to exist with or without a linked listing.
- Route linked reels to their listing detail pages.
- Route unlinked reels to the agent profile.
- Public media serving through `/media/*`.

Video feeds can start simple, but all path rules and ownership checks must be correct from day one.

Future reel analytics should use a dedicated watch-events table rather than only
the aggregate `reels.view_count` field. `view_count` is the fast display counter
for reel cards; the analytics layer should store individual watch events with
viewer or anonymous session identifiers, watch duration, completion percentage,
traffic source, timestamps, and enough context to build creator analytics later.

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

1. `/users/[username]`
2. `/agents`
3. `/sign-in`
4. `/sign-up`
5. `/dashboard`
6. `/dashboard/profile`
7. `/dashboard/listings`
8. `/dashboard/videos`
9. `/properties/[slug]`
10. `/book-viewing/[propertyId]`
11. `/for-you`
12. `/admin`

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

- Public agent profile page.
- Mock agent profile, reel, listing, and testimonial data.
- Reel objects with optional `listingId`.
- Agent subscription positioning at R99/pm.
- Responsive desktop/mobile profile layout.

After that, implement auth, subscription access, and agent dashboard upload flows.
