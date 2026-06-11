"use server";

import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import {
  getMusicApiSettingsWithEnvFallback,
  getStoredMusicApiSettings,
} from "@/modules/platform-settings/music-api-settings";

import { searchFreesound } from "./freesound";
import { searchJamendoMusic } from "./jamendo";
import { getActiveMusicTracks } from "./queries";
import type { ExternalTrack, LibraryTrack } from "./types";

async function requireMusicSearchUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in to browse music.");
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, session.user.id), eq(users.status, "active")))
    .limit(1);

  if (!user) {
    throw new Error("Sign in to browse music.");
  }
}

export async function getLibraryTracks(): Promise<LibraryTrack[]> {
  await requireMusicSearchUser();
  return getActiveMusicTracks();
}

export async function searchJamendo(query: string, tag?: string): Promise<ExternalTrack[]> {
  await requireMusicSearchUser();
  const stored = await getStoredMusicApiSettings();
  const { jamendoClientId } = getMusicApiSettingsWithEnvFallback(stored);
  return searchJamendoMusic(query, 1, jamendoClientId || undefined, tag);
}

export async function searchFreesoundTracks(query: string, tag?: string): Promise<ExternalTrack[]> {
  await requireMusicSearchUser();
  const stored = await getStoredMusicApiSettings();
  const { freesoundApiKey } = getMusicApiSettingsWithEnvFallback(stored);
  return searchFreesound(query, 1, freesoundApiKey || undefined, tag);
}
