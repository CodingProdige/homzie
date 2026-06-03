"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type RedisClientType } from "redis";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { db } from "@/db";
import {
  propertyIdentities,
  propertyListingStatusHistory,
  propertyListings,
  users,
} from "@/db/schema";
import { isSafeMediaPath } from "@/media/paths";
import { getMediaStorageRoot } from "@/media/storage";
import { getAgentProfileForUser } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import {
  extractHashtags,
  recordHashtagUsage,
} from "@/modules/hashtags/server";
import {
  listingTypeOptions,
  mandateTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";
import { and, eq } from "drizzle-orm";

const maxListingImageBytes = 15 * 1024 * 1024;
const maxListingImages = 30;
const maxListingTitleLength = 120;
const maxListingDescriptionLength = 3000;
const maxListingFeatures = 5;
const maxListingFeatureLength = 24;
const defaultTitleImprovementModel = "gpt-4.1-mini";
const aiActionCooldownSeconds = 30;
const localAiCooldowns = new Map<string, number>();
let aiCooldownClientPromise: Promise<RedisClientType> | null = null;
const listingImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const listingTypeValues = listingTypeOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const propertyTypeValues = propertyTypeOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const mandateTypeValues = mandateTypeOptions.map((option) => option.value) as [
  string,
  ...string[],
];
const completedListingStatuses = new Set([
  "sold",
  "sold_externally",
  "withdrawn",
  "expired",
  "disputed",
  "archived",
]);

type StoredListingMedia = {
  name: string;
  path: string;
  size: number;
  type: string;
};

const listingSchema = z.object({
  askingPrice: z.coerce.number().finite().min(0).max(10_000_000_000).optional(),
  availableFrom: z.string().trim().max(32).optional(),
  bathrooms: z.coerce.number().min(0).max(99).optional(),
  bedrooms: z.coerce.number().int().min(0).max(99).optional(),
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  description: z.string().trim().max(10_000).optional(),
  erfSize: z.coerce.number().min(0).max(10_000_000).optional(),
  features: z.array(z.string()).optional(),
  floorSize: z.coerce.number().min(0).max(10_000_000).optional(),
  garages: z.coerce.number().int().min(0).max(99).optional(),
  googlePlaceId: z.string().trim().max(180).optional(),
  listingType: z.enum(listingTypeValues),
  location: z.string().trim().min(2).max(240),
  mandateEndDate: z.string().trim().max(32).optional(),
  mandateStartDate: z.string().trim().max(32).optional(),
  mandateType: z.enum(mandateTypeValues),
  parking: z.coerce.number().int().min(0).max(99).optional(),
  previousAskingPrice: z.coerce
    .number()
    .finite()
    .min(0)
    .max(10_000_000_000)
    .optional(),
  priceQualifier: z.string().trim().max(40).optional(),
  propertyType: z.enum(propertyTypeValues),
  publishIntent: z.enum(["draft", "published"]),
  suburb: z.string().trim().max(120).optional(),
  title: z.string().trim().min(4).max(maxListingTitleLength),
});

const titleImprovementSchema = z.object({
  description: z.string().trim().max(10_000).optional(),
  listingType: z.enum(listingTypeValues),
  location: z.string().trim().max(240).optional(),
  propertyType: z.enum(propertyTypeValues),
  title: z.string().trim().min(4).max(maxListingTitleLength),
});

const descriptionImprovementSchema = z.object({
  bathrooms: z.string().trim().max(20).optional(),
  bedrooms: z.string().trim().max(20).optional(),
  description: z.string().trim().max(10_000).optional(),
  erfSize: z.string().trim().max(40).optional(),
  features: z.array(z.string()).optional(),
  floorSize: z.string().trim().max(40).optional(),
  listingType: z.enum(listingTypeValues),
  location: z.string().trim().max(240).optional(),
  propertyType: z.enum(propertyTypeValues),
  title: z.string().trim().min(4).max(maxListingTitleLength),
});

function parseListingFormData(formData: FormData) {
  const rawFeatures = formData
    .getAll("features")
    .map(String)
    .map(normalizeListingFeature)
    .filter(Boolean)
    .slice(0, maxListingFeatures);
  const publishIntent = String(formData.get("publishIntent") || "draft");
  const parsed = listingSchema.safeParse({
    askingPrice: numberOrUndefined(formData.get("askingPrice")),
    availableFrom: formData.get("availableFrom"),
    bathrooms: decimalOrUndefined(formData.get("bathrooms")),
    bedrooms: numberOrUndefined(formData.get("bedrooms")),
    city: formData.get("city"),
    country: formData.get("country"),
    description: formData.get("description"),
    erfSize: decimalOrUndefined(formData.get("erfSize")),
    features: Array.from(new Set(rawFeatures)),
    floorSize: decimalOrUndefined(formData.get("floorSize")),
    garages: numberOrUndefined(formData.get("garages")),
    googlePlaceId: formData.get("googlePlaceId"),
    listingType: formData.get("listingType"),
    location:
      String(formData.get("location") || "").trim() ||
      (publishIntent === "draft" ? "Location not set" : ""),
    mandateEndDate: formData.get("mandateEndDate"),
    mandateStartDate: formData.get("mandateStartDate"),
    mandateType: formData.get("mandateType"),
    parking: numberOrUndefined(formData.get("parking")),
    previousAskingPrice: numberOrUndefined(formData.get("previousAskingPrice")),
    priceQualifier: formData.get("priceQualifier"),
    propertyType: formData.get("propertyType"),
    publishIntent,
    suburb: formData.get("suburb"),
    title:
      String(formData.get("title") || "").trim() ||
      (publishIntent === "draft" ? "Untitled listing" : ""),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || "Listing details are invalid.");
  }

  const description = sanitizeListingDescription(parsed.data.description || "");

  if (plainListingDescription(description).length > maxListingDescriptionLength) {
    throw new Error(
      `Description must be ${maxListingDescriptionLength} characters or fewer.`,
    );
  }

  return { data: parsed.data, description };
}

function assertListingCanPublish(
  data: z.infer<typeof listingSchema>,
  description: string,
  mediaCount: number,
) {
  if (data.publishIntent !== "published") return;

  const issues: string[] = [];
  const descriptionText = plainListingDescription(description);

  if (data.title === "Untitled listing" || data.title.trim().length < 4) {
    issues.push("Add a listing title.");
  }

  if (data.location === "Location not set" || data.location.trim().length < 2) {
    issues.push("Add the property location.");
  }

  if (descriptionText.length < 40) {
    issues.push("Add a fuller property description.");
  }

  if (!data.bedrooms || !data.bathrooms || !data.floorSize) {
    issues.push("Add bedrooms, bathrooms, and floor size.");
  }

  if (!data.askingPrice || data.askingPrice <= 0) {
    issues.push("Set the asking price.");
  }

  if (mediaCount < 1) {
    issues.push("Upload at least one listing image.");
  }

  if (issues.length) {
    throw new Error(`Listing incomplete: ${issues.join(" ")}`);
  }
}

export async function createListing(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const agentProfile = await getAgentProfileForUser(session.user.id);
  const { data, description } = parseListingFormData(formData);
  const media = await storeListingImages(formData.getAll("mediaFiles"));
  assertListingCanPublish(data, description, media.length);
  const coverIndex = Math.min(
    Math.max(Number(formData.get("coverIndex") || 0), 0),
    Math.max(media.length - 1, 0),
  );
  const coverImageUrl = media[coverIndex]?.path || null;
  const askingPriceCents =
    typeof data.askingPrice === "number"
      ? Math.round(data.askingPrice * 100)
      : null;
  const previousAskingPriceCents =
    typeof data.previousAskingPrice === "number" &&
    typeof data.askingPrice === "number" &&
    data.previousAskingPrice > data.askingPrice
      ? Math.round(data.previousAskingPrice * 100)
      : null;
  const priceLabel = buildPriceLabel({
    amount: data.askingPrice,
    listingType: data.listingType,
    qualifier: data.priceQualifier,
  });
  const [identity] = await db
    .insert(propertyIdentities)
    .values({
      city: data.city || null,
      country: data.country || null,
      googlePlaceId: data.googlePlaceId || null,
      normalizedAddress: data.location.toLowerCase(),
      suburb: data.suburb || null,
      propertyType: data.propertyType,
    })
    .onConflictDoNothing()
    .returning({ id: propertyIdentities.id });

  const [listing] = await db
    .insert(propertyListings)
    .values({
      agentProfileId: agentProfile?.id || null,
      askingPriceCents,
      coverImageUrl,
      description: description || null,
      details: {
        availableFrom: data.availableFrom || null,
        bathrooms: data.bathrooms ?? null,
        bedrooms: data.bedrooms ?? null,
        erfSize: data.erfSize ?? null,
        floorSize: data.floorSize ?? null,
        garages: data.garages ?? null,
        parking: data.parking ?? null,
        previousAskingPriceCents,
        priceQualifier: data.priceQualifier || null,
      },
      features: data.features || [],
      listedAt: data.publishIntent === "published" ? new Date() : undefined,
      listingType: data.listingType,
      location: data.location,
      mandateEndDate: parseDate(data.mandateEndDate),
      mandateStartDate: parseDate(data.mandateStartDate),
      mandateType: data.mandateType,
      media,
      priceLabel,
      propertyIdentityId: identity?.id || null,
      propertyType: data.propertyType,
      status: data.publishIntent,
      title: data.title,
      userId: session.user.id,
    })
    .returning({ id: propertyListings.id });

  await db.insert(propertyListingStatusHistory).values({
    listingId: listing.id,
    reason:
      data.publishIntent === "published"
        ? "Listing created and published."
        : "Listing saved as draft.",
    toStatus: data.publishIntent,
    userId: session.user.id,
  });

  if (data.publishIntent === "published") {
    await recordHashtagUsage({
      sourceId: listing.id,
      sourceType: "listing",
      tags: extractHashtags(data.title, plainListingDescription(description)),
      userId: session.user.id,
    });
  }

  redirect(
    data.publishIntent === "published"
      ? `/listings/new?listingPublished=${listing.id}`
      : `/users/${user.username}?tab=listings`,
  );
}

export async function updateListing(formData: FormData) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const listingId = z.string().uuid().safeParse(formData.get("listingId"));

  if (!listingId.success) {
    throw new Error("Listing ID is invalid.");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const [existingListing] = await db
    .select({
      listedAt: propertyListings.listedAt,
      lockedAt: propertyListings.lockedAt,
      status: propertyListings.status,
    })
    .from(propertyListings)
    .where(
      and(
        eq(propertyListings.id, listingId.data),
        eq(propertyListings.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!existingListing) {
    throw new Error("Listing not found.");
  }

  if (
    existingListing.lockedAt ||
    completedListingStatuses.has(existingListing.status)
  ) {
    throw new Error("This listing is locked and can no longer be edited.");
  }

  const agentProfile = await getAgentProfileForUser(session.user.id);
  const { data, description } = parseListingFormData(formData);
  const uploadedMedia = await storeListingImages(formData.getAll("mediaFiles"));
  const media = [
    ...parseExistingListingMedia(formData.get("existingMedia")),
    ...uploadedMedia,
  ].slice(0, maxListingImages);
  assertListingCanPublish(data, description, media.length);
  const coverIndex = Math.min(
    Math.max(Number(formData.get("coverIndex") || 0), 0),
    Math.max(media.length - 1, 0),
  );
  const coverImageUrl = media[coverIndex]?.path || null;
  const askingPriceCents =
    typeof data.askingPrice === "number"
      ? Math.round(data.askingPrice * 100)
      : null;
  const previousAskingPriceCents =
    typeof data.previousAskingPrice === "number" &&
    typeof data.askingPrice === "number" &&
    data.previousAskingPrice > data.askingPrice
      ? Math.round(data.previousAskingPrice * 100)
      : null;
  const priceLabel = buildPriceLabel({
    amount: data.askingPrice,
    listingType: data.listingType,
    qualifier: data.priceQualifier,
  });
  const [identity] = await db
    .insert(propertyIdentities)
    .values({
      city: data.city || null,
      country: data.country || null,
      googlePlaceId: data.googlePlaceId || null,
      normalizedAddress: data.location.toLowerCase(),
      suburb: data.suburb || null,
      propertyType: data.propertyType,
    })
    .onConflictDoNothing()
    .returning({ id: propertyIdentities.id });

  await db
    .update(propertyListings)
    .set({
      agentProfileId: agentProfile?.id || null,
      askingPriceCents,
      coverImageUrl,
      description: description || null,
      details: {
        availableFrom: data.availableFrom || null,
        bathrooms: data.bathrooms ?? null,
        bedrooms: data.bedrooms ?? null,
        erfSize: data.erfSize ?? null,
        floorSize: data.floorSize ?? null,
        garages: data.garages ?? null,
        parking: data.parking ?? null,
        previousAskingPriceCents,
        priceQualifier: data.priceQualifier || null,
      },
      features: data.features || [],
      listedAt:
        data.publishIntent === "published" &&
        existingListing.status !== "published"
          ? new Date()
          : existingListing.listedAt,
      listingType: data.listingType,
      location: data.location,
      mandateEndDate: parseDate(data.mandateEndDate),
      mandateStartDate: parseDate(data.mandateStartDate),
      mandateType: data.mandateType,
      media,
      priceLabel,
      propertyIdentityId: identity?.id || null,
      propertyType: data.propertyType,
      status: data.publishIntent,
      title: data.title,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(propertyListings.id, listingId.data),
        eq(propertyListings.userId, session.user.id),
      ),
    );

  await db.insert(propertyListingStatusHistory).values({
    listingId: listingId.data,
    reason:
      existingListing.status === data.publishIntent
        ? "Listing details updated."
        : data.publishIntent === "published"
          ? "Listing updated and published."
          : "Listing updated and saved as draft.",
    toStatus: data.publishIntent,
    userId: session.user.id,
  });

  if (data.publishIntent === "published") {
    await recordHashtagUsage({
      sourceId: listingId.data,
      sourceType: "listing",
      tags: extractHashtags(data.title, plainListingDescription(description)),
      userId: session.user.id,
    });
  }

  redirect(
    data.publishIntent === "published"
      ? `/listings/new?listingPublished=${listingId.data}`
      : `/users/${user.username}?tab=listings`,
  );
}

export async function improveListingTitle(input: {
  description?: string;
  listingType: string;
  location?: string;
  propertyType: string;
  title: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in before using AI title polish." };
  }

  const parsed = titleImprovementSchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: `Add a title between 4 and ${maxListingTitleLength} characters first.`,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { error: "OpenAI is not configured yet." };
  }

  const cooldown = await checkAiActionCooldown(session.user.id, "listing-title");

  if (!cooldown.allowed) {
    return { error: cooldown.message };
  }

  const data = parsed.data;
  const currentDescription = plainListingDescription(
    sanitizeListingDescription(data.description || ""),
  );
  const propertyTypeLabel =
    propertyTypeOptions.find((option) => option.value === data.propertyType)
      ?.label || data.propertyType;
  const listingTypeLabel =
    listingTypeOptions.find((option) => option.value === data.listingType)
      ?.label || data.listingType;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: [
                  "Rewrite this property listing title into one polished, premium, buyer-friendly title.",
                  `Keep it under ${maxListingTitleLength} characters.`,
                  "Do not use emojis, hashtags, quotes, clickbait, or a trailing full stop.",
                  "Return only the improved title.",
                  "",
                  `Current title: ${data.title}`,
                  `Listing type: ${listingTypeLabel}`,
                  `Property type: ${propertyTypeLabel}`,
                  `Location: ${data.location || "Not provided"}`,
                  `Description: ${currentDescription || "Not provided"}`,
                ].join("\n"),
                type: "input_text",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 80,
        model: process.env.OPENAI_TITLE_MODEL || defaultTitleImprovementModel,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[listings] title improvement failed", {
        error: errorText.slice(0, 500),
        model: process.env.OPENAI_TITLE_MODEL || defaultTitleImprovementModel,
        status: response.status,
      });

      return { error: "Could not improve the title right now." };
    }

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string; type?: string }>;
      }>;
    };
    const rawTitle =
      result.output_text ||
      result.output
        ?.flatMap((item) => item.content || [])
        .map((content) => content.text || "")
        .join(" ");
    const title = cleanListingTitle(rawTitle || "");

    if (!title) {
      return { error: "OpenAI did not return a usable title." };
    }

    return { title };
  } catch (error) {
    console.error("[listings] title improvement error", error);

    return { error: "Could not improve the title right now." };
  }
}

