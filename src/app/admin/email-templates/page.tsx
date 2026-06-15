import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, MonitorDot, Smartphone } from "lucide-react";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { ensureDefaultEmailTemplates } from "@/modules/email/server";
import { notificationRegistry } from "@/modules/notifications/registry";

type TemplatePickerItem = {
  category: string;
  description: string | null;
  enabled: boolean;
  key: string;
  name: string;
  surfaces: string[];
};

export const metadata: Metadata = {
  title: "Email Templates | Homzie Admin",
  description: "Manage Homzie transactional email templates.",
};

function templateSurfaces(key: string) {
  const notification = notificationRegistry.find(
    (item) => item.emailTemplateKey === key,
  );

  if (!notification) return ["Email"];

  return ["In-app", "Push", "Email"];
}

function surfaceIcon(surface: string) {
  if (surface === "Push") return Smartphone;
  if (surface === "In-app") return MonitorDot;

  return Mail;
}

export default async function AdminEmailTemplatesPage() {
  await ensureDefaultEmailTemplates();

  const templateRows = await db
    .select({
      category: emailTemplates.category,
      description: emailTemplates.description,
      enabled: emailTemplates.enabled,
      key: emailTemplates.key,
      name: emailTemplates.name,
    })
    .from(emailTemplates)
    .orderBy(emailTemplates.category, emailTemplates.name);
  const templates: TemplatePickerItem[] = templateRows.map((template) => ({
    category: template.category,
    description: template.description,
    enabled: template.enabled,
    key: template.key,
    name: template.name,
    surfaces: templateSurfaces(template.key),
  }));

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
          Notification templates
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-muted-foreground">
          Choose a template surface first, then open a focused editor with the
          variables, saved versions, rendered preview, and test delivery tools.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Link
            className="group rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/45 hover:bg-primary/5"
            href={`/admin/email-templates/${encodeURIComponent(template.key)}`}
            key={template.key}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase tracking-[0.14em] text-primary">
                  {template.category}
                </span>
                <span className="mt-2 block truncate text-base font-black text-foreground">
                  {template.name}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">
                  {template.key}
                </span>
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase text-muted-foreground">
                {template.enabled ? "On" : "Off"}
              </span>
            </div>
            {template.description ? (
              <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-muted-foreground">
                {template.description}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {template.surfaces.map((item) => {
                const Icon = surfaceIcon(item);

                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[10px] font-black uppercase text-muted-foreground ring-1 ring-border"
                    key={item}
                  >
                    <Icon className="size-3" />
                    {item}
                  </span>
                );
              })}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
