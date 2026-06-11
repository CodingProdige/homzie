import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export type MusicApiSettings = {
  jamendoClientId: string;
  freesoundApiKey: string;
};

const musicApiSettingsKey = "music_api";

export const defaultMusicApiSettings: MusicApiSettings = {
  jamendoClientId: "",
  freesoundApiKey: "",
};

const musicApiSettingsSchema = z.object({
  jamendoClientId: z.string().catch(""),
  freesoundApiKey: z.string().catch(""),
});

export function normalizeMusicApiSettings(value: unknown): MusicApiSettings {
  const parsed = musicApiSettingsSchema.parse(value || defaultMusicApiSettings);
  return {
    jamendoClientId: parsed.jamendoClientId.trim(),
    freesoundApiKey: parsed.freesoundApiKey.trim(),
  };
}

export async function getStoredMusicApiSettings(): Promise<MusicApiSettings> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, musicApiSettingsKey))
    .limit(1);

  return row ? normalizeMusicApiSettings(row.value) : defaultMusicApiSettings;
}

export async function saveStoredMusicApiSettings(settings: MusicApiSettings) {
  const normalized = normalizeMusicApiSettings(settings);

  await db
    .insert(platformSettings)
    .values({ key: musicApiSettingsKey, value: normalized, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: normalized, updatedAt: new Date() },
    });

  return normalized;
}

export function getMusicApiSettingsWithEnvFallback(settings: MusicApiSettings) {
  return {
    jamendoClientId: settings.jamendoClientId || process.env.JAMENDO_CLIENT_ID || "",
    freesoundApiKey: settings.freesoundApiKey || process.env.FREESOUND_API_KEY || "",
  };
}
