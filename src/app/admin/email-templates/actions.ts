"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  emailDeliveryLogs,
  emailTemplates,
  emailTemplateVersions,
  users,
} from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { renderEmailParts } from "@/modules/email/render";
import { sendSendGridEmail } from "@/modules/email/sendgrid";
import {
  notifyUser,
  sendTemplatedEmailToAddress,
} from "@/modules/email/server";

export type EmailTemplateActionState = {
  message: string;
  ok: boolean;
};

const emptyState: EmailTemplateActionState = {
  message: "",
  ok: false,
};

const saveSchema = z.object({
  enabled: z.boolean(),
  html: z.string().trim().min(1, "HTML body is required."),
  key: z.string().trim().min(1, "Template key is required."),
  preheader: z.string().trim().max(240).optional(),
  subject: z.string().trim().min(1, "Subject is required.").max(180),
  text: z.string().trim().min(1, "Plain-text body is required."),
});

const testSchema = saveSchema.extend({
  recipientEmail: z.string().trim().toLowerCase().email("Enter a test recipient."),
  sampleVariables: z.string().trim().optional(),
});

async function requireAdminUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in as an admin.");
  }

  const [admin] = await db
    .select({
      email: users.email,
      id: users.id,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Only active admins can manage email templates.");
  }

  return admin;
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) || "");
}

function parseSampleVariables(value: string | undefined) {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function saveEmailTemplateAction(
  _prevState: EmailTemplateActionState = emptyState,
  formData: FormData,
): Promise<EmailTemplateActionState> {
  void _prevState;

  try {
    const admin = await requireAdminUser();
    const parsed = saveSchema.safeParse({
      enabled: formData.get("enabled") === "on",
      html: formValue(formData, "html"),
      key: formValue(formData, "key"),
      preheader: formValue(formData, "preheader"),
      subject: formValue(formData, "subject"),
      text: formValue(formData, "text"),
    });

    if (!parsed.success) {
      return {
        message: parsed.error.issues[0]?.message || "Check the template fields.",
        ok: false,
      };
    }

    const [template] = await db
      .select({
        id: emailTemplates.id,
        sampleVariables: emailTemplates.sampleVariables,
        variables: emailTemplates.variables,
      })
      .from(emailTemplates)
      .where(eq(emailTemplates.key, parsed.data.key))
      .limit(1);

    if (!template) {
      return { message: "Template not found.", ok: false };
    }

    await db
      .update(emailTemplates)
      .set({
        enabled: parsed.data.enabled,
        html: parsed.data.html,
        preheader: parsed.data.preheader || null,
        subject: parsed.data.subject,
        text: parsed.data.text,
        updatedAt: new Date(),
        updatedByUserId: admin.id,
      })
      .where(eq(emailTemplates.id, template.id));

    await db.insert(emailTemplateVersions).values({
      createdByUserId: admin.id,
      html: parsed.data.html,
      preheader: parsed.data.preheader || null,
      sampleVariables: template.sampleVariables,
      subject: parsed.data.subject,
      templateId: template.id,
      text: parsed.data.text,
      variables: template.variables,
    });

    revalidatePath("/admin/email-templates");

    return { message: "Template saved.", ok: true };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Could not save template.",
      ok: false,
    };
  }
}

export async function sendTestEmailTemplateAction(
  _prevState: EmailTemplateActionState = emptyState,
  formData: FormData,
): Promise<EmailTemplateActionState> {
  void _prevState;

  try {
    await requireAdminUser();

    const parsed = testSchema.safeParse({
      enabled: true,
      html: formValue(formData, "html"),
      key: formValue(formData, "key"),
      preheader: formValue(formData, "preheader"),
      recipientEmail: formValue(formData, "recipientEmail"),
      sampleVariables: formValue(formData, "sampleVariables"),
      subject: formValue(formData, "subject"),
      text: formValue(formData, "text"),
    });

    if (!parsed.success) {
      return {
        message: parsed.error.issues[0]?.message || "Check the test email fields.",
        ok: false,
      };
    }

    const variables = parseSampleVariables(parsed.data.sampleVariables);
    const rendered = renderEmailParts({
      html: parsed.data.html,
      preheader: parsed.data.preheader,
      subject: parsed.data.subject,
      text: parsed.data.text,
      variables,
    });

    await sendSendGridEmail({
      html: rendered.html,
      subject: `[Test] ${rendered.subject}`,
      text: rendered.text,
      to: { email: parsed.data.recipientEmail },
    });

    return { message: `Test sent to ${parsed.data.recipientEmail}.`, ok: true };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Could not send the test email.",
      ok: false,
    };
  }
}

export async function rollbackEmailTemplateVersionAction(
  _prevState: EmailTemplateActionState = emptyState,
  formData: FormData,
): Promise<EmailTemplateActionState> {
  void _prevState;

  try {
    const admin = await requireAdminUser();
    const templateKey = formValue(formData, "templateKey");
    const versionId = formValue(formData, "versionId");

    if (!templateKey || !versionId) {
      return { message: "Choose a template version to restore.", ok: false };
    }

    const [template] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.key, templateKey))
      .limit(1);

    if (!template) {
      return { message: "Template not found.", ok: false };
    }

    const [version] = await db
      .select()
      .from(emailTemplateVersions)
      .where(eq(emailTemplateVersions.id, versionId))
      .limit(1);

    if (!version || version.templateId !== template.id) {
      return { message: "Template version not found.", ok: false };
    }

    await db
      .update(emailTemplates)
      .set({
        html: version.html,
        preheader: version.preheader,
        sampleVariables: version.sampleVariables,
        subject: version.subject,
        text: version.text,
        updatedAt: new Date(),
        updatedByUserId: admin.id,
        variables: version.variables,
      })
      .where(eq(emailTemplates.id, template.id));

    await db.insert(emailTemplateVersions).values({
      createdByUserId: admin.id,
      html: version.html,
      preheader: version.preheader,
      sampleVariables: version.sampleVariables,
      subject: version.subject,
      templateId: template.id,
      text: version.text,
      variables: version.variables,
    });

    revalidatePath("/admin/email-templates");

    return { message: "Template version restored.", ok: true };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Could not restore template version.",
      ok: false,
    };
  }
}

export async function resendEmailDeliveryAction(
  _prevState: EmailTemplateActionState = emptyState,
  formData: FormData,
): Promise<EmailTemplateActionState> {
  void _prevState;

  try {
    await requireAdminUser();

    const logId = formValue(formData, "logId");

    if (!logId) {
      return { message: "Choose a delivery log to resend.", ok: false };
    }

    const [log] = await db
      .select()
      .from(emailDeliveryLogs)
      .where(eq(emailDeliveryLogs.id, logId))
      .limit(1);

    if (!log) {
      return { message: "Delivery log not found.", ok: false };
    }

    const variables =
      log.variables && typeof log.variables === "object" && !Array.isArray(log.variables)
        ? (log.variables as Record<string, unknown>)
        : {};

    if (log.userId) {
      await notifyUser({
        bypassPreferences: true,
        eventKey: `${log.eventKey}.resend`,
        templateKey: log.templateKey,
        userId: log.userId,
        variables,
      });
    } else {
      await sendTemplatedEmailToAddress({
        eventKey: `${log.eventKey}.resend`,
        recipientEmail: log.recipientEmail,
        templateKey: log.templateKey,
        variables,
      });
    }

    revalidatePath("/admin/email-templates");

    return { message: "Email resent.", ok: true };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Could not resend email.",
      ok: false,
    };
  }
}
