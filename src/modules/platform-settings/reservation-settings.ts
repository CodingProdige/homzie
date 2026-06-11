import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export type ReservationSettings = {
  enabled: boolean;
  platformFeePercent: number;
  processingFeePercent: number;
  processingFixedCents: number;
  minReservationAmountCents: number;
  maxReservationAmountCents: number;
  termsText: string;
};

export const defaultReservationSettings: ReservationSettings = {
  enabled: true,
  platformFeePercent: 5,
  processingFeePercent: 3.4,
  processingFixedCents: 200,
  minReservationAmountCents: 1_000,
  maxReservationAmountCents: 10_000_000,
  termsText:
    "Reservation funds are held while the agency confirms the deal. Homzie only releases funds after required agency documentation and payout approval are complete. Payment and transfer fees may apply.",
};

const reservationSettingsKey = "reservations";

const reservationSettingsSchema = z.object({
  enabled: z.boolean().catch(defaultReservationSettings.enabled),
  platformFeePercent: z
    .number()
    .finite()
    .catch(defaultReservationSettings.platformFeePercent),
  processingFeePercent: z
    .number()
    .finite()
    .catch(defaultReservationSettings.processingFeePercent),
  processingFixedCents: z
    .number()
    .int()
    .nonnegative()
    .catch(defaultReservationSettings.processingFixedCents),
  minReservationAmountCents: z
    .number()
    .int()
    .positive()
    .catch(defaultReservationSettings.minReservationAmountCents),
  maxReservationAmountCents: z
    .number()
    .int()
    .positive()
    .catch(defaultReservationSettings.maxReservationAmountCents),
  termsText: z
    .string()
    .trim()
    .max(2000)
    .catch(defaultReservationSettings.termsText),
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeReservationSettings(value: unknown): ReservationSettings {
  const parsed = reservationSettingsSchema.parse(
    value || defaultReservationSettings,
  );
  const minReservationAmountCents = clamp(
    parsed.minReservationAmountCents,
    100,
    100_000_000,
  );
  const maxReservationAmountCents = clamp(
    Math.max(parsed.maxReservationAmountCents, minReservationAmountCents),
    minReservationAmountCents,
    100_000_000,
  );

  return {
    enabled: parsed.enabled,
    platformFeePercent: clamp(parsed.platformFeePercent, 0, 95),
    processingFeePercent: clamp(parsed.processingFeePercent, 0, 20),
    processingFixedCents: clamp(parsed.processingFixedCents, 0, 100_000),
    minReservationAmountCents,
    maxReservationAmountCents,
    termsText: parsed.termsText || defaultReservationSettings.termsText,
  };
}

export async function getStoredReservationSettings() {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, reservationSettingsKey))
    .limit(1);

  return row
    ? normalizeReservationSettings(row.value)
    : defaultReservationSettings;
}

export async function saveStoredReservationSettings(
  settings: ReservationSettings,
) {
  const normalized = normalizeReservationSettings(settings);

  await db
    .insert(platformSettings)
    .values({
      key: reservationSettingsKey,
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

export function calculateReservationFees({
  amountCents,
  settings,
}: {
  amountCents: number;
  settings: ReservationSettings;
}) {
  const platformFeeCents = Math.round(
    amountCents * (settings.platformFeePercent / 100),
  );
  const processingFeeCents =
    Math.round(amountCents * (settings.processingFeePercent / 100)) +
    settings.processingFixedCents;

  return {
    platformFeeCents,
    processingFeeCents,
    totalPaidCents: amountCents + platformFeeCents + processingFeeCents,
  };
}
