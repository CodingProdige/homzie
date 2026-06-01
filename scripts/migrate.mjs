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
    CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS subscriptions_agent_profile_id_idx ON subscriptions (agent_profile_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status)
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
    CREATE INDEX IF NOT EXISTS reels_user_id_idx ON reels (user_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_agent_profile_id_idx ON reels (agent_profile_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS reels_status_idx ON reels (status)
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

  console.log("Database migration completed.");
} finally {
  await sql.end();
}