export async function improveListingDescription(input: {
  bathrooms?: string;
  bedrooms?: string;
  description?: string;
  erfSize?: string;
  features?: string[];
  floorSize?: string;
  listingType: string;
  location?: string;
  propertyType: string;
  title: string;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { error: "Sign in before using AI description polish." };
  }

  const parsed = descriptionImprovementSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Add a listing title before improving the description." };
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { error: "OpenAI is not configured yet." };
  }

  const cooldown = await checkAiActionCooldown(
    session.user.id,
    "listing-description",
  );

  if (!cooldown.allowed) {
    return { error: cooldown.message };
  }

  const data = parsed.data;
  const currentDescription = plainListingDescription(
    sanitizeListingDescription(data.description || ""),
  );
  const propertyTypeLabel =
    propertyTypeOptions.find((option) => option.value === data.propertyType)
      ?.label || data.propertyType;
  const listingTypeLabel =
    listingTypeOptions.find((option) => option.value === data.listingType)
      ?.label || data.listingType;
  const selectedFeatures = (data.features || []).join(", ");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          {
            content: [
              {
                text: [
                  "Write a polished, premium property listing description.",
                  `Keep it under ${maxListingDescriptionLength} characters.`,
                  "Use warm, confident real-estate copy that is easy to scan.",
                  "Do not invent facts, numbers, suburbs, views, amenities, or sale claims that are not provided.",
                  "Do not use emojis, hashtags, markdown, headings, or bullet points.",
                  "Return only the improved description.",
                  "",
                  `Title: ${data.title}`,
                  `Current description: ${currentDescription || "Not provided"}`,
                  `Listing type: ${listingTypeLabel}`,
                  `Property type: ${propertyTypeLabel}`,
                  `Location: ${data.location || "Not provided"}`,
                  `Bedrooms: ${data.bedrooms || "Not provided"}`,
                  `Bathrooms: ${data.bathrooms || "Not provided"}`,
                  `Floor size: ${data.floorSize || "Not provided"}`,
                  `Erf size: ${data.erfSize || "Not provided"}`,
                  `Features: ${selectedFeatures || "Not provided"}`,
                ].join("\n"),
                type: "input_text",
              },
            ],
            role: "user",
          },
        ],
        max_output_tokens: 520,
        model: process.env.OPENAI_DESCRIPTION_MODEL || defaultTitleImprovementModel,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[listings] description improvement failed", {
        error: errorText.slice(0, 500),
        model: process.env.OPENAI_DESCRIPTION_MODEL || defaultTitleImprovementModel,
        status: response.status,
      });

      return { error: "Could not improve the description right now." };
    }

    const result = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ text?: string; type?: string }>;
      }>;
    };
    const rawDescription =
      result.output_text ||
      result.output
        ?.flatMap((item) => item.content || [])
        .map((content) => content.text || "")
        .join(" ");
    const description = cleanListingDescription(rawDescription || "");

    if (!description) {
      return { error: "OpenAI did not return a usable description." };
    }

    return { description };
  } catch (error) {
    console.error("[listings] description improvement error", error);

    return { error: "Could not improve the description right now." };
  }
}

