"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import {
  saveStoredAdsSettings,
} from "@/modules/platform-settings/ads-settings";
import { defaultAdsSettings, type AdsSettings } from "@/modules/ads/shared";
import {
  defaultGoogleAdsSettings,
  getStoredGoogleAdsSettings,
  saveStoredGoogleAdsSettings,
  type GoogleAdsSettings,
} from "@/modules/platform-settings/google-ads-settings";
import {
  getGoogleDsaAutomationHealth,
  syncGoogleDsaCampaignState,
  type GoogleDsaAutomationHealth,
} from "@/modules/google-ads/dsa";
import {
  getStoredStripeSettings,
  saveStoredStripeSettings,
  stripeModes,
  type StripeMode,
  type StripeModeSettings,
  type StripeSettings,
} from "@/modules/platform-settings/stripe-settings";
import {
  getStoredMusicApiSettings,
  saveStoredMusicApiSettings,
  type MusicApiSettings,
} from "@/modules/platform-settings/music-api-settings";
import { auditIncompleteTrialSubscriptions } from "@/modules/billing/trial-integrity";
import {
  defaultReservationSettings,
  saveStoredReservationSettings,
  type ReservationSettings,
} from "@/modules/platform-settings/reservation-settings";
import {
  defaultSeoSettings,
  saveStoredSeoSettings,
  type SeoIndexingMode,
  type SeoSettings,
} from "@/modules/seo/settings";
import { hashPassword } from "@/modules/auth/password";
import { normalizeUsername, validateUsername } from "@/modules/auth/username";

export type AdminStripeSettingsState = {
  message: string;
  ok: boolean;
};

export type AdminAdsSettingsState = {
  message: string;
  ok: boolean;
};

export type AdminGoogleAdsSettingsState = {
  message: string;
  ok: boolean;
};

export type AdminGoogleAdsAutomationState = {
  health: GoogleDsaAutomationHealth | null;
  message: string;
  ok: boolean;
};

export type AdminReservationSettingsState = {
  message: string;
  ok: boolean;
};

export type AdminDemoProfileSettingsState = {
  message: string;
  ok: boolean;
};

export type AdminSeoSettingsState = {
  message: string;
  ok: boolean;
};

export type AdminTrialAuditState = {
  message: string;
  ok: boolean;
};

export type AdminProAccessOverrideState = {
  message: string;
  ok: boolean;
};

export type AdminModerationUpdateState = {
  message: string;
  ok: boolean;
};

const initialModeSettings: StripeModeSettings = {
  publishableKey: "",
  secretKey: "",
  webhookSecret: "",
  monthlyPriceId: "",
  yearlyPriceId: "",
};

const stripeSettingsFormSchema = z.object({
  mode: z.enum(stripeModes),
});

async function assertActiveAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in as an admin to update settings.");
  }

  const [admin] = await sql<
    Array<{ role: "user" | "admin"; status: string }>
  >`
    SELECT role, status
    FROM users
    WHERE id = ${session.user.id}
    LIMIT 1
  `;

  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Only active admins can update Stripe settings.");
  }

  return session.user.id;
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(formString(formData, key));

  return Number.isFinite(value) ? value : fallback;
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function formIndexingMode(formData: FormData, key: string): SeoIndexingMode {
  const value = formString(formData, key);

  return value === "force_index" || value === "noindex" ? value : "auto";
}

function mergeModeSettings(
  formData: FormData,
  mode: StripeMode,
  existing: StripeModeSettings,
) {
  const next = { ...initialModeSettings, ...existing };

  for (const key of Object.keys(initialModeSettings) as Array<
    keyof StripeModeSettings
  >) {
    const value = formString(formData, `${mode}.${key}`);

    if (value) {
      next[key] = value;
    }
  }

  return next;
}

function validateModeSettings(mode: StripeMode, settings: StripeModeSettings) {
  const expectedSuffix = mode === "test" ? "_test_" : "_live_";
  const issues: string[] = [];

  if (settings.publishableKey && !settings.publishableKey.startsWith(`pk${expectedSuffix}`)) {
    issues.push(`${mode} publishable key must start with pk${expectedSuffix}.`);
  }

  if (settings.secretKey && !settings.secretKey.startsWith(`sk${expectedSuffix}`)) {
    issues.push(`${mode} secret key must start with sk${expectedSuffix}.`);
  }

  if (settings.webhookSecret && !settings.webhookSecret.startsWith("whsec_")) {
    issues.push(`${mode} webhook secret must start with whsec_.`);
  }

  for (const priceKey of ["monthlyPriceId", "yearlyPriceId"] as const) {
    if (settings[priceKey] && !settings[priceKey].startsWith("price_")) {
      issues.push(`${mode} ${priceKey} must start with price_.`);
    }
  }

  return issues;
}

