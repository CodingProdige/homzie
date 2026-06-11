import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "disabled"]);
export const agentProfileStatusEnum = pgEnum("agent_profile_status", [
  "draft",
  "active",
  "suspended",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "pending",
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  username: text("username").unique(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  location: text("location"),
  locationPlaceId: text("location_place_id"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  whatsappNumber: text("whatsapp_number"),
  publicContactVisible: boolean("public_contact_visible").notNull().default(true),
  profileVisible: boolean("profile_visible").notNull().default(true),
  searchVisible: boolean("search_visible").notNull().default(true),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("active"),
  emailVerified: boolean("email_verified").notNull().default(false),
  agentTrialUsedAt: timestamp("agent_trial_used_at", { withTimezone: true }),
  adsBillingAnchorAt: timestamp("ads_billing_anchor_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentProfiles = pgTable("agent_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  displayName: text("display_name").notNull(),
  headline: text("headline"),
  bio: text("bio"),
  location: text("location"),
  status: agentProfileStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agentProfileId: uuid("agent_profile_id").references(() => agentProfiles.id, {
    onDelete: "set null",
  }),
  provider: text("provider").notNull().default("stripe"),
  status: subscriptionStatusEnum("status").notNull().default("pending"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("ZAR"),
  interval: text("interval").notNull().default("month"),
  providerCustomerId: text("provider_customer_id"),
  providerCheckoutId: text("provider_checkout_id"),
  providerTransactionId: text("provider_transaction_id"),
  providerReference: text("provider_reference").notNull().unique(),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  retentionOfferAcceptedAt: timestamp("retention_offer_accepted_at", {
    withTimezone: true,
  }),
  retentionOfferExpiresAt: timestamp("retention_offer_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const propertyIdentities = pgTable(
  "property_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    normalizedAddress: text("normalized_address"),
    googlePlaceId: text("google_place_id"),
    country: text("country"),
    city: text("city"),
    suburb: text("suburb"),
    propertyType: text("property_type"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    sizeSquareMeters: integer("size_square_meters"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("property_identities_google_place_id_idx").on(table.googlePlaceId),
    index("property_identities_location_idx").on(table.country, table.city, table.suburb),
    index("property_identities_normalized_address_idx").on(table.normalizedAddress),
  ],
);

export const propertyListings = pgTable(
  "property_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentProfileId: uuid("agent_profile_id").references(() => agentProfiles.id, {
      onDelete: "set null",
    }),
    propertyIdentityId: uuid("property_identity_id").references(
      () => propertyIdentities.id,
      {
        onDelete: "set null",
      },
    ),
    listingType: text("listing_type").notNull().default("sale"),
    propertyType: text("property_type").notNull().default("free_standing_house"),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    priceLabel: text("price_label"),
    askingPriceCents: integer("asking_price_cents"),
    soldPriceCents: integer("sold_price_cents"),
    reservationEnabled: boolean("reservation_enabled").notNull().default(false),
    reservationAmountCents: integer("reservation_amount_cents"),
    activeReservationId: uuid("active_reservation_id"),
    coverImageUrl: text("cover_image_url"),
    media: jsonb("media"),
    details: jsonb("details"),
    features: jsonb("features"),
    mandateType: text("mandate_type").notNull().default("open"),
    mandateStartDate: timestamp("mandate_start_date", { withTimezone: true }),
    mandateEndDate: timestamp("mandate_end_date", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    proofStatus: text("proof_status").notNull().default("not_required"),
    listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    proofRequestedAt: timestamp("proof_requested_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("property_listings_user_id_idx").on(table.userId),
    index("property_listings_agent_profile_id_idx").on(table.agentProfileId),
    index("property_listings_property_identity_id_idx").on(table.propertyIdentityId),
    index("property_listings_status_idx").on(table.status),
    index("property_listings_active_reservation_id_idx").on(
      table.activeReservationId,
    ),
    index("property_listings_outcome_at_idx").on(table.outcomeAt),
    index("property_listings_sold_at_idx").on(table.soldAt),
  ],
);

export const listingReservations = pgTable(
  "listing_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentUserId: uuid("agent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull().default(0),
    processingFeeCents: integer("processing_fee_cents").notNull().default(0),
    totalPaidCents: integer("total_paid_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("pending"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    releaseStatus: text("release_status").notNull().default("held"),
    cancelledReason: text("cancelled_reason"),
    documentRequestSentAt: timestamp("document_request_sent_at", {
      withTimezone: true,
    }),
    documentsReceivedAt: timestamp("documents_received_at", {
      withTimezone: true,
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    releaseApprovedAt: timestamp("release_approved_at", { withTimezone: true }),
    releasedByUserId: uuid("released_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    transferAmountCents: integer("transfer_amount_cents"),
    transferReference: text("transfer_reference"),
    proofOfTransferUrl: text("proof_of_transfer_url"),
    adminNotes: text("admin_notes"),
    agentNotes: text("agent_notes"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("listing_reservations_listing_id_idx").on(table.listingId),
    index("listing_reservations_buyer_user_id_idx").on(table.buyerUserId),
    index("listing_reservations_agent_user_id_idx").on(table.agentUserId),
    index("listing_reservations_reviewed_by_user_id_idx").on(
      table.reviewedByUserId,
    ),
    index("listing_reservations_released_by_user_id_idx").on(
      table.releasedByUserId,
    ),
    index("listing_reservations_status_idx").on(table.status),
    uniqueIndex("listing_reservations_checkout_session_idx").on(
      table.stripeCheckoutSessionId,
    ),
  ],
);

export const propertySaleClaims = pgTable(
  "property_sale_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyIdentityId: uuid("property_identity_id").references(
      () => propertyIdentities.id,
      { onDelete: "set null" },
    ),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    outcomeType: text("outcome_type").notNull().default("sold_by_agent"),
    claimStatus: text("claim_status").notNull().default("pending"),
    proofStatus: text("proof_status").notNull().default("pending"),
    proofSummary: text("proof_summary"),
    soldPriceCents: integer("sold_price_cents"),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("property_sale_claims_listing_id_idx").on(table.listingId),
    index("property_sale_claims_property_identity_id_idx").on(table.propertyIdentityId),
    index("property_sale_claims_user_id_idx").on(table.userId),
    index("property_sale_claims_claim_status_idx").on(table.claimStatus),
  ],
);

export const propertySaleDisputes = pgTable(
  "property_sale_disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyIdentityId: uuid("property_identity_id").references(
      () => propertyIdentities.id,
      { onDelete: "set null" },
    ),
    status: text("status").notNull().default("pending"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("property_sale_disputes_property_identity_id_idx").on(
      table.propertyIdentityId,
    ),
    index("property_sale_disputes_status_idx").on(table.status),
  ],
);

export const propertyListingStatusHistory = pgTable(
  "property_listing_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("property_listing_status_history_listing_id_idx").on(table.listingId),
    index("property_listing_status_history_user_id_idx").on(table.userId),
  ],
);

export const reels = pgTable("reels", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  agentProfileId: uuid("agent_profile_id").references(() => agentProfiles.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("draft"),
  videoPath: text("video_path").notNull(),
  caption: text("caption"),
  hashtags: text("hashtags"),
  listingId: uuid("listing_id").references(() => propertyListings.id, {
    onDelete: "set null",
  }),
  listingReference: text("listing_reference"),
  soundId: text("sound_id").notNull().default("original"),
  trimStartSeconds: integer("trim_start_seconds").notNull().default(0),
  trimEndSeconds: integer("trim_end_seconds").notNull().default(0),
  coverTimeSeconds: integer("cover_time_seconds").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  editMetadata: jsonb("edit_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const platformVisitorSessions = pgTable(
  "platform_visitor_sessions",
  {
    id: text("id").primaryKey(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("platform_visitor_sessions_last_seen_at_idx").on(table.lastSeenAt),
  ],
);

export const reelWatchSessions = pgTable(
  "reel_watch_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerSessionId: text("viewer_session_id").notNull(),
    source: text("source").notNull().default("feed"),
    lastProgressSeconds: integer("last_progress_seconds").notNull().default(0),
    maxProgressSeconds: integer("max_progress_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    maxProgressPercent: integer("max_progress_percent").notNull().default(0),
    totalWatchSeconds: integer("total_watch_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    lastWatchedAt: timestamp("last_watched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reel_watch_sessions_reel_session_unique").on(
      table.reelId,
      table.viewerSessionId,
    ),
    index("reel_watch_sessions_reel_id_idx").on(table.reelId),
    index("reel_watch_sessions_viewer_user_id_idx").on(table.viewerUserId),
    index("reel_watch_sessions_last_watched_at_idx").on(table.lastWatchedAt),
  ],
);

export const reelWatchEvents = pgTable(
  "reel_watch_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerSessionId: text("viewer_session_id").notNull(),
    eventType: text("event_type").notNull(),
    source: text("source").notNull().default("feed"),
    progressSeconds: integer("progress_seconds").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    watchSeconds: integer("watch_seconds").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reel_watch_events_reel_id_idx").on(table.reelId),
    index("reel_watch_events_viewer_user_id_idx").on(table.viewerUserId),
    index("reel_watch_events_viewer_session_id_idx").on(table.viewerSessionId),
    index("reel_watch_events_created_at_idx").on(table.createdAt),
  ],
);

export const reelFeedback = pgTable(
  "reel_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerSessionId: text("viewer_session_id").notNull(),
    feedbackType: text("feedback_type").notNull(),
    source: text("source").notNull().default("feed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("reel_feedback_reel_session_type_unique").on(
      table.reelId,
      table.viewerSessionId,
      table.feedbackType,
    ),
    index("reel_feedback_reel_id_idx").on(table.reelId),
    index("reel_feedback_viewer_user_id_idx").on(table.viewerUserId),
    index("reel_feedback_viewer_session_id_idx").on(table.viewerSessionId),
    index("reel_feedback_feedback_type_idx").on(table.feedbackType),
    index("reel_feedback_created_at_idx").on(table.createdAt),
  ],
);

export const reelListingClicks = pgTable(
  "reel_listing_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerSessionId: text("viewer_session_id").notNull(),
    source: text("source").notNull().default("feed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reel_listing_clicks_reel_id_idx").on(table.reelId),
    index("reel_listing_clicks_listing_id_idx").on(table.listingId),
    index("reel_listing_clicks_viewer_user_id_idx").on(table.viewerUserId),
    index("reel_listing_clicks_viewer_session_id_idx").on(table.viewerSessionId),
    index("reel_listing_clicks_created_at_idx").on(table.createdAt),
  ],
);

export const listingViewEvents = pgTable(
  "listing_view_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerSessionId: text("viewer_session_id").notNull(),
    source: text("source").notNull().default("listing_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("listing_view_events_listing_id_idx").on(table.listingId),
    index("listing_view_events_viewer_user_id_idx").on(table.viewerUserId),
    index("listing_view_events_viewer_session_id_idx").on(table.viewerSessionId),
    index("listing_view_events_created_at_idx").on(table.createdAt),
  ],
);

export const listingActionEvents = pgTable(
  "listing_action_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerSessionId: text("viewer_session_id").notNull(),
    actionType: text("action_type").notNull(),
    source: text("source").notNull().default("listing_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("listing_action_events_listing_id_idx").on(table.listingId),
    index("listing_action_events_viewer_user_id_idx").on(table.viewerUserId),
    index("listing_action_events_viewer_session_id_idx").on(table.viewerSessionId),
    index("listing_action_events_action_type_idx").on(table.actionType),
    index("listing_action_events_created_at_idx").on(table.createdAt),
  ],
);

export const profileViewEvents = pgTable(
  "profile_view_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileUserId: uuid("profile_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    viewerUserId: uuid("viewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    viewerSessionId: text("viewer_session_id").notNull(),
    source: text("source").notNull().default("profile_page"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("profile_view_events_profile_session_unique").on(
      table.profileUserId,
      table.viewerSessionId,
    ),
    index("profile_view_events_profile_user_id_idx").on(table.profileUserId),
    index("profile_view_events_viewer_user_id_idx").on(table.viewerUserId),
    index("profile_view_events_viewer_session_id_idx").on(table.viewerSessionId),
    index("profile_view_events_created_at_idx").on(table.createdAt),
  ],
);

export const userFollows = pgTable(
  "user_follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.followerId, table.followingId],
    }),
    index("user_follows_follower_id_idx").on(table.followerId),
    index("user_follows_following_id_idx").on(table.followingId),
  ],
);

export const reelLikes = pgTable(
  "reel_likes",
  {
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.reelId, table.userId],
    }),
    index("reel_likes_user_id_idx").on(table.userId),
  ],
);

export const reelSaves = pgTable(
  "reel_saves",
  {
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.reelId, table.userId],
    }),
    index("reel_saves_user_id_idx").on(table.userId),
  ],
);

