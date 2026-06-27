import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";

import { BackButton } from "@/components/back-button";
import { db } from "@/db";
import {
  emailDeliveryLogs,
  emailTemplates,
  emailTemplateVersions,
  notificationSurfaceTemplateVersions,
  notificationSurfaceTemplates,
} from "@/db/schema";
import { ensureDefaultEmailTemplates } from "@/modules/email/server";
import { ensureDefaultNotificationSurfaceTemplates } from "@/modules/notifications/server";

import {
  EmailTemplateManager,
  type AdminEmailTemplate,
} from "../../email-template-manager";
import { NotificationSurfaceTemplateEditor } from "../../notification-surface-template-editor";

type PageProps = {
  params: Promise<{ surface: string; templateKey: string }>;
};

export const metadata: Metadata = {
  title: "Edit Surface Template | Homzie Admin",
  description: "Edit a Homzie notification surface template.",
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

function surfaceLabel(surface: string) {
  if (surface === "in_app") return "In-app";
  if (surface === "push") return "Push";
  if (surface === "email") return "Email";

  return "";
}

export default async function AdminTemplateSurfaceEditPage({ params }: PageProps) {
  await Promise.all([
    ensureDefaultEmailTemplates(),
    ensureDefaultNotificationSurfaceTemplates(),
  ]);

  const { surface: rawSurface, templateKey: rawTemplateKey } = await params;
  const templateKey = decodeURIComponent(rawTemplateKey);
  const surface = decodeURIComponent(rawSurface);

  if (!["email", "in_app", "push"].includes(surface)) {
    notFound();
  }

  if (surface === "email") {
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
    const selectedTemplate = templates.find((template) => template.key === templateKey);

    if (!selectedTemplate) {
      notFound();
    }

    const templateKeyById = new Map(
      templateRows.map((template) => [template.id, template.key]),
    );

    return (
      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
        <BackButton href={`/admin/email-templates/${encodeURIComponent(templateKey)}`} label="Surfaces" className="mb-6" />

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {selectedTemplate.category} / Email
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {selectedTemplate.name}
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-normal leading-7 text-muted-foreground">
            Edit the email subject, preheader, HTML body, plain text, and preview.
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
          initialTemplateKey={templateKey}
          singleTemplate
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

  const [template] = await db
    .select()
    .from(notificationSurfaceTemplates)
    .where(
      and(
        eq(notificationSurfaceTemplates.eventKey, templateKey),
        eq(notificationSurfaceTemplates.surface, surface),
      ),
    )
    .limit(1);

  if (!template || (surface !== "in_app" && surface !== "push")) {
    notFound();
  }

  const notificationSurface = surface;

  const versions = await db
    .select({
      body: notificationSurfaceTemplateVersions.body,
      createdAt: notificationSurfaceTemplateVersions.createdAt,
      id: notificationSurfaceTemplateVersions.id,
      title: notificationSurfaceTemplateVersions.title,
    })
    .from(notificationSurfaceTemplateVersions)
    .where(eq(notificationSurfaceTemplateVersions.templateId, template.id))
    .orderBy(desc(notificationSurfaceTemplateVersions.createdAt))
    .limit(20);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href={`/admin/email-templates/${encodeURIComponent(templateKey)}`} label="Surfaces" className="mb-6" />

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {template.category} / {surfaceLabel(surface)}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {template.name}
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-normal leading-7 text-muted-foreground">
          Edit the {surfaceLabel(surface).toLowerCase()} template for this event.
        </p>
      </div>

      <NotificationSurfaceTemplateEditor
        template={{
          body: template.body,
          category: template.category,
          description: template.description,
          enabled: template.enabled,
          eventKey: template.eventKey,
          name: template.name,
          sampleVariables: asRecord(template.sampleVariables),
          surface: notificationSurface,
          title: template.title,
          variables: asVariables(template.variables),
        }}
        versions={versions.map((version) => ({
          body: version.body,
          createdAt: version.createdAt.toISOString(),
          id: version.id,
          title: version.title,
        }))}
      />
    </main>
  );
}