export async function updateAdminStripeSettings(
  _previousState: AdminStripeSettingsState,
  formData: FormData,
): Promise<AdminStripeSettingsState> {
  try {
    await assertActiveAdmin();

    const parsed = stripeSettingsFormSchema.safeParse({
      mode: formString(formData, "mode"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Choose sandbox or live mode.",
      };
    }

    const existing = await getStoredStripeSettings();
    const next: StripeSettings = {
      mode: parsed.data.mode,
      test: mergeModeSettings(formData, "test", existing.test),
      live: mergeModeSettings(formData, "live", existing.live),
    };
    const issues = [
      ...validateModeSettings("test", next.test),
      ...validateModeSettings("live", next.live),
    ];

    if (issues.length) {
      return {
        ok: false,
        message: issues[0] || "Check your Stripe settings.",
      };
    }

    await saveStoredStripeSettings(next);
    revalidatePath("/admin");

    return {
      ok: true,
      message: "Stripe settings saved.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not save Stripe settings.",
    };
  }
}

export async function auditIncompleteTrialsAction(): Promise<AdminTrialAuditState> {
  try {
    await assertActiveAdmin();

    const result = await auditIncompleteTrialSubscriptions();
    revalidatePath("/admin/users");

    if (result.errors.length) {
      return {
        ok: false,
        message: `Checked ${result.checked}. Cancelled ${result.cancelled}, emailed ${result.emailed}, skipped ${result.skipped}. ${result.errors.length} failed.`,
      };
    }

    return {
      ok: true,
      message: `Checked ${result.checked}. Cancelled ${result.cancelled} incomplete trials, emailed ${result.emailed}, skipped ${result.skipped}.`,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not audit incomplete trials.",
    };
  }
}

export async function updateAdminProAccessOverride(
  _previousState: AdminProAccessOverrideState,
  formData: FormData,
): Promise<AdminProAccessOverrideState> {
  try {
    const adminUserId = await assertActiveAdmin();
    const userId = formString(formData, "userId");
    const enabled = formBoolean(formData, "enabled");
    const reason = formString(formData, "reason").slice(0, 240);
    const expiresAtRaw = formString(formData, "expiresAt");

    if (!userId) {
      throw new Error("Choose a user first.");
    }

    let expiresAt: Date | null = null;

    if (enabled && expiresAtRaw) {
      expiresAt = new Date(`${expiresAtRaw}T23:59:59.999Z`);

      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error("Choose a valid expiry date.");
      }
    }

    const [updatedUser] = await sql<Array<{ username: string | null }>>`
      UPDATE users
      SET
        pro_access_override_enabled = ${enabled},
        pro_access_override_expires_at = ${enabled ? expiresAt : null},
        pro_access_override_reason = ${enabled ? reason || null : null},
        pro_access_override_updated_at = now(),
        pro_access_override_updated_by_user_id = ${adminUserId},
        updated_at = now()
      WHERE id = ${userId}
      RETURNING username
    `;

    if (!updatedUser) {
      throw new Error("Could not find that user.");
    }

    revalidatePath("/admin/users");
    revalidatePath("/listings/activity");

    if (updatedUser.username) {
      revalidatePath(`/users/${updatedUser.username}`);
      revalidatePath(`/users/${updatedUser.username}/performance`);
    }

    return {
      ok: true,
      message: enabled
        ? "Admin granted Pro access is enabled."
        : "Admin granted Pro access is disabled.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not update admin granted Pro access.",
    };
  }
}

function seoSettingsFromFormData(formData: FormData): SeoSettings {
  return {
    allowIndexing: formBoolean(formData, "allowIndexing"),
    bingVerification: formString(formData, "bingVerification"),
    defaultDescription:
      formString(formData, "defaultDescription") ||
      defaultSeoSettings.defaultDescription,
    defaultOgHeadline:
      formString(formData, "defaultOgHeadline") ||
      defaultSeoSettings.defaultOgHeadline,
    defaultOgImageUrl: formString(formData, "defaultOgImageUrl"),
    defaultOgSubtitle:
      formString(formData, "defaultOgSubtitle") ||
      defaultSeoSettings.defaultOgSubtitle,
    defaultUnavailableListingIndexing: formIndexingMode(
      formData,
      "defaultUnavailableListingIndexing",
    ),
    googleSearchConsoleVerification: formString(
      formData,
      "googleSearchConsoleVerification",
    ),
    indexDemoContent: formBoolean(formData, "indexDemoContent"),
    organizationAddress: formString(formData, "organizationAddress"),
    organizationEmail: formString(formData, "organizationEmail"),
    organizationName:
      formString(formData, "organizationName") ||
      defaultSeoSettings.organizationName,
    organizationPhone: formString(formData, "organizationPhone"),
    sitemapMaxEntries: defaultSeoSettings.sitemapMaxEntries,
    titleTemplate:
      formString(formData, "titleTemplate") || defaultSeoSettings.titleTemplate,
  };
}

export async function updateAdminSeoSettings(
  _previousState: AdminSeoSettingsState,
  formData: FormData,
): Promise<AdminSeoSettingsState> {
  try {
    await assertActiveAdmin();
    await saveStoredSeoSettings(seoSettingsFromFormData(formData));

    revalidatePath("/");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/seo");
    revalidatePath("/sitemap.xml");
    revalidatePath("/sitemaps/static.xml");
    revalidatePath("/sitemaps/listings.xml");
    revalidatePath("/sitemaps/profiles.xml");
    revalidatePath("/sitemaps/locations.xml");

    return {
      ok: true,
      message: "SEO settings saved.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not save SEO settings.",
    };
  }
}