function numberOrUndefined(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();

  return stringValue ? stringValue : undefined;
}

function decimalOrUndefined(value: FormDataEntryValue | null, decimalPlaces = 2) {
  const stringValue = String(value || "").trim();

  if (!stringValue) return undefined;

  const [, decimals = ""] = stringValue.split(".");

  if (decimals.length > decimalPlaces) {
    throw new Error(`Use no more than ${decimalPlaces} decimal places.`);
  }

  return stringValue;
}

async function checkAiActionCooldown(userId: string, action: string) {
  const key = `homzie:ai-cooldown:${action}:${userId}`;

  try {
    const client = await getAiCooldownClient();
    const existing = await client.get(key);

    if (existing) {
      const ttl = await client.ttl(key);
      const seconds = ttl > 0 ? ttl : aiActionCooldownSeconds;

      return {
        allowed: false,
        message: `AI cooldown active. Try again in ${formatCooldown(seconds)}.`,
      };
    }

    await client.set(key, "1", { EX: aiActionCooldownSeconds });

    return { allowed: true };
  } catch (error) {
    console.error("[listings] AI cooldown Redis fallback", error);

    return checkLocalAiActionCooldown(key);
  }
}

async function getAiCooldownClient() {
  if (!aiCooldownClientPromise) {
    aiCooldownClientPromise = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6380",
    })
      .on("error", (error) => {
        console.error("[listings] AI cooldown Redis error", error);
      })
      .connect() as Promise<RedisClientType>;
  }

  return aiCooldownClientPromise;
}

