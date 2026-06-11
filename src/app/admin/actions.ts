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
import {
  defaultReservationSettings,
  saveStoredReservationSettings,
  type ReservationSettings,
} from "@/modules/platform-settings/reservation-settings";

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