function adsSettingsFromFormData(formData: FormData): AdsSettings {
  return {
    allowGoogleAds: formBoolean(formData, "allowGoogleAds"),
    allowHomzieAds: formBoolean(formData, "allowHomzieAds"),
    defaultMarginPercent: formNumber(
      formData,
      "defaultMarginPercent",
      defaultAdsSettings.defaultMarginPercent,
    ),
    googleMarginPercent: formNumber(
      formData,
      "googleMarginPercent",
      defaultAdsSettings.googleMarginPercent,
    ),
    homzieMarginPercent: formNumber(
      formData,
      "homzieMarginPercent",
      defaultAdsSettings.homzieMarginPercent,
    ),
    minCampaignBudgetCents: Math.round(
      formNumber(
        formData,
        "minCampaignBudgetRands",
        defaultAdsSettings.minCampaignBudgetCents / 100,
      ) * 100,
    ),
    maxCampaignBudgetCents: Math.round(
      formNumber(
        formData,
        "maxCampaignBudgetRands",
        defaultAdsSettings.maxCampaignBudgetCents / 100,
      ) * 100,
    ),
    homzieAverageCpmCents: Math.round(
      formNumber(
        formData,
        "homzieAverageCpmRands",
        defaultAdsSettings.homzieAverageCpmCents / 100,
      ) * 100,
    ),
    googleAverageCpmCents: Math.round(
      formNumber(
        formData,
        "googleAverageCpmRands",
        defaultAdsSettings.googleAverageCpmCents / 100,
      ) * 100,
    ),
    homzieReachSharePercent: formNumber(
      formData,
      "homzieReachSharePercent",
      defaultAdsSettings.homzieReachSharePercent,
    ),
    googleReachSharePercent: formNumber(
      formData,
      "googleReachSharePercent",
      defaultAdsSettings.googleReachSharePercent,
    ),
    homzieCtrPercent: formNumber(
      formData,
      "homzieCtrPercent",
      defaultAdsSettings.homzieCtrPercent,
    ),
    googleCtrPercent: formNumber(
      formData,
      "googleCtrPercent",
      defaultAdsSettings.googleCtrPercent,
    ),
    profileVisitRatePercent: formNumber(
      formData,
      "profileVisitRatePercent",
      defaultAdsSettings.profileVisitRatePercent,
    ),
    listingViewRatePercent: formNumber(
      formData,
      "listingViewRatePercent",
      defaultAdsSettings.listingViewRatePercent,
    ),
    reelPlayRatePercent: formNumber(
      formData,
      "reelPlayRatePercent",
      defaultAdsSettings.reelPlayRatePercent,
    ),
    leadRatePercent: formNumber(
      formData,
      "leadRatePercent",
      defaultAdsSettings.leadRatePercent,
    ),
  };
}

function validateAdsSettings(settings: AdsSettings) {
  if (settings.maxCampaignBudgetCents < settings.minCampaignBudgetCents) {
    return "Maximum budget must be higher than minimum budget.";
  }

  if (!settings.allowGoogleAds && !settings.allowHomzieAds) {
    return "At least one ad channel must stay enabled.";
  }

  return null;
}

function reservationSettingsFromFormData(formData: FormData): ReservationSettings {
  return {
    enabled: formBoolean(formData, "enabled"),
    platformFeePercent: formNumber(
      formData,
      "platformFeePercent",
      defaultReservationSettings.platformFeePercent,
    ),
    processingFeePercent: formNumber(
      formData,
      "processingFeePercent",
      defaultReservationSettings.processingFeePercent,
    ),
    processingFixedCents: Math.round(
      formNumber(
        formData,
        "processingFixedRands",
        defaultReservationSettings.processingFixedCents / 100,
      ) * 100,
    ),
    minReservationAmountCents: Math.round(
      formNumber(
        formData,
        "minReservationAmountRands",
        defaultReservationSettings.minReservationAmountCents / 100,
      ) * 100,
    ),
    maxReservationAmountCents: Math.round(
      formNumber(
        formData,
        "maxReservationAmountRands",
        defaultReservationSettings.maxReservationAmountCents / 100,
      ) * 100,
    ),
    termsText:
      formString(formData, "termsText") || defaultReservationSettings.termsText,
  };
}

export async function updateAdminReservationSettings(
  _previousState: AdminReservationSettingsState,
  formData: FormData,
): Promise<AdminReservationSettingsState> {
  try {
    await assertActiveAdmin();

    const next = reservationSettingsFromFormData(formData);

    if (next.maxReservationAmountCents < next.minReservationAmountCents) {
      return {
        ok: false,
        message: "Maximum reservation amount must be higher than minimum.",
      };
    }

    await saveStoredReservationSettings(next);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/reservations");
    revalidatePath("/listings");

    return {
      ok: true,
      message: "Reservation settings saved.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not save reservation settings.",
    };
  }
}

const reservationSettlementStatuses = [
  "awaiting_documents",
  "documents_received",
  "approved_for_release",
  "released",
  "refund_required",
  "refunded",
  "cancelled",
  "needs_review",
] as const;

const reservationReleaseStatuses = [
  "held",
  "approved",
  "released",
  "refund_required",
  "refunded",
  "cancelled",
] as const;

const reservationSettlementSchema = z.object({
  adminNotes: z.string().trim().max(4000).optional(),
  agentNotes: z.string().trim().max(4000).optional(),
  proofOfTransferUrl: z.string().trim().max(1000).optional(),
  releaseStatus: z.enum(reservationReleaseStatuses),
  reservationId: z.uuid(),
  status: z.enum(reservationSettlementStatuses),
  transferAmountRands: z.coerce.number().finite().min(0).optional(),
  transferReference: z.string().trim().max(240).optional(),
});

