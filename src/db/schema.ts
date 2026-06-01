import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
  subscriptions: many(subscriptions),
  reels: many(reels),
}));

export const agentProfilesRelations = relations(agentProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [agentProfiles.userId],
    references: [users.id],
  }),
  subscriptions: many(subscriptions),
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

export const reelsRelations = relations(reels, ({ one }) => ({
  user: one(users, {
    fields: [reels.userId],
    references: [users.id],
  }),
  agentProfile: one(agentProfiles, {
    fields: [reels.agentProfileId],
    references: [agentProfiles.id],
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
export type HashtagStat = typeof hashtagStats.$inferSelect;
