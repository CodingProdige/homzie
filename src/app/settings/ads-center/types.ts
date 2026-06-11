import type { AdsSettings } from "@/modules/ads/shared";

export type TargetAreaScope = "custom" | "global";

export type TargetAreaSelection = {
  activeUsersEstimate: number;
  label: string;
  placeId: string;
  populationEstimate: number;
  publishedListingsEstimate: number;
};

export type AssetOption = {
  coverImageUrl?: string | null;
  id: string;
  label: string;
  location?: string | null;
  priceLabel?: string | null;
  status?: string | null;
  title?: string;
};

export type CampaignSummary = {
  channel: string;
  createdAtLabel: string;
  deliveredSpendCents?: number;
  durationDays: number;
  estimatedClicks: number;
  estimatedReach: number;
  estimatedResults: number;
  googleSyncStatus: string;
  id: string;
  billedSpendCents?: number;
  outstandingSpendCents?: number;
  promotedLabel: string;
  status: string;
  targetActiveUsersEstimate: number;
  targetAreaCount?: number;
  targetAreas?: TargetAreaSelection[];
  targetSummaryLabel?: string;
  targetLocation: string | null;
  targetLocationPlaceId: string | null;
  targetPopulationEstimate: number;
  targetPublishedListingsEstimate: number;
  targetScope?: TargetAreaScope;
  totalBudgetCents: number;
};

export type BillingStatus = {
  hasActiveSubscription: boolean;
  hasPaymentMethod: boolean;
  paymentMethodLabel: string | null;
};

export type GoogleChannelStatus = {
  available: boolean;
  blockedReason: string | null;
};

export type AdsCenterSettingsView = AdsSettings & {
  allowGoogleAds: boolean;
};