export async function updateAdminReservationSettlement(formData: FormData) {
  const adminUserId = await assertActiveAdmin();
  const parsed = reservationSettlementSchema.parse({
    adminNotes: formString(formData, "adminNotes") || undefined,
    agentNotes: formString(formData, "agentNotes") || undefined,
    proofOfTransferUrl: formString(formData, "proofOfTransferUrl") || undefined,
    releaseStatus: formString(formData, "releaseStatus"),
    reservationId: formString(formData, "reservationId"),
    status: formString(formData, "status"),
    transferAmountRands:
      formString(formData, "transferAmountRands") || undefined,
    transferReference: formString(formData, "transferReference") || undefined,
  });
  const data = parsed;
  const now = new Date();
  const transferAmountCents =
    typeof data.transferAmountRands === "number"
      ? Math.round(data.transferAmountRands * 100)
      : null;
  const documentsReceivedAt =
    data.status === "documents_received" ||
    data.status === "approved_for_release" ||
    data.status === "released"
      ? now
      : null;
  const releaseApprovedAt =
    data.status === "approved_for_release" ||
    data.status === "released" ||
    data.releaseStatus === "approved" ||
    data.releaseStatus === "released"
      ? now
      : null;
  const releasedAt =
    data.status === "released" || data.releaseStatus === "released"
      ? now
      : null;
  const refundedAt =
    data.status === "refunded" || data.releaseStatus === "refunded"
      ? now
      : null;
  const cancelledAt =
    data.status === "cancelled" || data.releaseStatus === "cancelled"
      ? now
      : null;

  await sql`
    UPDATE listing_reservations
    SET
      status = ${data.status},
      release_status = ${data.releaseStatus},
      transfer_amount_cents = ${transferAmountCents},
      transfer_reference = ${data.transferReference || null},
      proof_of_transfer_url = ${data.proofOfTransferUrl || null},
      admin_notes = ${data.adminNotes || null},
      agent_notes = ${data.agentNotes || null},
      documents_received_at = COALESCE(documents_received_at, ${documentsReceivedAt}),
      release_approved_at = COALESCE(release_approved_at, ${releaseApprovedAt}),
      released_at = COALESCE(released_at, ${releasedAt}),
      released_by_user_id = CASE
        WHEN ${releasedAt}::timestamptz IS NOT NULL THEN ${adminUserId}::uuid
        ELSE released_by_user_id
      END,
      refunded_at = COALESCE(refunded_at, ${refundedAt}),
      cancelled_at = COALESCE(cancelled_at, ${cancelledAt}),
      reviewed_at = ${now},
      reviewed_by_user_id = ${adminUserId}::uuid,
      updated_at = ${now}
    WHERE id = ${data.reservationId}::uuid
  `;

  revalidatePath("/admin");
  revalidatePath("/admin/reservations");
  revalidatePath(`/admin/reservations/${data.reservationId}`);
}

