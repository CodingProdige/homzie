import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Mail, MonitorDot, Smartphone } from "lucide-react";

import Link from "next/link";

import { BackButton } from "@/components/back-button";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { ensureDefaultEmailTemplates } from "@/modules/email/server";
import { notificationRegistry } from "@/modules/notifications/registry";
import { ensureDefaultNotificationSurfaceTemplates } from "@/modules/notifications/server";

type PageProps = {
  params: Promise<{ templateKey: string }>;
};

export const metadata: Metadata = {
  title: "Choose Surface | Homzie Admin",
  description: "Choose which notification surface to edit.",
};

const surfaceOptions = [
  {
    description: "The copy shown inside the Homzie events feed.",
    icon: MonitorDot,
    key: "in_app",
    label: "In-app",
  },
  {
    description: "Browser push title and body copy.",
    icon: Smartphone,
    key: "push",
    label: "Push",
  },
  {
    description: "Subject, preheader, HTML body, and plain text email.",
    icon: Mail,
    key: "email",
    label: "Email",
  },
] as const;

export default async function AdminTemplateSurfacePickerPage({ params }: PageProps) {
  await Promise.all([
    ensureDefaultEmailTemplates(),
    ensureDefaultNotificationSurfaceTemplates(),
  ]);

  const { templateKey: rawTemplateKey } = await params;
  const templateKey = decodeURIComponent(rawTemplateKey);
  const notification = notificationRegistry.find(
    (item) => item.emailTemplateKey === templateKey,
  );
  const [emailTemplate] = await db
    .select({
      category: emailTemplates.category,
      description: emailTemplates.description,
      enabled: emailTemplates.enabled,
      key: emailTemplates.key,
      name: emailTemplates.name,
    })
    .from(emailTemplates)
    .where(eq(emailTemplates.key, templateKey))
    .limit(1);

  if (!emailTemplate) {
    notFound();
  }

  const availableSurfaces = notification
    ? surfaceOptions
    : surfaceOptions.filter((surface) => surface.key === "email");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin/email-templates" label="Templates" className="mb-6" />

      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {emailTemplate.category}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {emailTemplate.name}
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-normal leading-7 text-muted-foreground">
          Choose the surface you want to edit. Each surface has its own template
          so changes stay scoped to that channel.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {availableSurfaces.map((surface) => {
          const Icon = surface.icon;

          return (
            <Link
              className="rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/45 hover:bg-primary/5"
              href={`/admin/email-templates/${encodeURIComponent(templateKey)}/${surface.key}`}
              key={surface.key}
            >
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 text-xl font-semibold">{surface.label}</h2>
              <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                {surface.description}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
