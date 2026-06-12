"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { agentProfiles, users } from "@/db/schema";
import { getMediaStorageRoot } from "@/media/storage";
import type { UsernameAvailability } from "@/modules/auth/actions";
import { authOptions } from "@/modules/auth/config";
import { normalizeUsername, validateUsername } from "@/modules/auth/username";

export type ProfileSettingsState = {
  message: string;
  ok: boolean;
};

const emptyState: ProfileSettingsState = {
  message: "",
  ok: false,
};

const maxAvatarBytes = 8 * 1024 * 1024;
const avatarTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const profileSettingsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  username: z.string().trim().min(1, "Username is required."),
  bio: z.string().trim().max(280, "Bio must be 280 characters or less.").optional(),
  location: z
    .string()
    .trim()
    .min(1, "Operating city is required.")
    .max(120, "Operating city must be 120 characters or less."),
  locationCity: z
    .string()
    .trim()
    .min(1, "Operating city is required.")
    .max(120, "Operating city must be 120 characters or less."),
  locationCountry: z
    .string()
    .trim()
    .min(1, "Choose a city with country data.")
    .max(120, "Country must be 120 characters or less."),
  locationGoogleSelected: z.boolean(),
  locationPlaceData: z
    .string()
    .trim()
    .min(1, "Choose your operating city from the Google suggestions.")
    .max(10_000),
  locationPlaceId: z
    .string()
    .trim()
    .min(1, "Choose your operating city from the Google suggestions.")
    .max(160),
  locationProvince: z
    .string()
    .trim()
    .min(1, "Choose a city with province data.")
    .max(120, "Province must be 120 characters or less."),
  locationSuburb: z.string().trim().max(120, "Area must be 120 characters or less.").optional(),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(160)
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Use a valid contact email.",
    }),
  contactPhone: z.string().trim().max(40, "Phone number is too long.").optional(),
  whatsappNumber: z.string().trim().max(40, "WhatsApp number is too long.").optional(),
  publicContactVisible: z.boolean(),
  removeAvatar: z.boolean(),
});

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function checkProfileUsernameAvailability(
  value: string,
): Promise<UsernameAvailability> {
  const session = await getServerSession(authOptions);
  const username = normalizeUsername(value);

  if (!username) {
    return { status: "empty", username: "" };
  }

  const validationMessage = validateUsername(username);

  if (validationMessage) {
    return {
      status: "invalid",
      username,
      message: validationMessage,
    };
  }

  if (!session?.user?.id) {
    return {
      status: "invalid",
      username,
      message: "Sign in again to check this username.",
    };
  }

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser && existingUser.id !== session.user.id) {
    return {
      status: "taken",
      username,
      message: "That username is already taken.",
    };
  }

  return {
    status: "available",
    username,
    message: "Username is available.",
  };
}