export async function updateAdminModerationItem(
  _previousState: AdminModerationUpdateState,
  formData: FormData,
): Promise<AdminModerationUpdateState> {
  try {
    const adminUserId = await assertActiveAdmin();
    const id = formString(formData, "id");
    const source = formString(formData, "source");
    const status = formString(formData, "status");
    const priority = formString(formData, "priority") || "normal";
    const adminNotes = formString(formData, "adminNotes");
    const resolvedStatuses = ["approved", "dismissed", "rejected", "resolved"];
    const resolvedAt = resolvedStatuses.includes(status) ? new Date() : null;

    if (!id || !status) {
      return { ok: false, message: "Choose a moderation status." };
    }

    if (source === "case") {
      await sql`
        UPDATE moderation_cases
        SET
          status = ${status},
          priority = ${priority},
          admin_notes = ${adminNotes || null},
          assigned_admin_user_id = ${adminUserId},
          resolved_at = ${resolvedAt},
          updated_at = now()
        WHERE id = ${id}::uuid
      `;
    } else if (source === "message_report") {
      await sql`
        UPDATE message_reports
        SET status = ${status}, updated_at = now()
        WHERE id = ${id}::uuid
      `;
    } else if (source === "sale_claim") {
      await sql`
        UPDATE property_sale_claims
        SET claim_status = ${status}, updated_at = now()
        WHERE id = ${id}::uuid
      `;
    } else if (source === "sale_dispute") {
      await sql`
        UPDATE property_sale_disputes
        SET
          status = ${status},
          resolved_at = ${resolvedAt},
          updated_at = now()
        WHERE id = ${id}::uuid
      `;
    } else {
      return { ok: false, message: "Unknown moderation source." };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/moderation");
    revalidatePath(`/admin/moderation/${source}/${id}`);

    return { ok: true, message: "Moderation item updated." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not update moderation item.",
    };
  }
}

const demoProfileUsername = "avamorgandemo";
const demoProfileEmail = "demo.agent@homzie.co.za";
const defaultDemoProfilePassword = "HomzieDemo2026!";
const demoSubscriptionReference = "demo:homzie-agent-pro";

type DemoListingSeed = {
  askingPriceCents: number;
  bathrooms: number;
  bedrooms: number;
  buyerIncentive: string;
  daysOnMarket: number;
  erfSize: number;
  features: string[];
  floorSize: number;
  garages: number;
  location: string;
  parking: number;
  soldAt?: string;
  soldPriceCents?: number;
  status: "published" | "sold";
  title: string;
};

type DemoProfileSeed = {
  bio: string;
  contactEmail: string;
  email: string;
  headline: string;
  location: string;
  name: string;
  username: string;
};

const defaultDemoProfileSeed: DemoProfileSeed = {
  bio: "Luxury coastal specialist. This demo profile shows agents how Homzie can turn verified sales history, active listings, and profile analytics into a high-trust public portfolio.",
  contactEmail: demoProfileEmail,
  email: demoProfileEmail,
  headline: "Top-performing luxury coastal specialist",
  location: "Cape Town, Western Cape",
  name: "Ava Morgan",
  username: demoProfileUsername,
};

const demoListingSeeds: DemoListingSeed[] = [
  {
    askingPriceCents: 1895000000,
    bathrooms: 5,
    bedrooms: 6,
    buyerIncentive: "Private buyer shortlist",
    daysOnMarket: 21,
    erfSize: 1260,
    features: ["Ocean views", "Cinema room", "Wine cellar", "Solar backup"],
    floorSize: 620,
    garages: 4,
    location: "Clifton, Cape Town",
    parking: 6,
    soldAt: "2026-05-22T10:30:00.000Z",
    soldPriceCents: 1870000000,
    status: "sold",
    title: "Clifton glass villa with panoramic Atlantic views",
  },
  {
    askingPriceCents: 1420000000,
    bathrooms: 4,
    bedrooms: 5,
    buyerIncentive: "Sold above guide",
    daysOnMarket: 18,
    erfSize: 980,
    features: ["Mountain views", "Designer kitchen", "Heated pool", "Staff suite"],
    floorSize: 510,
    garages: 3,
    location: "Constantia, Cape Town",
    parking: 5,
    soldAt: "2026-04-16T12:00:00.000Z",
    soldPriceCents: 1455000000,
    status: "sold",
    title: "Contemporary Constantia estate with vineyard outlook",
  },
  {
    askingPriceCents: 975000000,
    bathrooms: 3,
    bedrooms: 4,
    buyerIncentive: "Cash buyer matched",
    daysOnMarket: 14,
    erfSize: 540,
    features: ["Lock-up-and-go", "Sea-facing terrace", "Lift access", "Concierge"],
    floorSize: 315,
    garages: 2,
    location: "Bantry Bay, Cape Town",
    parking: 3,
    soldAt: "2026-03-28T09:15:00.000Z",
    soldPriceCents: 982500000,
    status: "sold",
    title: "Bantry Bay penthouse with wraparound terrace",
  },
  {
    askingPriceCents: 680000000,
    bathrooms: 3,
    bedrooms: 4,
    buyerIncentive: "Exclusive mandate converted",
    daysOnMarket: 25,
    erfSize: 742,
    features: ["Greenbelt position", "Separate studio", "Borehole", "Battery backup"],
    floorSize: 360,
    garages: 2,
    location: "Bishopscourt, Cape Town",
    parking: 4,
    soldAt: "2026-02-19T11:45:00.000Z",
    soldPriceCents: 672000000,
    status: "sold",
    title: "Bishopscourt family residence beside the greenbelt",
  },
  {
    askingPriceCents: 520000000,
    bathrooms: 2,
    bedrooms: 3,
    buyerIncentive: "Offer accepted in 9 days",
    daysOnMarket: 9,
    erfSize: 0,
    features: ["Harbour views", "Corner apartment", "Two parking bays", "Airbnb-ready"],
    floorSize: 188,
    garages: 0,
    location: "V&A Waterfront, Cape Town",
    parking: 2,
    soldAt: "2026-01-31T08:45:00.000Z",
    soldPriceCents: 535000000,
    status: "sold",
    title: "Waterfront corner apartment with harbour views",
  },
  {
    askingPriceCents: 1290000000,
    bathrooms: 4,
    bedrooms: 5,
    buyerIncentive: "Private viewing list",
    daysOnMarket: 0,
    erfSize: 870,
    features: ["Beach access", "Rooftop deck", "Smart home", "Double-volume living"],
    floorSize: 455,
    garages: 3,
    location: "Camps Bay, Cape Town",
    parking: 5,
    status: "published",
    title: "Camps Bay beach house with elevated entertainment deck",
  },
  {
    askingPriceCents: 735000000,
    bathrooms: 3,
    bedrooms: 4,
    buyerIncentive: "Reservation enabled",
    daysOnMarket: 0,
    erfSize: 690,
    features: ["Secure estate", "Home office", "Pool pavilion", "Solar inverter"],
    floorSize: 330,
    garages: 2,
    location: "Hout Bay, Cape Town",
    parking: 4,
    status: "published",
    title: "Secure Hout Bay estate home with mountain outlook",
  },
];

function demoListingDetails(listing: DemoListingSeed) {
  return JSON.stringify({
    bathrooms: listing.bathrooms,
    bedrooms: listing.bedrooms,
    buyerIncentive: listing.buyerIncentive,
    erfSize: listing.erfSize,
    floorSize: listing.floorSize,
    garages: listing.garages,
    parking: listing.parking,
    previousAskingPriceCents: Math.round(listing.askingPriceCents * 1.04),
  });
}

function demoListingFeatures(listing: DemoListingSeed) {
  return JSON.stringify(listing.features);
}

function demoListedAt(listing: DemoListingSeed) {
  const soldAt = listing.soldAt ? new Date(listing.soldAt) : new Date();
  soldAt.setDate(soldAt.getDate() - listing.daysOnMarket);
  return soldAt.toISOString();
}

const adminDemoListingSchema = z.object({
  askingPriceCents: z.coerce.number().int().nonnegative(),
  bathrooms: z.coerce.number().int().nonnegative(),
  bedrooms: z.coerce.number().int().nonnegative(),
  buyerIncentive: z.string().trim().catch(""),
  daysOnMarket: z.coerce.number().int().nonnegative().catch(0),
  erfSize: z.coerce.number().int().nonnegative().catch(0),
  features: z.array(z.string().trim()).catch([]),
  floorSize: z.coerce.number().int().nonnegative().catch(0),
  garages: z.coerce.number().int().nonnegative().catch(0),
  location: z.string().trim().min(2),
  parking: z.coerce.number().int().nonnegative().catch(0),
  soldAt: z.string().trim().optional(),
  soldPriceCents: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["published", "sold"]),
  title: z.string().trim().min(3),
});

