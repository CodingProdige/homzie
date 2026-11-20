import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { BackButton } from "@/components/back-button";
import { sql } from "@/db";
import { authOptions } from "@/modules/auth/config";
import { getEmailSettingsView } from "@/modules/platform-settings/email-settings";
import {
  AdminEmailSettingsForm,
  type AdminEmailSettingsView,
} from "../../admin-email-settings-form";

export const metadata: Metadata = {
  title: "Email Delivery Settings | Homzie Admin",
  description: "Manage Homzie's email provider and sender details.",
};

export default async function AdminEmailSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/admin/settings/email");
  }

  const [admin] = await sql<Array<{ id: string }>>`
    SELECT id
    FROM users
    WHERE id = ${session.user.id}
      AND role = 'admin'
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1
  `;
  if (!admin) redirect("/");

  const settings = await getEmailSettingsView();
  const view: AdminEmailSettingsView = {
    settings: {
      provider: settings.provider,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyToEmail: settings.replyToEmail,
    },
    sendgridConfigured: settings.sendgridConfigured,
    smtpConfigured: settings.smtpConfigured,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin/settings" label="Settings" />

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Email</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Email delivery</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Choose the email provider and sender details for platform messages, then check the SMTP connection.
        </p>
      </div>

      <div className="mt-8">
        <AdminEmailSettingsForm view={view} />
      </div>
    </main>
  );
}
