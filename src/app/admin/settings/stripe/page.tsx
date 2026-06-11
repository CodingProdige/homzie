import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getStoredStripeSettings } from "@/modules/platform-settings/stripe-settings";
import {
  AdminStripeSettingsForm,
  type AdminStripeSettingsView,
} from "../../admin-stripe-settings-form";

export const metadata: Metadata = {
  title: "Stripe Settings | Homzie Admin",
  description: "Manage Stripe payment credentials for Homzie.",
};

function toStripeSettingsView(
  settings: Awaited<ReturnType<typeof getStoredStripeSettings>>,
): AdminStripeSettingsView {
  return {
    mode: settings.mode,
    test: settings.test,
    live: settings.live,
  };
}

export default async function AdminStripeSettingsPage() {
  const stripeSettings = await getStoredStripeSettings();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/admin/settings"
        className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        Settings
      </Link>

      <div className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
          Payments
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Stripe
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
          Configure sandbox and live Stripe credentials, webhook signing
          secrets, and subscription price IDs.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <AdminStripeSettingsForm settings={toStripeSettingsView(stripeSettings)} />
      </section>
    </main>
  );
}
