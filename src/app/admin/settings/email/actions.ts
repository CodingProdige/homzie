"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { verifySmtpConnection } from "@/modules/email/transport";
import {
  getEmailSettingsView,
  saveStoredEmailSettings,
} from "@/modules/platform-settings/email-settings";

export type AdminEmailSettingsState = {
  ok: boolean;
  message: string;
};

const headerText = z
  .string()
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    message: "Sender details cannot contain line breaks or control characters.",
  })
  .transform((value) => value.trim());

const emailAddress = z.string().email("Enter a valid email address.").max(254);
const emailSettingsSchema = z.object({
  provider: z.enum(["sendgrid", "smtp"]),
  fromEmail: headerText.pipe(emailAddress),
  fromName: headerText.pipe(
    z.string().min(1, "Enter a sender name.").max(100, "Use a sender name of 100 characters or fewer."),
  ),
  replyToEmail: headerText.pipe(z.union([z.literal(""), emailAddress])),
});

async function isActiveAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) return false;

  const [admin] = await sql<Array<{ id: string }>>`
    SELECT id
    FROM users
    WHERE id = ${session.user.id}
      AND role = 'admin'
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return Boolean(admin);
}

export async function updateAdminEmailSettings(
  _previousState: AdminEmailSettingsState,
  formData: FormData,
): Promise<AdminEmailSettingsState> {
  try {
    if (!(await isActiveAdmin())) {
      return { ok: false, message: "Sign in as an active admin to change email delivery." };
    }

    const parsed = emailSettingsSchema.safeParse({
      provider: formData.get("provider"),
      fromEmail: formData.get("fromEmail"),
      fromName: formData.get("fromName"),
      replyToEmail: formData.get("replyToEmail") ?? "",
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: parsed.error.issues[0]?.message || "Check the sender details and try again.",
      };
    }

    const view = await getEmailSettingsView();
    const configured = parsed.data.provider === "smtp"
      ? view.smtpConfigured
      : view.sendgridConfigured;

    if (!configured) {
      return {
        ok: false,
        message: "Configure the selected provider's server credentials before saving it.",
      };
    }

    await saveStoredEmailSettings(parsed.data);
    revalidatePath("/admin/settings/email");

    return { ok: true, message: "Email delivery settings saved." };
  } catch {
    return { ok: false, message: "Could not save email delivery settings. Please try again." };
  }
}

export async function checkAdminSmtpConnection(): Promise<AdminEmailSettingsState> {
  try {
    if (!(await isActiveAdmin())) {
      return { ok: false, message: "Sign in as an active admin to check the SMTP connection." };
    }

    const view = await getEmailSettingsView();
    if (!view.smtpConfigured) {
      return { ok: false, message: "Configure SMTP server credentials before checking the connection." };
    }

    await verifySmtpConnection();

    return {
      ok: true,
      message: "SMTP connection and sign-in succeeded. No email was sent.",
    };
  } catch {
    return {
      ok: false,
      message: "SMTP connection failed. Check the relay details and credentials, then try again.",
    };
  }
}
