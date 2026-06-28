import type { Metadata } from "next";
import { BarChart3, Receipt, Wallet } from "lucide-react";

import { BackButton } from "@/components/back-button";

import { getAdminAdBillingSummary } from "@/modules/ads/billing";
import { getStoredAdsSettings } from "@/modules/platform-settings/ads-settings";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";
import { getGoogleDsaAutomationHealth } from "@/modules/google-ads/dsa";
import { absoluteUrl } from "@/modules/site/url";
import {
  AdminAdsSettingsForm,
  type AdminAdsSettingsView,
} from "../../admin-ads-settings-form";
import { AdminGoogleAdsHealthCard } from "../../admin-google-ads-health-card";
import {
  AdminGoogleAdsSettingsForm,
  type AdminGoogleAdsSettingsView,
} from "../../admin-google-ads-settings-form";

function formatCurrencyFromCents(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
}

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

export const metadata: Metadata = {
  title: "Ads Settings | Homzie Admin",
  description: "Manage Homzie ads pricing, availability, and forecasting inputs.",
};

function toAdsSettingsView(
  settings: Awaited<ReturnType<typeof getStoredAdsSettings>>,
): AdminAdsSettingsView {
  return {
    allowGoogleAds: settings.allowGoogleAds,
    allowHomzieAds: settings.allowHomzieAds,
    defaultMarginPercent: settings.defaultMarginPercent,
    googleMarginPercent: settings.googleMarginPercent,
    homzieMarginPercent: settings.homzieMarginPercent,
    minCampaignBudgetRands: settings.minCampaignBudgetCents / 100,
    maxCampaignBudgetRands: settings.maxCampaignBudgetCents / 100,
    homzieAverageCpmRands: settings.homzieAverageCpmCents / 100,
    googleAverageCpmRands: settings.googleAverageCpmCents / 100,
    homzieReachSharePercent: settings.homzieReachSharePercent,
    googleReachSharePercent: settings.googleReachSharePercent,
    homzieCtrPercent: settings.homzieCtrPercent,
    googleCtrPercent: settings.googleCtrPercent,
    profileVisitRatePercent: settings.profileVisitRatePercent,
    listingViewRatePercent: settings.listingViewRatePercent,
    reelPlayRatePercent: settings.reelPlayRatePercent,
    leadRatePercent: settings.leadRatePercent,
  };
}

function toGoogleAdsSettingsView(
  settings: Awaited<ReturnType<typeof getStoredGoogleAdsSettings>>,
): AdminGoogleAdsSettingsView {
  const feedUrl = settings.pageFeedToken
    ? absoluteUrl(`/api/google-ads/page-feed?token=${settings.pageFeedToken}`)
    : absoluteUrl("/api/google-ads/page-feed?token=YOUR_FEED_TOKEN");
  const homzieFundedFeedUrl = settings.homzieFundedPageFeedToken
    ? absoluteUrl(
        `/api/google-ads/homzie-listings-page-feed?token=${settings.homzieFundedPageFeedToken}`,
      )
    : absoluteUrl(
        "/api/google-ads/homzie-listings-page-feed?token=YOUR_HOMZIE_FEED_TOKEN",
      );

  return {
    enabled: settings.enabled,
    automationEnabled: settings.automationEnabled,
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    customerId: settings.customerId,
    developerToken: settings.developerToken,
    dsaCampaignId: settings.dsaCampaignId,
    feedUrl,
    homzieFundedDsaCampaignId: settings.homzieFundedDsaCampaignId,
    homzieFundedEnabled: settings.homzieFundedEnabled,
    homzieFundedFeedUrl,
    homzieFundedPageFeedLabel: settings.homzieFundedPageFeedLabel,
    homzieFundedPageFeedToken: settings.homzieFundedPageFeedToken,
    hasClientId: Boolean(settings.clientId),
    hasClientSecret: Boolean(settings.clientSecret),
    hasDeveloperToken: Boolean(settings.developerToken),
    hasRefreshToken: Boolean(settings.refreshToken),
    languageCode: settings.languageCode,
    loginCustomerId: settings.loginCustomerId,
    pageFeedLabel: settings.pageFeedLabel,
    pageFeedToken: settings.pageFeedToken,
    refreshToken: settings.refreshToken,
    siteDomain: settings.siteDomain,
    descriptionLine1: settings.descriptionLine1,
    descriptionLine2: settings.descriptionLine2,
  };
}

export default async function AdminAdsSettingsPage() {
  const [adsSettings, googleAdsSettings, googleAdsHealth, billingSummary] = await Promise.all([
    getStoredAdsSettings(),
    getStoredGoogleAdsSettings(),
    getGoogleDsaAutomationHealth(),
    getAdminAdBillingSummary(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <BackButton href="/admin/settings" label="Settings" />

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Growth
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Ads
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
          Set campaign budget rules, channel-level margin, and the forecast assumptions that power user ads planning.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <AdminAdsSettingsForm settings={toAdsSettingsView(adsSettings)} />
      </section>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          title="Live campaigns"
          value={String(billingSummary.activeCampaignCount)}
          description="Campaigns currently in ready or live delivery states."
          icon={<BarChart3 className="size-5" />}
        />
        <SummaryMetric
          title="Delivered spend"
          value={formatCurrencyFromCents(billingSummary.totalDeliveredSpendCents)}
          description="Measured ad spend accrued across all tracked campaigns."
          icon={<Wallet className="size-5" />}
        />
        <SummaryMetric
          title="Awaiting invoice"
          value={formatCurrencyFromCents(billingSummary.uninvoicedSpendCents)}
          description="Ledger spend not yet attached to a user invoice."
          icon={<Receipt className="size-5" />}
        />
        <SummaryMetric
          title="Open invoices"
          value={String(billingSummary.openInvoiceCount)}
          description={`${formatCurrencyFromCents(billingSummary.openInvoiceTotalCents)} still outstanding. Paid to date ${formatCurrencyFromCents(billingSummary.paidInvoiceTotalCents)}.`}
          icon={<Receipt className="size-5" />}
        />
      </div>

      <div className="mt-6">
        <AdminGoogleAdsHealthCard health={googleAdsHealth} />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <AdminGoogleAdsSettingsForm
          settings={toGoogleAdsSettingsView(googleAdsSettings)}
        />
      </section>
    </main>
  );
}