export const listingSaves = pgTable(
  "listing_saves",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.listingId, table.userId],
    }),
    index("listing_saves_listing_id_idx").on(table.listingId),
    index("listing_saves_user_id_idx").on(table.userId),
  ],
);

export const listingLikes = pgTable(
  "listing_likes",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.listingId, table.userId],
    }),
    index("listing_likes_listing_id_idx").on(table.listingId),
    index("listing_likes_user_id_idx").on(table.userId),
  ],
);

export const reelReshares = pgTable(
  "reel_reshares",
  {
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.reelId, table.userId],
    }),
    index("reel_reshares_reel_id_idx").on(table.reelId),
    index("reel_reshares_user_id_idx").on(table.userId),
    index("reel_reshares_created_at_idx").on(table.createdAt),
  ],
);

export const reelComments = pgTable(
  "reel_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reelId: uuid("reel_id")
      .notNull()
      .references(() => reels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => reelComments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    mediaUrl: text("media_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("reel_comments_reel_id_idx").on(table.reelId),
    index("reel_comments_parent_id_idx").on(table.parentId),
    index("reel_comments_user_id_idx").on(table.userId),
    index("reel_comments_created_at_idx").on(table.createdAt),
  ],
);

export const reelCommentLikes = pgTable(
  "reel_comment_likes",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => reelComments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.commentId, table.userId],
    }),
    index("reel_comment_likes_user_id_idx").on(table.userId),
  ],
);

