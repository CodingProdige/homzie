import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
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
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("active"),
  emailVerified: boolean("email_verified").notNull().default(false),
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
    index("property_listings_outcome_at_idx").on(table.outcomeAt),
    index("property_listings_sold_at_idx").on(table.soldAt),
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

export const usersRelations = relations(users, ({ one, many }) => ({
  agentProfile: one(agentProfiles),
  followedProfiles: many(userFollows, { relationName: "follower" }),
  followers: many(userFollows, { relationName: "following" }),
  reelCommentDislikes: many(reelCommentDislikes),
  reelCommentLikes: many(reelCommentLikes),
  reelComments: many(reelComments),
  reelLikes: many(reelLikes),
  reelReshares: many(reelReshares),
  reelSaves: many(reelSaves),
  reelWatchEvents: many(reelWatchEvents),
  reelWatchSessions: many(reelWatchSessions),
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
export type UserFollow = typeof userFollows.$inferSelect;
export type NewUserFollow = typeof userFollows.$inferInsert;
export type ReelLike = typeof reelLikes.$inferSelect;
export type NewReelLike = typeof reelLikes.$inferInsert;
export type ReelSave = typeof reelSaves.$inferSelect;
export type NewReelSave = typeof reelSaves.$inferInsert;
export type ReelReshare = typeof reelReshares.$inferSelect;
export type NewReelReshare = typeof reelReshares.$inferInsert;
export type ReelComment = typeof reelComments.$inferSelect;
export type NewReelComment = typeof reelComments.$inferInsert;
export type ReelCommentLike = typeof reelCommentLikes.$inferSelect;
export type NewReelCommentLike = typeof reelCommentLikes.$inferInsert;
export type ReelCommentDislike = typeof reelCommentDislikes.$inferSelect;
export type NewReelCommentDislike = typeof reelCommentDislikes.$inferInsert;
export type HashtagStat = typeof hashtagStats.$inferSelect;
