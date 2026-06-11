import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  AdminReservationSettingsForm,
  type AdminReservationSettingsView,
} from "@/app/admin/admin-reservation-settings-form";
import { Button } from "@/components/ui/button";
import { getStoredReservationSettings } from "@/modules/platform-settings/reservation-settings";

export const metadata: Metadata = {
  title: "Reservation Settings | Homzie Admin",
  description: "Manage listing reservation fees and checkout settings.",
};

export default async function AdminReservationSettingsPage() {
  const settings = await getStoredReservationSettings();
  const view: AdminReservationSettingsView = {
    enabled: settings.enabled,
    platformFeePercent: settings.platformFeePercent,
    processingFeePercent: settings.processingFeePercent,
    processingFixedRands: settings.processingFixedCents / 100,
    minReservationAmountRands: settings.minReservationAmountCents / 100,
    maxReservationAmountRands: settings.maxReservationAmountCents / 100,
    termsText: settings.termsText,
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <Button variant="ghost" asChild className="-ml-3 mb-6">
        <Link href="/admin/settings">
          <ArrowLeft className="size-4" />
          Settings
        </Link>
      </Button>

      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Reservations
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
          Set the fee model and buyer-facing terms for listing reservation
          payments.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
        <AdminReservationSettingsForm settings={view} />
      </section>
    </main>
  );
}
