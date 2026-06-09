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
  getStoredStripeSettings,
  saveStoredStripeSettings,
  stripeModes,
  type StripeMode,
  type StripeModeSettings,
  type StripeSettings,
} from "@/modules/platform-settings/stripe-settings";

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
