import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";

export type SeoIndexingMode = "auto" | "force_index" | "noindex";

export type SeoSettings = {
  allowIndexing: boolean;
  bingVerification: string;
  defaultDescription: string;
  defaultOgHeadline: string;
  defaultOgImageUrl: string;
  defaultOgSubtitle: string;
  defaultUnavailableListingIndexing: SeoIndexingMode;
  googleSearchConsoleVerification: string;
  indexDemoContent: boolean;
  organizationAddress: string;
  organizationEmail: string;
  organizationName: string;
  organizationPhone: string;
  sitemapMaxEntries: number;
  titleTemplate: string;
};

const seoSettingsKey = "seo";
export const sitemapProtocolMaxEntries = 50000;

export const defaultSeoSettings: SeoSettings = {
  allowIndexing: true,
  bingVerification: "",
  defaultDescription:
    "Find homes, rentals, property agents and real estate listings on Homzie.",
  defaultOgHeadline: "Find it. Love it. Live it.",
  defaultOgImageUrl: "",
  defaultOgSubtitle: "Homes, agents, reels and real estate listings.",
  defaultUnavailableListingIndexing: "noindex",
  googleSearchConsoleVerification: "",
  indexDemoContent: false,
  organizationAddress: "",
  organizationEmail: "",
  organizationName: "Homzie",
  organizationPhone: "",
  sitemapMaxEntries: sitemapProtocolMaxEntries,
  titleTemplate: "%s | Homzie",
};

const indexingSchema = z
  .enum(["auto", "force_index", "noindex"])
  .catch("auto" satisfies SeoIndexingMode);

const seoSettingsSchema = z.object({
  allowIndexing: z.boolean().catch(defaultSeoSettings.allowIndexing),
  bingVerification: z.string().catch(defaultSeoSettings.bingVerification),
  defaultDescription: z.string().catch(defaultSeoSettings.defaultDescription),
  defaultOgHeadline: z.string().catch(defaultSeoSettings.defaultOgHeadline),
  defaultOgImageUrl: z.string().catch(defaultSeoSettings.defaultOgImageUrl),
  defaultOgSubtitle: z.string().catch(defaultSeoSettings.defaultOgSubtitle),
  defaultUnavailableListingIndexing: indexingSchema.catch(
    defaultSeoSettings.defaultUnavailableListingIndexing,
  ),
  googleSearchConsoleVerification: z
    .string()
    .catch(defaultSeoSettings.googleSearchConsoleVerification),
  indexDemoContent: z.boolean().catch(defaultSeoSettings.indexDemoContent),
  organizationAddress: z.string().catch(defaultSeoSettings.organizationAddress),
  organizationEmail: z.string().catch(defaultSeoSettings.organizationEmail),
  organizationName: z.string().catch(defaultSeoSettings.organizationName),
  organizationPhone: z.string().catch(defaultSeoSettings.organizationPhone),
  sitemapMaxEntries: z.number().int().positive().catch(defaultSeoSettings.sitemapMaxEntries),
  titleTemplate: z.string().catch(defaultSeoSettings.titleTemplate),
});

function clean(value: string, maxLength = 300) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (trimmed.startsWith("/") || /^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 400);

  return "";
}

export function normalizeSeoSettings(value: unknown): SeoSettings {
  const parsed = seoSettingsSchema.parse(value || defaultSeoSettings);

  return {
    allowIndexing: parsed.allowIndexing,
    bingVerification: clean(parsed.bingVerification, 120),
    defaultDescription: clean(parsed.defaultDescription, 220) || defaultSeoSettings.defaultDescription,
    defaultOgHeadline: clean(parsed.defaultOgHeadline, 90) || defaultSeoSettings.defaultOgHeadline,
    defaultOgImageUrl: cleanUrl(parsed.defaultOgImageUrl),
    defaultOgSubtitle: clean(parsed.defaultOgSubtitle, 140) || defaultSeoSettings.defaultOgSubtitle,
    defaultUnavailableListingIndexing: parsed.defaultUnavailableListingIndexing,
    googleSearchConsoleVerification: clean(parsed.googleSearchConsoleVerification, 120),
    indexDemoContent: parsed.indexDemoContent,
    organizationAddress: clean(parsed.organizationAddress, 240),
    organizationEmail: clean(parsed.organizationEmail, 160),
    organizationName: clean(parsed.organizationName, 120) || defaultSeoSettings.organizationName,
    organizationPhone: clean(parsed.organizationPhone, 80),
    sitemapMaxEntries: sitemapProtocolMaxEntries,
    titleTemplate: parsed.titleTemplate.includes("%s")
      ? clean(parsed.titleTemplate, 80)
      : defaultSeoSettings.titleTemplate,
  };
}

export function formatSeoTitle(title: string, settings: SeoSettings) {
  const cleanTitle = clean(title, 120);

  if (!cleanTitle) return settings.organizationName;
  if (cleanTitle.includes("| Homzie")) return cleanTitle;

  return settings.titleTemplate.replace("%s", cleanTitle);
}

export async function getStoredSeoSettings() {
  try {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, seoSettingsKey))
      .limit(1);

    return row ? normalizeSeoSettings(row.value) : defaultSeoSettings;
  } catch (error) {
    console.warn("SEO settings unavailable; using defaults.", { error });

    return defaultSeoSettings;
  }
}

export async function saveStoredSeoSettings(settings: SeoSettings) {
  const normalized = normalizeSeoSettings(settings);

  await db
    .insert(platformSettings)
    .values({
      key: seoSettingsKey,
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