export const reelCommentDislikes = pgTable(
  "reel_comment_dislikes",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => reelComments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.commentId, table.userId],
    }),
    index("reel_comment_dislikes_user_id_idx").on(table.userId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull().default("direct"),
    status: text("status").notNull().default("active"),
    title: text("title"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    listingId: uuid("listing_id").references(() => propertyListings.id, {
      onDelete: "set null",
    }),
    lastMessageId: uuid("last_message_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("conversations_created_by_user_id_idx").on(table.createdByUserId),
    index("conversations_listing_id_idx").on(table.listingId),
    index("conversations_last_message_at_idx").on(table.lastMessageAt),
    index("conversations_status_idx").on(table.status),
  ],
);

export const conversationParticipants = pgTable(
  "conversation_participants",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    inbox: text("inbox").notNull().default("primary"),
    mutedAt: timestamp("muted_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.conversationId, table.userId],
    }),
    index("conversation_participants_user_id_idx").on(table.userId),
    index("conversation_participants_inbox_idx").on(table.inbox),
    index("conversation_participants_last_read_at_idx").on(table.lastReadAt),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull().default("text"),
    body: text("body"),
    metadata: jsonb("metadata"),
    clientId: text("client_id"),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("messages_client_id_idx").on(table.clientId),
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_sender_user_id_idx").on(table.senderUserId),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_type_idx").on(table.type),
  ],
);