function optionalValue(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function cleanSingleLine(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

function cleanMultiLine(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function normalizedInternationalPhone(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (!digits) return null;

  if (!hasPlus) {
    digits = digits.startsWith("27") ? digits : `27${digits.replace(/^0+/, "")}`;
  }

  return `+${digits}`;
}

function parseLocationPlaceData(value?: string) {
  if (!value?.trim()) return null;

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function storeAvatar(file: File, userId: string) {
  if (!file.size) return null;

  if (file.size > maxAvatarBytes) {
    throw new Error("Profile photos must be 8MB or smaller.");
  }

  const extension = avatarTypes[file.type];

  if (!extension) {
    throw new Error("Upload a JPG, PNG, or WebP profile photo.");
  }

  const storageRoot = getMediaStorageRoot();
  const relativeDir = path.join("profiles", userId);
  const filename = `avatar-${randomUUID()}.${extension}`;
  const storedPath = path.join(relativeDir, filename).replaceAll(path.sep, "/");
  const destinationDir = path.join(storageRoot, relativeDir);

  await mkdir(destinationDir, { recursive: true });
  await writeFile(
    path.join(destinationDir, filename),
    Buffer.from(await file.arrayBuffer()),
  );

  return storedPath;
}

export async function updateProfileSettings(
  _previousState: ProfileSettingsState = emptyState,
  formData: FormData,
): Promise<ProfileSettingsState> {
  void _previousState;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { ok: false, message: "Sign in again to update your profile." };
  }

  const parsed = profileSettingsSchema.safeParse({
    name: formString(formData, "name"),
    username: formString(formData, "username"),
    bio: formString(formData, "bio"),
    location: formString(formData, "location"),
    locationCity: formString(formData, "locationCity"),
    locationCountry: formString(formData, "locationCountry"),
    locationGoogleSelected: formData.get("locationGoogleSelected") === "on",
    locationPlaceData: formString(formData, "locationPlaceData"),
    locationPlaceId: formString(formData, "locationPlaceId"),
    locationProvince: formString(formData, "locationProvince"),
    locationSuburb: formString(formData, "locationSuburb"),
    contactEmail: formString(formData, "contactEmail"),
    contactPhone: formString(formData, "contactPhone"),
    whatsappNumber: formString(formData, "whatsappNumber"),
    publicContactVisible: formData.get("publicContactVisible") === "on",
    removeAvatar: formData.get("removeAvatar") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message || "Check your profile details.",
    };
  }

  if (!parsed.data.locationGoogleSelected) {
    return {
      ok: false,
      message: "Choose your operating city from the Google suggestions.",
    };
  }

  const parsedLocationPlaceData = parseLocationPlaceData(
    parsed.data.locationPlaceData,
  );

  if (!parsedLocationPlaceData) {
    return {
      ok: false,
      message: "Choose your operating city again so Homzie can save its Google data.",
    };
  }

  const username = normalizeUsername(parsed.data.username);
  const usernameError = validateUsername(username);

  if (usernameError) {
    return { ok: false, message: usernameError };
  }

  const [existingUser] = await db
    .select({
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!existingUser) {
    return { ok: false, message: "We could not find your profile." };
  }

  const [usernameOwner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), ne(users.id, session.user.id)))
    .limit(1);

  if (usernameOwner) {
    return { ok: false, message: "That username is already taken." };
  }

  let avatarUrl: string | null | undefined;
  const avatar = formData.get("avatar");

  try {
    if (parsed.data.removeAvatar) {
      avatarUrl = null;
    } else if (avatar instanceof File && avatar.size > 0) {
      avatarUrl = await storeAvatar(avatar, session.user.id);
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save that photo.",
    };
  }

  const operatingCity = cleanSingleLine(
    parsed.data.locationCity || parsed.data.location,
  );

  const locationFields = {
    location: operatingCity,
    locationCity: operatingCity,
    locationCountry: optionalValue(
      cleanSingleLine(parsed.data.locationCountry || ""),
    ),
    locationPlaceData: parsedLocationPlaceData,
    locationPlaceId: optionalValue(parsed.data.locationPlaceId || ""),
    locationProvince: optionalValue(
      cleanSingleLine(parsed.data.locationProvince || ""),
    ),
    locationSuburb: null,
  };

  await db
    .update(users)
    .set({
      name: cleanSingleLine(parsed.data.name),
      username,
      bio: optionalValue(cleanMultiLine(parsed.data.bio || "")),
      ...locationFields,
      contactEmail: optionalValue(parsed.data.contactEmail || ""),
      contactPhone: normalizedInternationalPhone(parsed.data.contactPhone || ""),
      whatsappNumber: normalizedInternationalPhone(parsed.data.whatsappNumber || ""),
      publicContactVisible: parsed.data.publicContactVisible,
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  await db
    .update(agentProfiles)
    .set({
      displayName: cleanSingleLine(parsed.data.name),
      bio: optionalValue(cleanMultiLine(parsed.data.bio || "")),
      ...locationFields,
      updatedAt: new Date(),
    })
    .where(eq(agentProfiles.userId, session.user.id));

  revalidatePath("/settings");
  revalidatePath("/settings/profile-settings");
  if (existingUser.username) {
    revalidatePath(`/users/${existingUser.username}`);
  }
  revalidatePath(`/users/${username}`);
  revalidatePath("/agents");
  revalidatePath("/listings");

  return { ok: true, message: "Profile updated." };
}
