import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getStoredAdsSettings } from "@/modules/platform-settings/ads-settings";
import { getStoredGoogleAdsSettings } from "@/modules/platform-settings/google-ads-settings";
import { absoluteUrl } from "@/modules/site/url";
import {
  AdminAdsSettingsForm,
  type AdminAdsSettingsView,
} from "../../admin-ads-settings-form";
import {
  AdminGoogleAdsSettingsForm,
  type AdminGoogleAdsSettingsView,
} from "../../admin-google-ads-settings-form";

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

  return {
    enabled: settings.enabled,
    automationEnabled: settings.automationEnabled,
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    customerId: settings.customerId,
    developerToken: settings.developerToken,
    dsaCampaignId: settings.dsaCampaignId,
    feedUrl,
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
  const [adsSettings, googleAdsSettings] = await Promise.all([
    getStoredAdsSettings(),
    getStoredGoogleAdsSettings(),
  ]);

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
          Growth
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Ads
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
          Set campaign budget rules, channel-level margin, and the forecast assumptions that power user ads planning.
        </p>
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-5 shadow-sm">
        <AdminAdsSettingsForm settings={toAdsSettingsView(adsSettings)} />
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
        <AdminGoogleAdsSettingsForm
          settings={toGoogleAdsSettingsView(googleAdsSettings)}
        />
      </section>
    </main>
  );
}