export const messageReceipts = pgTable(
  "message_receipts",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.messageId, table.userId],
    }),
    index("message_receipts_user_id_idx").on(table.userId),
    index("message_receipts_delivered_at_idx").on(table.deliveredAt),
    index("message_receipts_read_at_idx").on(table.readAt),
  ],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    url: text("url"),
    title: text("title"),
    previewImageUrl: text("preview_image_url"),
    listingId: uuid("listing_id").references(() => propertyListings.id, {
      onDelete: "set null",
    }),
    reelId: uuid("reel_id").references(() => reels.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("message_attachments_message_id_idx").on(table.messageId),
    index("message_attachments_listing_id_idx").on(table.listingId),
    index("message_attachments_reel_id_idx").on(table.reelId),
  ],
);

export const propertyOffers = pgTable(
  "property_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => propertyListings.id, { onDelete: "cascade" }),
    buyerUserId: uuid("buyer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentUserId: uuid("agent_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("ZAR"),
    note: text("note"),
    status: text("status").notNull().default("pending"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("property_offers_conversation_id_idx").on(table.conversationId),
    index("property_offers_listing_id_idx").on(table.listingId),
    index("property_offers_buyer_user_id_idx").on(table.buyerUserId),
    index("property_offers_agent_user_id_idx").on(table.agentUserId),
    index("property_offers_status_idx").on(table.status),
  ],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerUserId: uuid("blocker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.blockerUserId, table.blockedUserId],
    }),
    index("user_blocks_blocked_user_id_idx").on(table.blockedUserId),
  ],
);

export const messageReports = pgTable(
  "message_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: uuid("reported_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("message_reports_reporter_user_id_idx").on(table.reporterUserId),
    index("message_reports_reported_user_id_idx").on(table.reportedUserId),
    index("message_reports_conversation_id_idx").on(table.conversationId),
    index("message_reports_status_idx").on(table.status),
  ],
);

export const callSessions = pgTable(
  "call_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    startedByUserId: uuid("started_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull().default("audio"),
    status: text("status").notNull().default("ringing"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedByUserId: uuid("ended_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("call_sessions_conversation_id_idx").on(table.conversationId),
    index("call_sessions_started_by_user_id_idx").on(table.startedByUserId),
    index("call_sessions_status_idx").on(table.status),
  ],
);

export const userEvents = pgTable(
  "user_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    listingId: uuid("listing_id").references(() => propertyListings.id, {
      onDelete: "set null",
    }),
    reelId: uuid("reel_id").references(() => reels.id, { onDelete: "set null" }),
    metadata: jsonb("metadata"),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_events_user_id_idx").on(table.userId),
    index("user_events_actor_user_id_idx").on(table.actorUserId),
    index("user_events_event_type_idx").on(table.eventType),
    index("user_events_seen_at_idx").on(table.seenAt),
    index("user_events_created_at_idx").on(table.createdAt),
  ],
);

export const webPushSubscriptions = pgTable(
  "web_push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("web_push_subscriptions_endpoint_idx").on(table.endpoint),
    index("web_push_subscriptions_user_id_idx").on(table.userId),
  ],
);

export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    messagesEnabled: boolean("messages_enabled").notNull().default(true),
    callsEnabled: boolean("calls_enabled").notNull().default(true),
    offersEnabled: boolean("offers_enabled").notNull().default(true),
    listingActivityEnabled: boolean("listing_activity_enabled")
      .notNull()
      .default(true),
    reelActivityEnabled: boolean("reel_activity_enabled").notNull().default(true),
    profileActivityEnabled: boolean("profile_activity_enabled")
      .notNull()
      .default(true),
    marketingEnabled: boolean("marketing_enabled").notNull().default(false),
    emailEventPreferences: jsonb("email_event_preferences")
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_notification_preferences_updated_at_idx").on(table.updatedAt),
  ],
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    category: text("category").notNull().default("general"),
    description: text("description"),
    subject: text("subject").notNull(),
    preheader: text("preheader"),
    html: text("html").notNull(),
    text: text("text").notNull(),
    variables: jsonb("variables").notNull().default([]),
    sampleVariables: jsonb("sample_variables").notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("email_templates_key_idx").on(table.key),
    index("email_templates_category_idx").on(table.category),
    index("email_templates_enabled_idx").on(table.enabled),
  ],
);

export const emailTemplateVersions = pgTable(
  "email_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    preheader: text("preheader"),
    html: text("html").notNull(),
    text: text("text").notNull(),
    variables: jsonb("variables").notNull().default([]),
    sampleVariables: jsonb("sample_variables").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("email_template_versions_template_id_idx").on(table.templateId),
    index("email_template_versions_created_at_idx").on(table.createdAt),
  ],
);

export const emailDeliveryLogs = pgTable(
  "email_delivery_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateKey: text("template_key").notNull(),
    eventKey: text("event_key").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject"),
    provider: text("provider").notNull().default("sendgrid"),
    providerMessageId: text("provider_message_id"),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    variables: jsonb("variables").notNull().default({}),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("email_delivery_logs_template_key_idx").on(table.templateKey),
    index("email_delivery_logs_event_key_idx").on(table.eventKey),
    index("email_delivery_logs_user_id_idx").on(table.userId),
    index("email_delivery_logs_status_idx").on(table.status),
    index("email_delivery_logs_created_at_idx").on(table.createdAt),
  ],
);

