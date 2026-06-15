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

## Strategic Differentiator: Buyer Intent Intelligence

Homzie should become more than a place where agents publish listings and wait.
The core wedge against Property24 is that Homzie can show agents live buyer
intent: who is looking, what they are looking for, how serious they seem, and
which conversations should be started now.

The agent-facing promise:

```text
Stop waiting for buyer enquiries. See active buyer intent as it happens.
```

This is the strongest near-term differentiator because buyers and sellers are
both searching for each other, but existing portals mostly hide buyer demand
behind form submissions and agency-owned lead channels.

### Initial Product Slice

Start with listing-level live intent for subscribed agents.

Scope:

- Track real-time active viewers on each agent-owned listing.
- Show current active viewer count on listing detail and agent dashboard
  surfaces.
- Show a horizontal carousel of active buyer profile cards for viewers who are
  signed in as regular buyer users, excluding agents, admins, the listing owner,
  and anonymous sessions.
- Keep a buyer visible in the active carousel for at least five minutes after
  their last listing heartbeat so agents have time to act.
- Show how many times each buyer has viewed that listing.
- Add a clear message action from the buyer card.
- Send agent events and notifications for high-intent moments, such as a buyer
  viewing the same listing repeatedly or a listing crossing an active-viewer
  threshold.
- Add an agent-only modal for a buyer's intent profile on that listing.

The first buyer intent modal should include:

- Buyer profile summary and message action.
- Number of views on this listing.
- Last active time and total recent Homzie activity.
- Most-viewed areas based on listing browsing history.
- Estimated price range based on viewed listings.
- Recently viewed listings.
- Offers submitted, limited to data the agent is allowed to see.
- Saved or liked listings where visibility is allowed.

Privacy and trust constraints:

- Do not expose anonymous users as identifiable buyers.
- Do not expose buyer identity to agents unless the buyer is signed in and
  platform terms make this clear.
- Add buyer-side controls later for "contact me", "private browsing", and
  investor visibility preferences before making this a larger marketplace.
- Avoid creepy language in the UI. Use "active buyer", "viewed this listing",
  "recent interest", and "likely price range" instead of surveillance-heavy
  wording.

### Data Model and Infrastructure Direction

The codebase already has a good base for this:

- `listing_view_events` records listing views by listing, user/session, and time.
- `listing_action_events` records listing-level actions.
- `property_offers` can support buyer offer history.
- `conversations`, `messages`, and attachments support agent outreach.
- `user_events`, email, and push modules can deliver notifications.
- `browser-session` already gives anonymous and signed-in browsing sessions a
  consistent tracking handle.

Add one lightweight live-presence layer rather than treating every page view as
live forever.

Suggested additions:

- `listing_presence_sessions`: listing id, viewer session id, viewer user id,
  started at, last seen at, expires at, user agent/device hints, referrer, and
  optional current page context.
- A direct Server Action heartbeat called from listing pages while the tab is
  visible. Because Homzie owns the server infrastructure, the first cadence can
  be closer to every 8-10 seconds for sharper live feedback.
- Server queries that treat viewers as active when `lastSeenAt` is within the
  last five minutes.
- Aggregation helpers for buyer intent: listing view count by buyer, buyer
  preferred areas, inferred price range, recent viewed listings, recent actions,
  and offer counts.
- Optional later: a websocket/SSE channel for live dashboard updates. Direct
  Server Action polling every 8-10 seconds is acceptable for the first
  production slice.

### Agent Dashboard Surface

Create a dedicated intent dashboard once the listing-level carousel is working.

Route idea:

```text
/dashboard/intent
```

Initial dashboard:

- Table of the agent's active listings ranked by current active viewers.
- Columns for active buyers, total active viewers, repeat viewers, saves/likes,
  recent messages started, and last activity.
- Click a listing row to open a modal showing active buyer cards.
- Click a buyer to open the buyer intent profile modal.
- Provide immediate "Message buyer" actions.
- Keep this surface quiet and operational, closer to a sales cockpit than a
  marketing page.

### Notification Strategy

Notifications should feel valuable, not noisy.

Start with event types:

- A signed-in buyer viewed one listing multiple times in a short period.
- A listing has multiple active buyers right now.
- A buyer who previously saved or liked the listing is active again.
- A buyer who made an offer or started a conversation is viewing again.

Throttle notifications per agent/listing/buyer so agents do not get spammed.
Use in-app events first, then push if enabled, and email only for high-intent
summaries or configurable digest alerts.

### Future Expansion

Later ideas to keep on the roadmap:

- Buyer subscription package that gives subscribed buyers access to new listings
  30-60 minutes before regular buyers.
- Investor and seller intent clubs where buyers, sellers, and agents can opt in
  to being contacted.
- Global active threads or groups for investor-level buyers and sellers looking
  for agents.
- Additional subscription tiers for agents and buyers based on intent access,
  early access, investor groups, and premium notification tools.
- Buyer-side visibility controls that let serious buyers explicitly signal that
  they want agents to contact them.