const adminDemoListingsSchema = z.array(adminDemoListingSchema).min(1);

function parseAdminDemoListings(value: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Listings JSON is not valid JSON.");
  }

  const result = adminDemoListingsSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message || "Check the demo listings JSON.",
    );
  }

  return result.data.map((listing) => ({
    ...listing,
    buyerIncentive: listing.buyerIncentive || "",
    features: listing.features.filter(Boolean),
    soldAt: listing.status === "sold" ? listing.soldAt : undefined,
    soldPriceCents:
      listing.status === "sold" ? listing.soldPriceCents || listing.askingPriceCents : undefined,
  }));
}

function revalidateDemoProfile() {
  revalidatePath("/admin");
  revalidatePath("/agents");
  revalidatePath("/listings");
  revalidatePath("/admin/settings/demo-profile");
  revalidatePath("/settings/billing");
  revalidatePath(`/users/${demoProfileUsername}`);
  revalidatePath(`/users/${demoProfileUsername}/performance`);
}

async function setDemoSubscriptionActive(active: boolean) {
  const [demo] = await sql<Array<{ agent_profile_id: string | null; id: string }>>`
    SELECT u.id, ap.id AS agent_profile_id
    FROM users u
    LEFT JOIN agent_profiles ap ON ap.user_id = u.id
    WHERE u.email = ${demoProfileEmail}
      AND u.is_demo = true
    LIMIT 1
  `;

  if (!demo) {
    await ensureDemoProfile({ visible: true });
    return setDemoSubscriptionActive(active);
  }

  const now = new Date();
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
  const expiredAt = new Date(now.getTime() - 60_000);

  await sql`
    INSERT INTO subscriptions (
      user_id,
      agent_profile_id,
      provider,
      status,
      amount_cents,
      currency,
      interval,
      provider_customer_id,
      provider_reference,
      current_period_start,
      current_period_end,
      cancelled_at,
      created_at,
      updated_at
    )
    VALUES (
      ${demo.id}::uuid,
      ${demo.agent_profile_id}::uuid,
      'stripe',
      ${active ? "active" : "cancelled"},
      9900,
      'ZAR',
      'month',
      'cus_demo_homzie_agent',
      ${demoSubscriptionReference},
      ${now.toISOString()},
      ${active ? currentPeriodEnd.toISOString() : expiredAt.toISOString()},
      ${active ? null : now.toISOString()},
      now(),
      now()
    )
    ON CONFLICT (provider_reference) DO UPDATE
    SET
      user_id = EXCLUDED.user_id,
      agent_profile_id = EXCLUDED.agent_profile_id,
      status = EXCLUDED.status,
      amount_cents = EXCLUDED.amount_cents,
      currency = EXCLUDED.currency,
      interval = EXCLUDED.interval,
      provider_customer_id = EXCLUDED.provider_customer_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      cancelled_at = EXCLUDED.cancelled_at,
      updated_at = now()
  `;
}

