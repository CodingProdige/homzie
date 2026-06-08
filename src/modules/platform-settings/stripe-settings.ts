import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export const stripeModes = ["test", "live"] as const;
export type StripeMode = (typeof stripeModes)[number];

export type StripeModeSettings = {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  monthlyPriceId: string;
  yearlyPriceId: string;
};

export type StripeSettings = {
  mode: StripeMode;
  test: StripeModeSettings;
  live: StripeModeSettings;
};

const stripeSettingsKey = "stripe";

const emptyModeSettings: StripeModeSettings = {
  publishableKey: "",
  secretKey: "",
  webhookSecret: "",
  monthlyPriceId: "",
  yearlyPriceId: "",
};

export const defaultStripeSettings: StripeSettings = {
  mode: "test",
  test: emptyModeSettings,
  live: emptyModeSettings,
};

const stripeModeSettingsSchema = z.object({
  publishableKey: z.string().catch(""),
  secretKey: z.string().catch(""),
  webhookSecret: z.string().catch(""),
  monthlyPriceId: z.string().catch(""),
  yearlyPriceId: z.string().catch(""),
});

const stripeSettingsSchema = z.object({
  mode: z.enum(stripeModes).catch("test"),
  test: stripeModeSettingsSchema.catch(emptyModeSettings),
  live: stripeModeSettingsSchema.catch(emptyModeSettings),
});

function trimModeSettings(settings: StripeModeSettings): StripeModeSettings {
  return {
    publishableKey: settings.publishableKey.trim(),
    secretKey: settings.secretKey.trim(),
    webhookSecret: settings.webhookSecret.trim(),
    monthlyPriceId: settings.monthlyPriceId.trim(),
    yearlyPriceId: settings.yearlyPriceId.trim(),
  };
}

export function normalizeStripeSettings(value: unknown): StripeSettings {
  const parsed = stripeSettingsSchema.parse(value || defaultStripeSettings);

  return {
    mode: parsed.mode,
    test: trimModeSettings({ ...emptyModeSettings, ...parsed.test }),
    live: trimModeSettings({ ...emptyModeSettings, ...parsed.live }),
  };
}

export async function getStoredStripeSettings() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, stripeSettingsKey))
    .limit(1);

  return row ? normalizeStripeSettings(row.value) : defaultStripeSettings;
}

export async function saveStoredStripeSettings(settings: StripeSettings) {
  const normalized = normalizeStripeSettings(settings);

  await db
    .insert(platformSettings)
    .values({
      key: stripeSettingsKey,
      value: normalized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: normalized,
        updatedAt: new Date(),
      },
    });

  return normalized;
}

export function getActiveStripeModeSettings(settings: StripeSettings) {
  return settings[settings.mode];
}

export function getStripeSettingsWithEnvFallback(settings: StripeSettings) {
  const active = getActiveStripeModeSettings(settings);

  return {
    mode: settings.mode,
    publishableKey:
      active.publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    secretKey: active.secretKey || process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: active.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "",
    monthlyPriceId:
      active.monthlyPriceId || process.env.STRIPE_AGENT_MONTHLY_PRICE_ID || "",
    yearlyPriceId:
      active.yearlyPriceId || process.env.STRIPE_AGENT_YEARLY_PRICE_ID || "",
  };
}

export function hasAnyStripeSettingValue(settings: StripeSettings) {
  return stripeModes.some((mode) =>
    Object.values(settings[mode]).some((value) => value.trim().length > 0),
  );
}
