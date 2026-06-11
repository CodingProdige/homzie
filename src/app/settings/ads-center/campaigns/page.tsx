import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SettingsPageHeader } from "../../settings-page-header";
import { InvoiceHistoryTable } from "../../billing/billing-client-controls";
import { AdsCampaignsList } from "../ads-campaigns-list";
import { getAdsCampaignsPageData } from "../data";

function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
}

export default async function AdsCenterCampaignsPage() {
  const data = await getAdsCampaignsPageData();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] overflow-x-clip bg-background px-4 pb-10 text-foreground sm:px-6 lg:px-10">
      <SettingsPageHeader
        title="Campaigns"
        backHref="/settings/ads-center"
        actions={
          <Button asChild variant="outline" className="h-11 px-5 text-sm">
            <Link href="/settings/ads-center">New campaign</Link>
          </Button>
        }
      />

      <div className="space-y-5 py-6">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                Live campaigns
              </p>
              <p className="mt-1.5 text-2xl font-black">
                {data.billingSummary.activeCampaignCount}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                Accrued spend
              </p>
              <p className="mt-1.5 text-2xl font-black">
                {formatCurrencyFromCents(data.billingSummary.deliveredSpendCents)}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                Awaiting invoice
              </p>
              <p className="mt-1.5 text-2xl font-black">
                {formatCurrencyFromCents(data.billingSummary.uninvoicedSpendCents)}
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                Next billing date
              </p>
              <p className="mt-1.5 text-2xl font-black leading-tight">
                {data.billingSummary.nextBillingDateLabel}
              </p>
              {data.billingSummary.openInvoiceCount > 0 ? (
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {data.billingSummary.openInvoiceCount} open invoice
                  {data.billingSummary.openInvoiceCount === 1 ? "" : "s"} ·{" "}
                  {formatCurrencyFromCents(data.billingSummary.openInvoiceTotalCents)} due
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <AdsCampaignsList campaigns={data.campaigns} />

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-bold">Invoice history</h2>
            <span className="text-sm font-semibold text-muted-foreground">
              Paid to date{" "}
              <span className="font-black text-foreground">
                {formatCurrencyFromCents(data.billingSummary.paidInvoiceTotalCents)}
              </span>
            </span>
          </div>
          <InvoiceHistoryTable
            invoices={
              data.invoices.length
                ? data.invoices
                : [
                    {
                      amount: "-",
                      date: "No invoices yet",
                      description:
                        "Ads invoices will appear once a billing period closes with delivered spend.",
                      downloadUrl: null,
                      id: "empty",
                      status: "pending",
                    },
                  ]
            }
          />
        </section>
      </div>
    </main>
  );
}