function checkLocalAiActionCooldown(key: string) {
  const now = Date.now();
  const expiresAt = localAiCooldowns.get(key) || 0;

  if (expiresAt > now) {
    const seconds = Math.ceil((expiresAt - now) / 1000);

    return {
      allowed: false,
      message: `AI cooldown active. Try again in ${formatCooldown(seconds)}.`,
    };
  }

  localAiCooldowns.set(key, now + aiActionCooldownSeconds * 1000);

  for (const [cooldownKey, cooldownExpiresAt] of localAiCooldowns.entries()) {
    if (cooldownExpiresAt <= now) {
      localAiCooldowns.delete(cooldownKey);
    }
  }

  return { allowed: true };
}

function formatCooldown(seconds: number) {
  if (seconds <= 1) return "1 second";

  return `${seconds} seconds`;
}

function parseDate(value: string | undefined) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function buildPriceLabel({
  amount,
  listingType,
  qualifier,
}: {
  amount?: number;
  listingType: string;
  qualifier?: string;
}) {
  if (typeof amount !== "number" || amount <= 0) {
    return qualifier || null;
  }

  const formatted = new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);

  if (listingType === "rental") {
    return `${formatted}/month`;
  }

  if (qualifier) {
    return `${qualifier} ${formatted}`;
  }

  return formatted;
}

