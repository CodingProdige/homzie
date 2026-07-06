import type { Metadata } from "next";
import { Building2, ReceiptText, UsersRound } from "lucide-react";

import { BackButton } from "@/components/back-button";
import {
  formatAgencyBillingMoney,
  getAdminAgencyBillingOverview,
} from "@/modules/agencies/billing";
import {
  AdminAgencyBillingSettingsForm,
  type AdminAgencyBillingSettingsView,
} from "../../admin-agency-billing-settings-form";

export const metadata: Metadata = {
  title: "Agency Billing Settings | Homzie Admin",
  description: "Manage agency automated billing and agency-funded member seat pricing.",
};

function SummaryMetric({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            {title}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </div>
  );
}

export default async function AdminAgencyBillingSettingsPage() {
  const overview = await getAdminAgencyBillingOverview();
  const settings: AdminAgencyBillingSettingsView = {
    currency: overview.currency,
    seatPriceRands: overview.unitAmountCents / 100,
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin/settings" label="Settings" />

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Automated billing
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Agency billing
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
          Set the agency-funded member seat price used across branch and independent agency workspaces.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <AdminAgencyBillingSettingsForm settings={settings} />
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <SummaryMetric
          title="Agencies"
          value={String(overview.agencyCount)}
          description={`${overview.billingReadyCount} have billing information saved.`}
          icon={<Building2 className="size-5" />}
        />
        <SummaryMetric
          title="Billable seats"
          value={String(overview.billableSeats)}
          description="Current non-removed agency member seats across the platform."
          icon={<UsersRound className="size-5" />}
        />
        <SummaryMetric
          title="Projected monthly"
          value={formatAgencyBillingMoney(
            overview.projectedMonthlyCents,
            overview.currency,
          )}
          description="Based on current seats; actual billing uses monthly peak seats."
          icon={<ReceiptText className="size-5" />}
        />
      </div>
    </main>
  );
}
