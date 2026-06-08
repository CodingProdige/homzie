"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
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
