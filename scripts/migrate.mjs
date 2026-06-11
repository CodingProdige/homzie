import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'admin');
      END IF;
    END
    $$;
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_profile_status') THEN
        CREATE TYPE agent_profile_status AS ENUM ('draft', 'active', 'suspended');
      END IF;
    END
    $$;
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'past_due', 'cancelled', 'expired');
      END IF;
    END
    $$;
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'disabled');
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      username text UNIQUE,
      email text NOT NULL UNIQUE,
      avatar_url text,
      bio text,
      location text,
      location_place_id text,
      contact_email text,
      contact_phone text,
      whatsapp_number text,
      public_contact_visible boolean NOT NULL DEFAULT true,
      password_hash text,
      role user_role NOT NULL DEFAULT 'user',
      status user_status NOT NULL DEFAULT 'active',
      email_verified boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS username text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bio text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS location text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS location_place_id text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS contact_email text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS contact_phone text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS whatsapp_number text
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS public_contact_visible boolean NOT NULL DEFAULT true
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_visible boolean NOT NULL DEFAULT true
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS search_visible boolean NOT NULL DEFAULT true
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS agent_trial_used_at timestamptz
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ads_billing_anchor_at timestamptz
  `;

  await sql`
    ALTER TABLE users
    ALTER COLUMN username DROP NOT NULL
  `;

  await sql`
    ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL
  `;

  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_username_unique'
      ) THEN
        ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
      END IF;
    END
    $$;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS users_username_idx ON users (username)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS agent_profiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name text NOT NULL,
      headline text,
      bio text,
      location text,
      status agent_profile_status NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS agent_profiles_user_id_idx ON agent_profiles (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS agent_profiles_status_idx ON agent_profiles (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_profile_id uuid REFERENCES agent_profiles(id) ON DELETE SET NULL,
      provider text NOT NULL DEFAULT 'stripe',
      status subscription_status NOT NULL DEFAULT 'pending',
      amount_cents integer NOT NULL,
      currency text NOT NULL DEFAULT 'ZAR',
      interval text NOT NULL DEFAULT 'month',
      provider_customer_id text,
      provider_checkout_id text,
      provider_transaction_id text,
      provider_reference text NOT NULL UNIQUE,
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancelled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE subscriptions
    ALTER COLUMN provider SET DEFAULT 'stripe'
  `;

  await sql`
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS provider_customer_id text
  `;

  await sql`
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS retention_offer_accepted_at timestamptz
  `;

  await sql`
    ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS retention_offer_expires_at timestamptz
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS subscriptions_agent_profile_id_idx ON subscriptions (agent_profile_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
    ON password_reset_tokens (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
    ON password_reset_tokens (expires_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS property_identities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      normalized_address text,
      google_place_id text,
      country text,
      city text,
      suburb text,
      property_type text,
      bedrooms integer,
      bathrooms integer,
      size_square_meters integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS property_identities_google_place_id_idx
    ON property_identities (google_place_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_identities_location_idx
    ON property_identities (country, city, suburb)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_identities_normalized_address_idx
    ON property_identities (normalized_address)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS property_listings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_profile_id uuid REFERENCES agent_profiles(id) ON DELETE SET NULL,
      property_identity_id uuid REFERENCES property_identities(id) ON DELETE SET NULL,
      listing_type text NOT NULL DEFAULT 'sale',
      property_type text NOT NULL DEFAULT 'free_standing_house',
      title text NOT NULL,
      description text,
      location text,
      price_label text,
      asking_price_cents integer,
      sold_price_cents integer,
      reservation_enabled boolean NOT NULL DEFAULT false,
      reservation_amount_cents integer,
      active_reservation_id uuid,
      cover_image_url text,
      media jsonb,
      details jsonb,
      features jsonb,
      mandate_type text NOT NULL DEFAULT 'open',
      mandate_start_date timestamptz,
      mandate_end_date timestamptz,
      status text NOT NULL DEFAULT 'draft',
      proof_status text NOT NULL DEFAULT 'not_required',
      listed_at timestamptz NOT NULL DEFAULT now(),
      outcome_at timestamptz,
      sold_at timestamptz,
      locked_at timestamptz,
      archived_at timestamptz,
      proof_requested_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS property_identity_id uuid REFERENCES property_identities(id) ON DELETE SET NULL
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'sale'
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'free_standing_house'
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS description text
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS asking_price_cents integer
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS sold_price_cents integer
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS reservation_enabled boolean NOT NULL DEFAULT false
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS reservation_amount_cents integer
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS active_reservation_id uuid
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS media jsonb
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS details jsonb
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS features jsonb
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS mandate_type text NOT NULL DEFAULT 'open'
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS mandate_start_date timestamptz
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS mandate_end_date timestamptz
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'not_required'
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS listed_at timestamptz NOT NULL DEFAULT now()
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS outcome_at timestamptz
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS sold_at timestamptz
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS locked_at timestamptz
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS archived_at timestamptz
  `;

  await sql`
    ALTER TABLE property_listings
    ADD COLUMN IF NOT EXISTS proof_requested_at timestamptz
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listings_user_id_idx
    ON property_listings (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listings_agent_profile_id_idx
    ON property_listings (agent_profile_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listings_property_identity_id_idx
    ON property_listings (property_identity_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listings_status_idx
    ON property_listings (status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listings_active_reservation_id_idx
    ON property_listings (active_reservation_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listings_outcome_at_idx
    ON property_listings (outcome_at)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listings_sold_at_idx
    ON property_listings (sold_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS property_sale_claims (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_identity_id uuid REFERENCES property_identities(id) ON DELETE SET NULL,
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      outcome_type text NOT NULL DEFAULT 'sold_by_agent',
      claim_status text NOT NULL DEFAULT 'pending',
      proof_status text NOT NULL DEFAULT 'pending',
      proof_summary text,
      sold_price_cents integer,
      sold_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS property_sale_claims_listing_id_idx
    ON property_sale_claims (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_sale_claims_property_identity_id_idx
    ON property_sale_claims (property_identity_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_sale_claims_user_id_idx
    ON property_sale_claims (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_sale_claims_claim_status_idx
    ON property_sale_claims (claim_status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS property_sale_disputes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_identity_id uuid REFERENCES property_identities(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'pending',
      reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_sale_disputes_property_identity_id_idx
    ON property_sale_disputes (property_identity_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_sale_disputes_status_idx
    ON property_sale_disputes (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS property_listing_status_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      from_status text,
      to_status text NOT NULL,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listing_status_history_listing_id_idx
    ON property_listing_status_history (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_listing_status_history_user_id_idx
    ON property_listing_status_history (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS listing_reservations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      buyer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents integer NOT NULL,
      platform_fee_cents integer NOT NULL DEFAULT 0,
      processing_fee_cents integer NOT NULL DEFAULT 0,
      total_paid_cents integer NOT NULL,
      currency text NOT NULL DEFAULT 'ZAR',
      status text NOT NULL DEFAULT 'pending',
      stripe_checkout_session_id text,
      stripe_payment_intent_id text,
      stripe_charge_id text,
      release_status text NOT NULL DEFAULT 'held',
      cancelled_reason text,
      document_request_sent_at timestamptz,
      documents_received_at timestamptz,
      reviewed_at timestamptz,
      reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      release_approved_at timestamptz,
      released_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      transfer_amount_cents integer,
      transfer_reference text,
      proof_of_transfer_url text,
      admin_notes text,
      agent_notes text,
      paid_at timestamptz,
      released_at timestamptz,
      refunded_at timestamptz,
      cancelled_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_reservations_listing_id_idx
    ON listing_reservations (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_reservations_buyer_user_id_idx
    ON listing_reservations (buyer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_reservations_agent_user_id_idx
    ON listing_reservations (agent_user_id)
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS document_request_sent_at timestamptz
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS documents_received_at timestamptz
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS release_approved_at timestamptz
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS released_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS transfer_amount_cents integer
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS transfer_reference text
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS proof_of_transfer_url text
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS admin_notes text
  `;

  await sql`
    ALTER TABLE listing_reservations
    ADD COLUMN IF NOT EXISTS agent_notes text
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_reservations_reviewed_by_user_id_idx
    ON listing_reservations (reviewed_by_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_reservations_released_by_user_id_idx
    ON listing_reservations (released_by_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_reservations_status_idx
    ON listing_reservations (status)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS listing_reservations_checkout_session_idx
    ON listing_reservations (stripe_checkout_session_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reels (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_profile_id uuid REFERENCES agent_profiles(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'draft',
      video_path text NOT NULL,
      caption text,
      hashtags text,
      listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL,
      listing_reference text,
      sound_id text NOT NULL DEFAULT 'original',
      trim_start_seconds integer NOT NULL DEFAULT 0,
      trim_end_seconds integer NOT NULL DEFAULT 0,
      cover_time_seconds integer NOT NULL DEFAULT 0,
      edit_metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE reels
    ADD COLUMN IF NOT EXISTS edit_metadata jsonb
  `;

  await sql`
    ALTER TABLE reels
    ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE reels
    ADD COLUMN IF NOT EXISTS listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_user_id_idx ON reels (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_agent_profile_id_idx ON reels (agent_profile_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_status_idx ON reels (status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_listing_id_idx ON reels (listing_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS platform_visitor_sessions (
      id text PRIMARY KEY,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS platform_visitor_sessions_last_seen_at_idx
    ON platform_visitor_sessions (last_seen_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_watch_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      viewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      viewer_session_id text NOT NULL,
      source text NOT NULL DEFAULT 'feed',
      last_progress_seconds integer NOT NULL DEFAULT 0,
      max_progress_seconds integer NOT NULL DEFAULT 0,
      duration_seconds integer NOT NULL DEFAULT 0,
      max_progress_percent integer NOT NULL DEFAULT 0,
      total_watch_seconds integer NOT NULL DEFAULT 0,
      completed boolean NOT NULL DEFAULT false,
      last_watched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS reel_watch_sessions_reel_session_unique
    ON reel_watch_sessions (reel_id, viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_watch_sessions_reel_id_idx
    ON reel_watch_sessions (reel_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_watch_sessions_viewer_user_id_idx
    ON reel_watch_sessions (viewer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_watch_sessions_last_watched_at_idx
    ON reel_watch_sessions (last_watched_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_watch_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      viewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      viewer_session_id text NOT NULL,
      event_type text NOT NULL,
      source text NOT NULL DEFAULT 'feed',
      progress_seconds integer NOT NULL DEFAULT 0,
      duration_seconds integer NOT NULL DEFAULT 0,
      progress_percent integer NOT NULL DEFAULT 0,
      watch_seconds integer NOT NULL DEFAULT 0,
      completed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_watch_events_reel_id_idx
    ON reel_watch_events (reel_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_watch_events_viewer_user_id_idx
    ON reel_watch_events (viewer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_watch_events_viewer_session_id_idx
    ON reel_watch_events (viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_watch_events_created_at_idx
    ON reel_watch_events (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      viewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      viewer_session_id text NOT NULL,
      feedback_type text NOT NULL,
      source text NOT NULL DEFAULT 'feed',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS reel_feedback_reel_session_type_unique
    ON reel_feedback (reel_id, viewer_session_id, feedback_type)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_feedback_reel_id_idx
    ON reel_feedback (reel_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_feedback_viewer_user_id_idx
    ON reel_feedback (viewer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_feedback_viewer_session_id_idx
    ON reel_feedback (viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_feedback_feedback_type_idx
    ON reel_feedback (feedback_type)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_feedback_created_at_idx
    ON reel_feedback (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_listing_clicks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      viewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      viewer_session_id text NOT NULL,
      source text NOT NULL DEFAULT 'feed',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_listing_clicks_reel_id_idx
    ON reel_listing_clicks (reel_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_listing_clicks_listing_id_idx
    ON reel_listing_clicks (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_listing_clicks_viewer_user_id_idx
    ON reel_listing_clicks (viewer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_listing_clicks_viewer_session_id_idx
    ON reel_listing_clicks (viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_listing_clicks_created_at_idx
    ON reel_listing_clicks (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS listing_view_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      viewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      viewer_session_id text NOT NULL,
      source text NOT NULL DEFAULT 'listing_detail',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_view_events_listing_id_idx
    ON listing_view_events (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_view_events_viewer_user_id_idx
    ON listing_view_events (viewer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_view_events_viewer_session_id_idx
    ON listing_view_events (viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_view_events_created_at_idx
    ON listing_view_events (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS listing_action_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      viewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      viewer_session_id text NOT NULL,
      action_type text NOT NULL,
      source text NOT NULL DEFAULT 'listing_detail',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_action_events_listing_id_idx
    ON listing_action_events (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_action_events_viewer_user_id_idx
    ON listing_action_events (viewer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_action_events_viewer_session_id_idx
    ON listing_action_events (viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_action_events_action_type_idx
    ON listing_action_events (action_type)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_action_events_created_at_idx
    ON listing_action_events (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (follower_id, following_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_follows_follower_id_idx
    ON user_follows (follower_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_follows_following_id_idx
    ON user_follows (following_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_likes (
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (reel_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_likes_user_id_idx
    ON reel_likes (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_saves (
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (reel_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_saves_user_id_idx
    ON reel_saves (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS listing_saves (
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (listing_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_saves_listing_id_idx
    ON listing_saves (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_saves_user_id_idx
    ON listing_saves (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS listing_likes (
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (listing_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_likes_listing_id_idx
    ON listing_likes (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS listing_likes_user_id_idx
    ON listing_likes (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_reshares (
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (reel_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_reshares_reel_id_idx
    ON reel_reshares (reel_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_reshares_user_id_idx
    ON reel_reshares (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_reshares_created_at_idx
    ON reel_reshares (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reel_id uuid NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id uuid REFERENCES reel_comments(id) ON DELETE CASCADE,
      body text NOT NULL,
      media_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_comments_reel_id_idx
    ON reel_comments (reel_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_comments_parent_id_idx
    ON reel_comments (parent_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_comments_user_id_idx
    ON reel_comments (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_comments_created_at_idx
    ON reel_comments (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_comment_likes (
      comment_id uuid NOT NULL REFERENCES reel_comments(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_comment_likes_user_id_idx
    ON reel_comment_likes (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reel_comment_dislikes (
      comment_id uuid NOT NULL REFERENCES reel_comments(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reel_comment_dislikes_user_id_idx
    ON reel_comment_dislikes (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type text NOT NULL DEFAULT 'direct',
      status text NOT NULL DEFAULT 'active',
      title text,
      created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL,
      last_message_id uuid,
      last_message_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS conversations_created_by_user_id_idx
    ON conversations (created_by_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS conversations_listing_id_idx
    ON conversations (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS conversations_last_message_at_idx
    ON conversations (last_message_at)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS conversations_status_idx
    ON conversations (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'member',
      inbox text NOT NULL DEFAULT 'primary',
      muted_at timestamptz,
      archived_at timestamptz,
      deleted_at timestamptz,
      last_read_at timestamptz,
      joined_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (conversation_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx
    ON conversation_participants (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS conversation_participants_inbox_idx
    ON conversation_participants (inbox)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS conversation_participants_last_read_at_idx
    ON conversation_participants (last_read_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      type text NOT NULL DEFAULT 'text',
      body text,
      metadata jsonb,
      client_id text UNIQUE,
      edited_at timestamptz,
      deleted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
    ON messages (conversation_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS messages_sender_user_id_idx
    ON messages (sender_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS messages_created_at_idx
    ON messages (created_at)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS messages_type_idx
    ON messages (type)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS message_receipts (
      message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delivered_at timestamptz,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (message_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_receipts_user_id_idx
    ON message_receipts (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_receipts_delivered_at_idx
    ON message_receipts (delivered_at)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_receipts_read_at_idx
    ON message_receipts (read_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS message_attachments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      type text NOT NULL,
      url text,
      title text,
      preview_image_url text,
      listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL,
      reel_id uuid REFERENCES reels(id) ON DELETE SET NULL,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_attachments_message_id_idx
    ON message_attachments (message_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_attachments_listing_id_idx
    ON message_attachments (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_attachments_reel_id_idx
    ON message_attachments (reel_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS property_offers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
      listing_id uuid NOT NULL REFERENCES property_listings(id) ON DELETE CASCADE,
      buyer_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents integer NOT NULL,
      currency text NOT NULL DEFAULT 'ZAR',
      note text,
      status text NOT NULL DEFAULT 'pending',
      responded_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_offers_conversation_id_idx
    ON property_offers (conversation_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_offers_listing_id_idx
    ON property_offers (listing_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_offers_buyer_user_id_idx
    ON property_offers (buyer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_offers_agent_user_id_idx
    ON property_offers (agent_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS property_offers_status_idx
    ON property_offers (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (blocker_user_id, blocked_user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_blocks_blocked_user_id_idx
    ON user_blocks (blocked_user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS message_reports (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reported_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
      message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
      reason text NOT NULL,
      details text,
      status text NOT NULL DEFAULT 'open',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_reports_reporter_user_id_idx
    ON message_reports (reporter_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_reports_reported_user_id_idx
    ON message_reports (reported_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_reports_conversation_id_idx
    ON message_reports (conversation_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS message_reports_status_idx
    ON message_reports (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS call_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      started_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      type text NOT NULL DEFAULT 'audio',
      status text NOT NULL DEFAULT 'ringing',
      started_at timestamptz NOT NULL DEFAULT now(),
      answered_at timestamptz,
      ended_at timestamptz,
      ended_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS call_sessions_conversation_id_idx
    ON call_sessions (conversation_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS call_sessions_started_by_user_id_idx
    ON call_sessions (started_by_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS call_sessions_status_idx
    ON call_sessions (status)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      event_type text NOT NULL,
      entity_type text,
      entity_id uuid,
      conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
      message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
      listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL,
      reel_id uuid REFERENCES reels(id) ON DELETE SET NULL,
      metadata jsonb,
      seen_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_events_user_id_idx
    ON user_events (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_events_actor_user_id_idx
    ON user_events (actor_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_events_event_type_idx
    ON user_events (event_type)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_events_seen_at_idx
    ON user_events (seen_at)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_events_created_at_idx
    ON user_events (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS web_push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS web_push_subscriptions_endpoint_idx
    ON web_push_subscriptions (endpoint)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_id_idx
    ON web_push_subscriptions (user_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_notification_preferences (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      push_enabled boolean NOT NULL DEFAULT true,
      email_enabled boolean NOT NULL DEFAULT true,
      messages_enabled boolean NOT NULL DEFAULT true,
      calls_enabled boolean NOT NULL DEFAULT true,
      offers_enabled boolean NOT NULL DEFAULT true,
      listing_activity_enabled boolean NOT NULL DEFAULT true,
      reel_activity_enabled boolean NOT NULL DEFAULT true,
      profile_activity_enabled boolean NOT NULL DEFAULT true,
      marketing_enabled boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE user_notification_preferences
    ALTER COLUMN email_enabled SET DEFAULT true
  `;

  await sql`
    ALTER TABLE user_notification_preferences
    ADD COLUMN IF NOT EXISTS email_event_preferences jsonb NOT NULL DEFAULT '{}'::jsonb
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_notification_preferences_updated_at_idx
    ON user_notification_preferences (updated_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS email_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      key text NOT NULL UNIQUE,
      name text NOT NULL,
      category text NOT NULL DEFAULT 'general',
      description text,
      subject text NOT NULL,
      preheader text,
      html text NOT NULL,
      text text NOT NULL,
      variables jsonb NOT NULL DEFAULT '[]'::jsonb,
      sample_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS email_templates_key_idx
    ON email_templates (key)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_templates_category_idx
    ON email_templates (category)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_templates_enabled_idx
    ON email_templates (enabled)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS email_template_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id uuid NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
      subject text NOT NULL,
      preheader text,
      html text NOT NULL,
      text text NOT NULL,
      variables jsonb NOT NULL DEFAULT '[]'::jsonb,
      sample_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_template_versions_template_id_idx
    ON email_template_versions (template_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_template_versions_created_at_idx
    ON email_template_versions (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS email_delivery_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      template_key text NOT NULL,
      event_key text NOT NULL,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      recipient_email text NOT NULL,
      subject text,
      provider text NOT NULL DEFAULT 'sendgrid',
      provider_message_id text,
      status text NOT NULL DEFAULT 'pending',
      error text,
      variables jsonb NOT NULL DEFAULT '{}'::jsonb,
      sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_delivery_logs_template_key_idx
    ON email_delivery_logs (template_key)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_delivery_logs_event_key_idx
    ON email_delivery_logs (event_key)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_delivery_logs_user_id_idx
    ON email_delivery_logs (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_delivery_logs_status_idx
    ON email_delivery_logs (status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS email_delivery_logs_created_at_idx
    ON email_delivery_logs (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ad_campaigns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      channel text NOT NULL DEFAULT 'homzie',
      promoted_type text NOT NULL DEFAULT 'profile',
      objective text NOT NULL DEFAULT 'awareness',
      listing_id uuid REFERENCES property_listings(id) ON DELETE SET NULL,
      reel_id uuid REFERENCES reels(id) ON DELETE SET NULL,
      target_scope text NOT NULL DEFAULT 'custom',
      target_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
      target_location text,
      headline text,
      copy text,
      duration_days integer NOT NULL DEFAULT 14,
      total_budget_cents integer NOT NULL,
      net_media_budget_cents integer NOT NULL,
      platform_margin_basis_points integer NOT NULL DEFAULT 0,
      estimated_reach integer NOT NULL DEFAULT 0,
      estimated_impressions integer NOT NULL DEFAULT 0,
      estimated_clicks integer NOT NULL DEFAULT 0,
      estimated_results integer NOT NULL DEFAULT 0,
      promoted_url text,
      google_sync_status text NOT NULL DEFAULT 'not_applicable',
      google_sync_error text,
      google_last_synced_at timestamptz,
      status text NOT NULL DEFAULT 'draft',
      launched_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS target_scope text NOT NULL DEFAULT 'custom'
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS target_areas jsonb NOT NULL DEFAULT '[]'::jsonb
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS promoted_url text
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS target_location_place_id text
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS target_population_estimate integer NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS target_active_users_estimate integer NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS target_published_listings_estimate integer NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS delivered_spend_cents integer NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS billed_spend_cents integer NOT NULL DEFAULT 0
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS last_spend_synced_at timestamptz
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS paused_at timestamptz
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS resumed_at timestamptz
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS google_sync_status text NOT NULL DEFAULT 'not_applicable'
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS google_sync_error text
  `;

  await sql`
    ALTER TABLE ad_campaigns
    ADD COLUMN IF NOT EXISTS google_last_synced_at timestamptz
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_campaigns_user_id_idx
    ON ad_campaigns (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_campaigns_status_idx
    ON ad_campaigns (status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_campaigns_channel_idx
    ON ad_campaigns (channel)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_campaigns_created_at_idx
    ON ad_campaigns (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ad_invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      period_start timestamptz NOT NULL,
      period_end timestamptz NOT NULL,
      subtotal_cents integer NOT NULL DEFAULT 0,
      credits_cents integer NOT NULL DEFAULT 0,
      total_cents integer NOT NULL DEFAULT 0,
      currency text NOT NULL DEFAULT 'ZAR',
      status text NOT NULL DEFAULT 'open',
      provider_payment_intent_id text,
      provider_charge_id text,
      failure_message text,
      charged_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_invoices_user_id_idx
    ON ad_invoices (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_invoices_status_idx
    ON ad_invoices (status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_invoices_period_start_idx
    ON ad_invoices (period_start)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ad_spend_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      campaign_id uuid NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      invoice_id uuid REFERENCES ad_invoices(id) ON DELETE SET NULL,
      channel text NOT NULL DEFAULT 'homzie',
      entry_type text NOT NULL DEFAULT 'spend',
      amount_cents integer NOT NULL DEFAULT 0,
      description text,
      external_reference text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      occurred_at timestamptz NOT NULL,
      billing_period_start timestamptz NOT NULL,
      billing_period_end timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_spend_ledger_user_id_idx
    ON ad_spend_ledger (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_spend_ledger_campaign_id_idx
    ON ad_spend_ledger (campaign_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_spend_ledger_invoice_id_idx
    ON ad_spend_ledger (invoice_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_spend_ledger_occurred_at_idx
    ON ad_spend_ledger (occurred_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS location_population_cache (
      place_id text PRIMARY KEY,
      label text NOT NULL,
      population_estimate integer NOT NULL DEFAULT 0,
      source text,
      source_entity_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS location_population_cache_updated_at_idx
    ON location_population_cache (updated_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS profile_view_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewer_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      viewer_session_id text NOT NULL,
      source text NOT NULL DEFAULT 'profile_page',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    DELETE FROM profile_view_events a
    USING profile_view_events b
    WHERE a.profile_user_id = b.profile_user_id
      AND a.viewer_session_id = b.viewer_session_id
      AND (
        a.created_at > b.created_at
        OR (a.created_at = b.created_at AND a.id::text > b.id::text)
      )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS profile_view_events_profile_session_unique
    ON profile_view_events (profile_user_id, viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS profile_view_events_profile_user_id_idx
    ON profile_view_events (profile_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS profile_view_events_viewer_user_id_idx
    ON profile_view_events (viewer_user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS profile_view_events_viewer_session_id_idx
    ON profile_view_events (viewer_session_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS profile_view_events_created_at_idx
    ON profile_view_events (created_at)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ad_campaign_delivery_daily (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      campaign_id uuid NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
      channel text NOT NULL DEFAULT 'homzie',
      metric_date date NOT NULL,
      impressions integer NOT NULL DEFAULT 0,
      clicks integer NOT NULL DEFAULT 0,
      results integer NOT NULL DEFAULT 0,
      amount_cents integer NOT NULL DEFAULT 0,
      source text NOT NULL DEFAULT 'homzie_live',
      external_reference text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS ad_campaign_delivery_daily_campaign_date_source_unique
    ON ad_campaign_delivery_daily (campaign_id, metric_date, source)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_campaign_delivery_daily_user_id_idx
    ON ad_campaign_delivery_daily (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS ad_campaign_delivery_daily_metric_date_idx
    ON ad_campaign_delivery_daily (metric_date)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS hashtag_stats (
      tag text PRIMARY KEY,
      reel_count integer NOT NULL DEFAULT 0,
      listing_count integer NOT NULL DEFAULT 0,
      usage_count integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS hashtag_usages (
      tag text NOT NULL REFERENCES hashtag_stats(tag) ON DELETE CASCADE,
      source_type text NOT NULL,
      source_id uuid NOT NULL,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (source_type, source_id, tag)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hashtag_usages_tag_idx ON hashtag_usages (tag)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hashtag_stats_usage_count_idx ON hashtag_stats (usage_count DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS music_tracks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      artist text NOT NULL,
      audio_path text NOT NULL,
      cover_path text,
      duration_seconds integer NOT NULL DEFAULT 0,
      genre text,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS music_tracks_is_active_sort_order_idx
    ON music_tracks (is_active, sort_order)
  `;

  console.log("Database migration completed.");
} finally {
  await sql.end();
}
