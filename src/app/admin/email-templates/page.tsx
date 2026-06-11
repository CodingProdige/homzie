import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { db } from "@/db";
import {
  emailDeliveryLogs,
  emailTemplates,
  emailTemplateVersions,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ensureDefaultEmailTemplates } from "@/modules/email/server";

import {
  EmailTemplateManager,
  type AdminEmailTemplate,
} from "./email-template-manager";

export const metadata: Metadata = {
  title: "Email Templates | Homzie Admin",
  description: "Manage Homzie transactional email templates.",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asVariables(value: unknown): AdminEmailTemplate["variables"] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is AdminEmailTemplate["variables"][number] =>
            Boolean(
              item &&
                typeof item === "object" &&
                "key" in item &&
                typeof item.key === "string" &&
                "label" in item &&
                typeof item.label === "string",
            ),
        )
        .map((item) => ({
          fallback: typeof item.fallback === "string" ? item.fallback : undefined,
          key: item.key,
          label: item.label,
        }))
    : [];
}

export default async function AdminEmailTemplatesPage() {
  await ensureDefaultEmailTemplates();

  const [templateRows, logs, versionRows] = await Promise.all([
    db
      .select()
      .from(emailTemplates)
      .orderBy(emailTemplates.category, emailTemplates.name),
    db
      .select({
        id: emailDeliveryLogs.id,
        createdAt: emailDeliveryLogs.createdAt,
        error: emailDeliveryLogs.error,
        recipientEmail: emailDeliveryLogs.recipientEmail,
        status: emailDeliveryLogs.status,
        subject: emailDeliveryLogs.subject,
        templateKey: emailDeliveryLogs.templateKey,
      })
      .from(emailDeliveryLogs)
      .orderBy(desc(emailDeliveryLogs.createdAt))
      .limit(20),
    db
      .select({
        createdAt: emailTemplateVersions.createdAt,
        id: emailTemplateVersions.id,
        subject: emailTemplateVersions.subject,
        templateId: emailTemplateVersions.templateId,
      })
      .from(emailTemplateVersions)
      .orderBy(desc(emailTemplateVersions.createdAt))
      .limit(60),
  ]);

  const templates: AdminEmailTemplate[] = templateRows.map((template) => ({
    category: template.category,
    description: template.description,
    enabled: template.enabled,
    html: template.html,
    key: template.key,
    name: template.name,
    preheader: template.preheader,
    sampleVariables: asRecord(template.sampleVariables),
    subject: template.subject,
    text: template.text,
    updatedAt: template.updatedAt.toISOString(),
    variables: asVariables(template.variables),
  }));
  const templateKeyById = new Map(
    templateRows.map((template) => [template.id, template.key]),
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Button variant="ghost" asChild className="mb-6 px-0">
        <Link href="/admin/settings">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
      </Button>

      <div className="mb-8">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Email templates
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-muted-foreground">
          Edit transactional templates, insert backend variables, preview the
          rendered HTML, and send test emails before publishing changes.
        </p>
      </div>

      <EmailTemplateManager
        deliveryLogs={logs.map((log) => ({
          createdAt: log.createdAt.toISOString(),
          error: log.error,
          id: log.id,
          recipientEmail: log.recipientEmail,
          status: log.status,
          subject: log.subject,
          templateKey: log.templateKey,
        }))}
        templates={templates}
        versions={versionRows.map((version) => ({
          createdAt: version.createdAt.toISOString(),
          id: version.id,
          subject: version.subject,
          templateKey: templateKeyById.get(version.templateId) || "",
        }))}
      />
    </main>
  );
}