export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: text("channel").notNull().default("homzie"),
    promotedType: text("promoted_type").notNull().default("profile"),
    objective: text("objective").notNull().default("awareness"),
    listingId: uuid("listing_id").references(() => propertyListings.id, {
      onDelete: "set null",
    }),
    reelId: uuid("reel_id").references(() => reels.id, {
      onDelete: "set null",
    }),
    targetScope: text("target_scope").notNull().default("custom"),
    targetAreas: jsonb("target_areas").notNull().default([]),
    targetLocation: text("target_location"),
    targetLocationPlaceId: text("target_location_place_id"),
    targetPopulationEstimate: integer("target_population_estimate")
      .notNull()
      .default(0),
    targetActiveUsersEstimate: integer("target_active_users_estimate")
      .notNull()
      .default(0),
    targetPublishedListingsEstimate: integer("target_published_listings_estimate")
      .notNull()
      .default(0),
    headline: text("headline"),
    copy: text("copy"),
    durationDays: integer("duration_days").notNull().default(14),
    totalBudgetCents: integer("total_budget_cents").notNull(),
    netMediaBudgetCents: integer("net_media_budget_cents").notNull(),
    platformMarginBasisPoints: integer("platform_margin_basis_points")
      .notNull()
      .default(0),
    estimatedReach: integer("estimated_reach").notNull().default(0),
    estimatedImpressions: integer("estimated_impressions").notNull().default(0),
    estimatedClicks: integer("estimated_clicks").notNull().default(0),
    estimatedResults: integer("estimated_results").notNull().default(0),
    deliveredSpendCents: integer("delivered_spend_cents").notNull().default(0),
    billedSpendCents: integer("billed_spend_cents").notNull().default(0),
    lastSpendSyncedAt: timestamp("last_spend_synced_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    promotedUrl: text("promoted_url"),
    googleSyncStatus: text("google_sync_status").notNull().default("not_applicable"),
    googleSyncError: text("google_sync_error"),
    googleLastSyncedAt: timestamp("google_last_synced_at", { withTimezone: true }),
    status: text("status").notNull().default("draft"),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ad_campaigns_user_id_idx").on(table.userId),
    index("ad_campaigns_status_idx").on(table.status),
    index("ad_campaigns_channel_idx").on(table.channel),
    index("ad_campaigns_created_at_idx").on(table.createdAt),
  ],
);

export const adInvoices = pgTable(
  "ad_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    creditsCents: integer("credits_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    currency: text("currency").notNull().default("ZAR"),
    status: text("status").notNull().default("open"),
    providerPaymentIntentId: text("provider_payment_intent_id"),
    providerChargeId: text("provider_charge_id"),
    failureMessage: text("failure_message"),
    chargedAt: timestamp("charged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ad_invoices_user_id_idx").on(table.userId),
    index("ad_invoices_status_idx").on(table.status),
    index("ad_invoices_period_start_idx").on(table.periodStart),
  ],
);

export const adSpendLedger = pgTable(
  "ad_spend_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => adInvoices.id, {
      onDelete: "set null",
    }),
    channel: text("channel").notNull().default("homzie"),
    entryType: text("entry_type").notNull().default("spend"),
    amountCents: integer("amount_cents").notNull().default(0),
    description: text("description"),
    externalReference: text("external_reference"),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    billingPeriodStart: timestamp("billing_period_start", {
      withTimezone: true,
    }).notNull(),
    billingPeriodEnd: timestamp("billing_period_end", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ad_spend_ledger_user_id_idx").on(table.userId),
    index("ad_spend_ledger_campaign_id_idx").on(table.campaignId),
    index("ad_spend_ledger_invoice_id_idx").on(table.invoiceId),
    index("ad_spend_ledger_occurred_at_idx").on(table.occurredAt),
  ],
);

export const adCampaignDeliveryDaily = pgTable(
  "ad_campaign_delivery_daily",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("homzie"),
    metricDate: date("metric_date").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    results: integer("results").notNull().default(0),
    amountCents: integer("amount_cents").notNull().default(0),
    source: text("source").notNull().default("homzie_live"),
    externalReference: text("external_reference"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ad_campaign_delivery_daily_campaign_date_source_unique").on(
      table.campaignId,
      table.metricDate,
      table.source,
    ),
    index("ad_campaign_delivery_daily_user_id_idx").on(table.userId),
    index("ad_campaign_delivery_daily_metric_date_idx").on(table.metricDate),
  ],
);