function cleanListingTitle(value: string) {
  return value
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。]+$/g, "")
    .slice(0, maxListingTitleLength)
    .trim();
}

function cleanListingDescription(value: string) {
  return value
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxListingDescriptionLength)
    .trim();
}

function normalizeListingFeature(value: string) {
  return value
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxListingFeatureLength);
}

function sanitizeListingDescription(value: string) {
  const withoutDangerousBlocks = value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  return withoutDangerousBlocks
    .replace(/<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?>/gi, (match, tagName) => {
      const isClosing = match.startsWith("</");
      const normalizedTag = normalizeDescriptionTag(tagName);

      return normalizedTag ? `<${isClosing ? "/" : ""}${normalizedTag}>` : "";
    })
    .replace(/<(strong|em|p|ul|ol|li)>\s*<\/\1>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/ ?<(\/?(?:strong|em|p|ul|ol|li|br))> ?/gi, "<$1>")
    .trim();
}

function normalizeDescriptionTag(tagName: string) {
  const tag = tagName.toLowerCase();

  if (tag === "b") return "strong";
  if (tag === "i") return "em";
  if (["br", "em", "li", "ol", "p", "strong", "ul"].includes(tag)) return tag;

  return "";
}

function plainListingDescription(value: string) {
  return value
    .replace(/<\/?(p|br|li|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseExistingListingMedia(value: FormDataEntryValue | null) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(String(value)) as unknown;

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item): StoredListingMedia | null => {
        if (!item || typeof item !== "object") return null;

        const mediaItem = item as Partial<StoredListingMedia>;
        const path = String(mediaItem.path || "");

        if (!isSafeMediaPath(path)) return null;

        return {
          name: String(mediaItem.name || path.split("/").pop() || "Listing image"),
          path,
          size: Number(mediaItem.size || 0),
          type: String(mediaItem.type || "image/webp"),
        };
      })
      .filter((item): item is StoredListingMedia => Boolean(item))
      .slice(0, maxListingImages);
  } catch {
    return [];
  }
}

async function storeListingImages(values: FormDataEntryValue[]) {
  const files = values
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, maxListingImages);

  const storedFiles: Array<{
    name: string;
    path: string;
    size: number;
    type: string;
  }> = [];

  for (const file of files) {
    if (file.size > maxListingImageBytes) {
      throw new Error("Listing images must be 15MB or smaller after optimization.");
    }

    const extension = listingImageTypes[file.type];

    if (!extension) {
      throw new Error("Upload JPG, PNG, or WebP listing images.");
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const fileName = `${randomUUID()}.${extension}`;
    const relativePath = ["listings", year, month, fileName].join("/");
    const storagePath = path.join(
      /*turbopackIgnore: true*/ getMediaStorageRoot(),
      relativePath,
    );
    const bytes = Buffer.from(await file.arrayBuffer());

    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, bytes);

    storedFiles.push({
      name: file.name,
      path: relativePath,
      size: file.size,
      type: file.type,
    });
  }

  return storedFiles;
}