async function ensureDemoProfile({
  listings = demoListingSeeds,
  password,
  profile = defaultDemoProfileSeed,
  visible,
}: {
  listings?: DemoListingSeed[];
  password?: string;
  profile?: DemoProfileSeed;
  visible: boolean;
}) {
  await assertActiveAdmin();
  const passwordHash = await hashPassword(password || defaultDemoProfilePassword);
  const shouldResetPassword = Boolean(password);

  const [user] = await sql<Array<{ id: string }>>`
    INSERT INTO users (
      name,
      username,
      email,
      password_hash,
      bio,
      location,
      contact_email,
      public_contact_visible,
      profile_visible,
      search_visible,
      is_demo,
      role,
      status,
      email_verified,
      created_at,
      updated_at
    )
    VALUES (
      ${profile.name},
      ${profile.username},
      ${profile.email},
      ${passwordHash},
      ${profile.bio},
      ${profile.location},
      ${profile.contactEmail},
      true,
      ${visible},
      ${visible},
      true,
      'user',
      'active',
      true,
      now(),
      now()
    )
    ON CONFLICT (email) DO UPDATE
    SET
      name = EXCLUDED.name,
      username = EXCLUDED.username,
      bio = EXCLUDED.bio,
      location = EXCLUDED.location,
      contact_email = EXCLUDED.contact_email,
      public_contact_visible = true,
      profile_visible = EXCLUDED.profile_visible,
      search_visible = EXCLUDED.search_visible,
      is_demo = true,
      password_hash = CASE
        WHEN ${shouldResetPassword} THEN EXCLUDED.password_hash
        ELSE COALESCE(users.password_hash, EXCLUDED.password_hash)
      END,
      status = 'active',
      email_verified = true,
      updated_at = now()
    RETURNING id
  `;

  if (!user) {
    throw new Error("Could not create the demo profile.");
  }

  const [agentProfile] = await sql<Array<{ id: string }>>`
    INSERT INTO agent_profiles (
      user_id,
      display_name,
      headline,
      bio,
      location,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${user.id}::uuid,
      ${profile.name},
      ${profile.headline},
      'A benchmark profile for agents: verified sales, standout mandates, and visible performance signals all in one place.',
      ${profile.location},
      'active',
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      display_name = EXCLUDED.display_name,
      headline = EXCLUDED.headline,
      bio = EXCLUDED.bio,
      location = EXCLUDED.location,
      status = 'active',
      updated_at = now()
    RETURNING id
  `;

  if (!agentProfile) {
    throw new Error("Could not create the demo agent profile.");
  }

  await sql`
    DELETE FROM property_listings
    WHERE user_id = ${user.id}::uuid
      AND is_demo_content = true
  `;

  for (const listing of listings) {
    const soldAt = listing.soldAt || null;
    const status = visible ? listing.status : "archived";
    const outcomeAt = listing.status === "sold" ? soldAt : null;
    const reservationEnabled = listing.status === "published";
    const reservationAmountCents = reservationEnabled ? 5000000 : null;
    const archivedAt = visible ? null : new Date().toISOString();

    await sql`
      INSERT INTO property_listings (
        user_id,
        agent_profile_id,
        listing_type,
        property_type,
        title,
        description,
        location,
        price_label,
        asking_price_cents,
        sold_price_cents,
        reservation_enabled,
        reservation_amount_cents,
        is_demo_content,
        media,
        details,
        features,
        mandate_type,
        status,
        proof_status,
        listed_at,
        outcome_at,
        sold_at,
        archived_at,
        created_at,
        updated_at
      )
      VALUES (
        ${user.id}::uuid,
        ${agentProfile.id}::uuid,
        'sale',
        'free_standing_house',
        ${listing.title},
        ${"A premium demo listing used to show how a polished Homzie profile can present trust, momentum, and high-value sales outcomes."},
        ${listing.location},
        ${`R ${(listing.askingPriceCents / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`},
        ${listing.askingPriceCents},
        ${listing.soldPriceCents || null},
        ${reservationEnabled && visible},
        ${reservationAmountCents},
        true,
        '[]'::jsonb,
        ${demoListingDetails(listing)}::jsonb,
        ${demoListingFeatures(listing)}::jsonb,
        'exclusive',
        ${status},
        ${listing.status === "sold" ? "verified" : "not_required"},
        ${demoListedAt(listing)},
        ${outcomeAt},
        ${soldAt},
        ${archivedAt},
        ${demoListedAt(listing)},
        now()
      )
    `;
  }
}

export async function updateAdminDemoProfileSettings(
  _previousState: AdminDemoProfileSettingsState,
  formData: FormData,
): Promise<AdminDemoProfileSettingsState> {
  try {
    const username = normalizeUsername(
      formString(formData, "username") || demoProfileUsername,
    );
    const usernameIssue = validateUsername(username);

    if (usernameIssue) {
      return {
        ok: false,
        message: usernameIssue,
      };
    }

    const email = z
      .string()
      .email()
      .parse(formString(formData, "email") || demoProfileEmail)
      .toLowerCase();
    const password = formString(formData, "password");

    if (password && password.length < 8) {
      return {
        ok: false,
        message: "Demo password must be at least 8 characters.",
      };
    }

    const listings = parseAdminDemoListings(formString(formData, "listingsJson"));
    const visible = formBoolean(formData, "visible");

    await ensureDemoProfile({
      listings,
      password: password || undefined,
      profile: {
        bio: formString(formData, "bio") || defaultDemoProfileSeed.bio,
        contactEmail: formString(formData, "contactEmail") || email,
        email,
        headline: formString(formData, "headline") || defaultDemoProfileSeed.headline,
        location: formString(formData, "location") || defaultDemoProfileSeed.location,
        name: formString(formData, "name") || defaultDemoProfileSeed.name,
        username,
      },
      visible,
    });
    revalidateDemoProfile();
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/demo-profile");

    return {
      ok: true,
      message: password
        ? "Demo profile saved and password reset."
        : "Demo profile saved.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not save demo profile settings.",
    };
  }
}

export async function toggleAdminDemoSubscriptionAction(formData: FormData) {
  await assertActiveAdmin();
  await setDemoSubscriptionActive(formData.get("subscribed") === "true");
  revalidateDemoProfile();
}

export async function refreshDemoProfileAction() {
  await ensureDemoProfile({ visible: true });
  revalidateDemoProfile();
}

export async function showDemoProfileAction() {
  await ensureDemoProfile({ visible: true });
  revalidateDemoProfile();
}

export async function hideDemoProfileAction() {
  await assertActiveAdmin();

  await sql`
    UPDATE users
    SET
      profile_visible = false,
      search_visible = false,
      updated_at = now()
    WHERE email = ${demoProfileEmail}
      AND is_demo = true
  `;

  await sql`
    UPDATE property_listings
    SET
      status = 'archived',
      reservation_enabled = false,
      archived_at = COALESCE(archived_at, now()),
      updated_at = now()
    WHERE user_id = (
      SELECT id
      FROM users
      WHERE email = ${demoProfileEmail}
        AND is_demo = true
      LIMIT 1
    )
      AND is_demo_content = true
  `;

  revalidateDemoProfile();
}

export async function updateAdminAdsSettings(
  _previousState: AdminAdsSettingsState,
  formData: FormData,
): Promise<AdminAdsSettingsState> {
  try {
    await assertActiveAdmin();

    const next = adsSettingsFromFormData(formData);
    const validationMessage = validateAdsSettings(next);

    if (validationMessage) {
      return {
        ok: false,
        message: validationMessage,
      };
    }

    await saveStoredAdsSettings(next);
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/ads");
    revalidatePath("/settings/ads-center");

    return {
      ok: true,
      message: "Ads settings saved.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not save ads settings.",
    };
  }
}

function mergeGoogleAdsSettings(
  formData: FormData,
  existing: GoogleAdsSettings,
): GoogleAdsSettings {
  const next = { ...defaultGoogleAdsSettings, ...existing };

  const stringFields = [
    "developerToken",
    "clientId",
    "clientSecret",
    "refreshToken",
    "customerId",
    "loginCustomerId",
    "dsaCampaignId",
    "siteDomain",
    "languageCode",
    "pageFeedLabel",
    "pageFeedToken",
    "descriptionLine1",
    "descriptionLine2",
  ] as const;

  for (const field of stringFields) {
    const value = formString(formData, field);

    if (value) {
      next[field] = value;
    }
  }

  next.enabled = formBoolean(formData, "enabled");
  next.automationEnabled = formBoolean(formData, "automationEnabled");

  return next;
}

function validateGoogleAdsSettings(settings: GoogleAdsSettings) {
  if (!settings.enabled) {
    return null;
  }

  if (!settings.pageFeedToken) {
    return "Add a page feed token so Google can fetch your protected feed URL.";
  }

  if (!settings.siteDomain) {
    return "Add the Homzie domain used by your Dynamic Search Ads campaign.";
  }

  if (settings.automationEnabled) {
    if (!settings.developerToken || !settings.clientId || !settings.clientSecret) {
      return "Automation needs a Google developer token, client ID, and client secret.";
    }

    if (!settings.refreshToken || !settings.customerId || !settings.dsaCampaignId) {
      return "Automation needs a refresh token, customer ID, and DSA campaign ID.";
    }
  }

  return null;
}

export async function updateAdminGoogleAdsSettings(
  _previousState: AdminGoogleAdsSettingsState,
  formData: FormData,
): Promise<AdminGoogleAdsSettingsState> {
  try {
    await assertActiveAdmin();

    const existing = await getStoredGoogleAdsSettings();
    const next = mergeGoogleAdsSettings(formData, existing);
    const validationMessage = validateGoogleAdsSettings(next);

    if (validationMessage) {
      return {
        ok: false,
        message: validationMessage,
      };
    }

    await saveStoredGoogleAdsSettings(next);
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/ads");
    revalidatePath("/settings/ads-center");

    return {
      ok: true,
      message: "Google Ads settings saved.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not save Google Ads settings.",
    };
  }
}

export type AdminMusicApiSettingsState = {
  message: string;
  ok: boolean;
};

export async function updateAdminMusicApiSettings(
  previousState: AdminMusicApiSettingsState,
  formData: FormData,
): Promise<AdminMusicApiSettingsState> {
  void previousState;

  try {
    await assertActiveAdmin();

    const existing = await getStoredMusicApiSettings();
    const jamendoClientId = String(formData.get("jamendoClientId") ?? "").trim();
    const freesoundApiKey = String(formData.get("freesoundApiKey") ?? "").trim();

    const settings: MusicApiSettings = {
      jamendoClientId: jamendoClientId || existing.jamendoClientId,
      freesoundApiKey: freesoundApiKey || existing.freesoundApiKey,
    };

    await saveStoredMusicApiSettings(settings);

    revalidatePath("/admin/settings");

    return { ok: true, message: "Music API settings saved." };
  } catch {
    return { ok: false, message: "Could not save music API settings." };
  }
}

export async function getAdminMusicApiSettings(): Promise<MusicApiSettings> {
  await assertActiveAdmin();
  return getStoredMusicApiSettings();
}

export async function runAdminGoogleAdsAutomationSync(
  previousState: AdminGoogleAdsAutomationState,
): Promise<AdminGoogleAdsAutomationState> {
  void previousState;

  try {
    await assertActiveAdmin();

    const result = await syncGoogleDsaCampaignState();
    const health = await getGoogleDsaAutomationHealth();

    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/settings/ads");
    revalidatePath("/settings/ads-center");

    return {
      ok: true,
      message:
        result.state === "campaign_enabled"
          ? "Google DSA campaign is enabled and in sync."
          : result.state === "campaign_paused"
            ? "Google DSA campaign is paused because no published listing URLs are active."
            : result.state === "feed_active"
              ? "Feed eligibility is active. Google API pause/resume automation is currently disabled."
              : "No active Google listing URLs remain. Manual pause is still required in Google Ads.",
      health,
    };
  } catch (error) {
    const health = await getGoogleDsaAutomationHealth().catch(() => null);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not run the Google Ads automation check.",
      health,
    };
  }
}