export const locationPopulationCache = pgTable(
  "location_population_cache",
  {
    placeId: text("place_id").primaryKey(),
    label: text("label").notNull(),
    populationEstimate: integer("population_estimate").notNull().default(0),
    source: text("source"),
    sourceEntityId: text("source_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("location_population_cache_updated_at_idx").on(table.updatedAt)],
);

export const hashtagStats = pgTable("hashtag_stats", {
  tag: text("tag").primaryKey(),
  reelCount: integer("reel_count").notNull().default(0),
  listingCount: integer("listing_count").notNull().default(0),
  usageCount: integer("usage_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hashtagUsages = pgTable(
  "hashtag_usages",
  {
    tag: text("tag")
      .notNull()
      .references(() => hashtagStats.tag, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.sourceType, table.sourceId, table.tag],
    }),
  ],
);

export const musicTracks = pgTable(
  "music_tracks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    audioPath: text("audio_path").notNull(),
    coverPath: text("cover_path"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    genre: text("genre"),
    tags: jsonb("tags").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("music_tracks_is_active_sort_order_idx").on(table.isActive, table.sortOrder),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  agentProfile: one(agentProfiles),
  followedProfiles: many(userFollows, { relationName: "follower" }),
  followers: many(userFollows, { relationName: "following" }),
  reelCommentDislikes: many(reelCommentDislikes),
  reelCommentLikes: many(reelCommentLikes),
  reelComments: many(reelComments),
  reelFeedback: many(reelFeedback),
  reelLikes: many(reelLikes),
  reelReshares: many(reelReshares),
  reelSaves: many(reelSaves),
  listingLikes: many(listingLikes),
  listingSaves: many(listingSaves),
  reelWatchEvents: many(reelWatchEvents),
  reelWatchSessions: many(reelWatchSessions),
  profileViewEvents: many(profileViewEvents, { relationName: "profileOwner" }),
  recordedProfileViews: many(profileViewEvents, { relationName: "profileViewer" }),
  notificationPreferences: one(userNotificationPreferences),
  passwordResetTokens: many(passwordResetTokens),
  adCampaigns: many(adCampaigns),
  adCampaignDeliveryDaily: many(adCampaignDeliveryDaily),
  adInvoices: many(adInvoices),
  adSpendLedgerEntries: many(adSpendLedger),
  subscriptions: many(subscriptions),
  propertyIdentities: many(propertyIdentities),
  propertyListings: many(propertyListings),
  propertySaleClaims: many(propertySaleClaims),
  propertyListingStatusHistory: many(propertyListingStatusHistory),
  reels: many(reels),
}));

export const agentProfilesRelations = relations(agentProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [agentProfiles.userId],
    references: [users.id],
  }),
  subscriptions: many(subscriptions),
  propertyListings: many(propertyListings),
  reels: many(reels),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  agentProfile: one(agentProfiles, {
    fields: [subscriptions.agentProfileId],
    references: [agentProfiles.id],
  }),
}));

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const userNotificationPreferencesRelations = relations(
  userNotificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userNotificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const adCampaignsRelations = relations(adCampaigns, ({ one }) => ({
  user: one(users, {
    fields: [adCampaigns.userId],
    references: [users.id],
  }),
  listing: one(propertyListings, {
    fields: [adCampaigns.listingId],
    references: [propertyListings.id],
  }),
  reel: one(reels, {
    fields: [adCampaigns.reelId],
    references: [reels.id],
  }),
}));

export const adInvoicesRelations = relations(adInvoices, ({ many, one }) => ({
  user: one(users, {
    fields: [adInvoices.userId],
    references: [users.id],
  }),
  ledgerEntries: many(adSpendLedger),
}));

export const adCampaignDeliveryDailyRelations = relations(
  adCampaignDeliveryDaily,
  ({ one }) => ({
    user: one(users, {
      fields: [adCampaignDeliveryDaily.userId],
      references: [users.id],
    }),
    campaign: one(adCampaigns, {
      fields: [adCampaignDeliveryDaily.campaignId],
      references: [adCampaigns.id],
    }),
  }),
);

export const adSpendLedgerRelations = relations(adSpendLedger, ({ one }) => ({
  user: one(users, {
    fields: [adSpendLedger.userId],
    references: [users.id],
  }),
  campaign: one(adCampaigns, {
    fields: [adSpendLedger.campaignId],
    references: [adCampaigns.id],
  }),
  invoice: one(adInvoices, {
    fields: [adSpendLedger.invoiceId],
    references: [adInvoices.id],
  }),
}));

export const propertyIdentitiesRelations = relations(
  propertyIdentities,
  ({ many }) => ({
    listings: many(propertyListings),
    saleClaims: many(propertySaleClaims),
    saleDisputes: many(propertySaleDisputes),
  }),
);

export const propertyListingsRelations = relations(propertyListings, ({ one, many }) => ({
  user: one(users, {
    fields: [propertyListings.userId],
    references: [users.id],
  }),
  agentProfile: one(agentProfiles, {
    fields: [propertyListings.agentProfileId],
    references: [agentProfiles.id],
  }),
  propertyIdentity: one(propertyIdentities, {
    fields: [propertyListings.propertyIdentityId],
    references: [propertyIdentities.id],
  }),
  saleClaim: one(propertySaleClaims),
  statusHistory: many(propertyListingStatusHistory),
  saves: many(listingSaves),
  likes: many(listingLikes),
  actionEvents: many(listingActionEvents),
  viewEvents: many(listingViewEvents),
  reels: many(reels),
}));

export const propertySaleClaimsRelations = relations(propertySaleClaims, ({ one }) => ({
  propertyIdentity: one(propertyIdentities, {
    fields: [propertySaleClaims.propertyIdentityId],
    references: [propertyIdentities.id],
  }),
  listing: one(propertyListings, {
    fields: [propertySaleClaims.listingId],
    references: [propertyListings.id],
  }),
  user: one(users, {
    fields: [propertySaleClaims.userId],
    references: [users.id],
  }),
}));

export const propertySaleDisputesRelations = relations(
  propertySaleDisputes,
  ({ one }) => ({
    propertyIdentity: one(propertyIdentities, {
      fields: [propertySaleDisputes.propertyIdentityId],
      references: [propertyIdentities.id],
    }),
  }),
);

export const propertyListingStatusHistoryRelations = relations(
  propertyListingStatusHistory,
  ({ one }) => ({
    listing: one(propertyListings, {
      fields: [propertyListingStatusHistory.listingId],
      references: [propertyListings.id],
    }),
    user: one(users, {
      fields: [propertyListingStatusHistory.userId],
      references: [users.id],
    }),
  }),
);

export const reelsRelations = relations(reels, ({ one, many }) => ({
  user: one(users, {
    fields: [reels.userId],
    references: [users.id],
  }),
  agentProfile: one(agentProfiles, {
    fields: [reels.agentProfileId],
    references: [agentProfiles.id],
  }),
  linkedListing: one(propertyListings, {
    fields: [reels.listingId],
    references: [propertyListings.id],
  }),
  feedback: many(reelFeedback),
  listingClicks: many(reelListingClicks),
  watchEvents: many(reelWatchEvents),
  watchSessions: many(reelWatchSessions),
  likes: many(reelLikes),
  reshares: many(reelReshares),
  saves: many(reelSaves),
  comments: many(reelComments),
}));

export const reelWatchSessionsRelations = relations(reelWatchSessions, ({ one }) => ({
  reel: one(reels, {
    fields: [reelWatchSessions.reelId],
    references: [reels.id],
  }),
  viewer: one(users, {
    fields: [reelWatchSessions.viewerUserId],
    references: [users.id],
  }),
}));

export const reelWatchEventsRelations = relations(reelWatchEvents, ({ one }) => ({
  reel: one(reels, {
    fields: [reelWatchEvents.reelId],
    references: [reels.id],
  }),
  viewer: one(users, {
    fields: [reelWatchEvents.viewerUserId],
    references: [users.id],
  }),
}));

export const reelFeedbackRelations = relations(reelFeedback, ({ one }) => ({
  reel: one(reels, {
    fields: [reelFeedback.reelId],
    references: [reels.id],
  }),
  viewer: one(users, {
    fields: [reelFeedback.viewerUserId],
    references: [users.id],
  }),
}));

export const reelListingClicksRelations = relations(reelListingClicks, ({ one }) => ({
  listing: one(propertyListings, {
    fields: [reelListingClicks.listingId],
    references: [propertyListings.id],
  }),
  reel: one(reels, {
    fields: [reelListingClicks.reelId],
    references: [reels.id],
  }),
  viewer: one(users, {
    fields: [reelListingClicks.viewerUserId],
    references: [users.id],
  }),
}));

export const listingViewEventsRelations = relations(
  listingViewEvents,
  ({ one }) => ({
    listing: one(propertyListings, {
      fields: [listingViewEvents.listingId],
      references: [propertyListings.id],
    }),
    viewer: one(users, {
      fields: [listingViewEvents.viewerUserId],
      references: [users.id],
    }),
  }),
);

export const listingActionEventsRelations = relations(
  listingActionEvents,
  ({ one }) => ({
    listing: one(propertyListings, {
      fields: [listingActionEvents.listingId],
      references: [propertyListings.id],
    }),
    viewer: one(users, {
      fields: [listingActionEvents.viewerUserId],
      references: [users.id],
    }),
  }),
);

export const profileViewEventsRelations = relations(profileViewEvents, ({ one }) => ({
  profileUser: one(users, {
    fields: [profileViewEvents.profileUserId],
    references: [users.id],
    relationName: "profileOwner",
  }),
  viewer: one(users, {
    fields: [profileViewEvents.viewerUserId],
    references: [users.id],
    relationName: "profileViewer",
  }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, {
    fields: [userFollows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [userFollows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));

export const reelLikesRelations = relations(reelLikes, ({ one }) => ({
  reel: one(reels, {
    fields: [reelLikes.reelId],
    references: [reels.id],
  }),
  user: one(users, {
    fields: [reelLikes.userId],
    references: [users.id],
  }),
}));

export const reelSavesRelations = relations(reelSaves, ({ one }) => ({
  reel: one(reels, {
    fields: [reelSaves.reelId],
    references: [reels.id],
  }),
  user: one(users, {
    fields: [reelSaves.userId],
    references: [users.id],
  }),
}));

export const listingSavesRelations = relations(listingSaves, ({ one }) => ({
  listing: one(propertyListings, {
    fields: [listingSaves.listingId],
    references: [propertyListings.id],
  }),
  user: one(users, {
    fields: [listingSaves.userId],
    references: [users.id],
  }),
}));

export const listingLikesRelations = relations(listingLikes, ({ one }) => ({
  listing: one(propertyListings, {
    fields: [listingLikes.listingId],
    references: [propertyListings.id],
  }),
  user: one(users, {
    fields: [listingLikes.userId],
    references: [users.id],
  }),
}));

export const reelResharesRelations = relations(reelReshares, ({ one }) => ({
  reel: one(reels, {
    fields: [reelReshares.reelId],
    references: [reels.id],
  }),
  user: one(users, {
    fields: [reelReshares.userId],
    references: [users.id],
  }),
}));

export const reelCommentsRelations = relations(reelComments, ({ one, many }) => ({
  reel: one(reels, {
    fields: [reelComments.reelId],
    references: [reels.id],
  }),
  user: one(users, {
    fields: [reelComments.userId],
    references: [users.id],
  }),
  parent: one(reelComments, {
    fields: [reelComments.parentId],
    references: [reelComments.id],
    relationName: "commentReplies",
  }),
  replies: many(reelComments, { relationName: "commentReplies" }),
  dislikes: many(reelCommentDislikes),
  likes: many(reelCommentLikes),
}));

export const reelCommentDislikesRelations = relations(
  reelCommentDislikes,
  ({ one }) => ({
    comment: one(reelComments, {
      fields: [reelCommentDislikes.commentId],
      references: [reelComments.id],
    }),
    user: one(users, {
      fields: [reelCommentDislikes.userId],
      references: [users.id],
    }),
  }),
);

export const reelCommentLikesRelations = relations(reelCommentLikes, ({ one }) => ({
  comment: one(reelComments, {
    fields: [reelCommentLikes.commentId],
    references: [reelComments.id],
  }),
  user: one(users, {
    fields: [reelCommentLikes.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type NewAgentProfile = typeof agentProfiles.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type UserNotificationPreferences =
  typeof userNotificationPreferences.$inferSelect;
export type NewUserNotificationPreferences =
  typeof userNotificationPreferences.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type EmailDeliveryLog = typeof emailDeliveryLogs.$inferSelect;
export type NewEmailDeliveryLog = typeof emailDeliveryLogs.$inferInsert;
export type AdCampaign = typeof adCampaigns.$inferSelect;
export type NewAdCampaign = typeof adCampaigns.$inferInsert;
export type Reel = typeof reels.$inferSelect;
export type NewReel = typeof reels.$inferInsert;
export type PropertyListing = typeof propertyListings.$inferSelect;
export type NewPropertyListing = typeof propertyListings.$inferInsert;
export type PropertyIdentity = typeof propertyIdentities.$inferSelect;
export type NewPropertyIdentity = typeof propertyIdentities.$inferInsert;
export type PropertySaleClaim = typeof propertySaleClaims.$inferSelect;
export type NewPropertySaleClaim = typeof propertySaleClaims.$inferInsert;
export type PropertySaleDispute = typeof propertySaleDisputes.$inferSelect;
export type NewPropertySaleDispute = typeof propertySaleDisputes.$inferInsert;
export type PropertyListingStatusHistory =
  typeof propertyListingStatusHistory.$inferSelect;
export type NewPropertyListingStatusHistory =
  typeof propertyListingStatusHistory.$inferInsert;
export type ReelWatchSession = typeof reelWatchSessions.$inferSelect;
export type NewReelWatchSession = typeof reelWatchSessions.$inferInsert;
export type ReelWatchEvent = typeof reelWatchEvents.$inferSelect;
export type NewReelWatchEvent = typeof reelWatchEvents.$inferInsert;
export type ReelFeedback = typeof reelFeedback.$inferSelect;
export type NewReelFeedback = typeof reelFeedback.$inferInsert;
export type ReelListingClick = typeof reelListingClicks.$inferSelect;
export type NewReelListingClick = typeof reelListingClicks.$inferInsert;
export type ListingViewEvent = typeof listingViewEvents.$inferSelect;
export type NewListingViewEvent = typeof listingViewEvents.$inferInsert;
export type ListingActionEvent = typeof listingActionEvents.$inferSelect;
export type NewListingActionEvent = typeof listingActionEvents.$inferInsert;
export type ProfileViewEvent = typeof profileViewEvents.$inferSelect;
export type NewProfileViewEvent = typeof profileViewEvents.$inferInsert;
export type UserFollow = typeof userFollows.$inferSelect;
export type NewUserFollow = typeof userFollows.$inferInsert;
export type ReelLike = typeof reelLikes.$inferSelect;
export type NewReelLike = typeof reelLikes.$inferInsert;
export type ReelSave = typeof reelSaves.$inferSelect;
export type NewReelSave = typeof reelSaves.$inferInsert;
export type ListingSave = typeof listingSaves.$inferSelect;
export type NewListingSave = typeof listingSaves.$inferInsert;
export type ListingLike = typeof listingLikes.$inferSelect;
export type NewListingLike = typeof listingLikes.$inferInsert;
export type AdCampaignDeliveryDaily = typeof adCampaignDeliveryDaily.$inferSelect;
export type NewAdCampaignDeliveryDaily = typeof adCampaignDeliveryDaily.$inferInsert;
export type ReelReshare = typeof reelReshares.$inferSelect;
export type NewReelReshare = typeof reelReshares.$inferInsert;
export type ReelComment = typeof reelComments.$inferSelect;
export type NewReelComment = typeof reelComments.$inferInsert;
export type ReelCommentLike = typeof reelCommentLikes.$inferSelect;
export type NewReelCommentLike = typeof reelCommentLikes.$inferInsert;
export type ReelCommentDislike = typeof reelCommentDislikes.$inferSelect;
export type NewReelCommentDislike = typeof reelCommentDislikes.$inferInsert;
export type HashtagStat = typeof hashtagStats.$inferSelect;
