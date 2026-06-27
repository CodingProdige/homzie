"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  Check,
  ChevronDown,
  CreditCard,
  Globe2,
  Loader2,
  MapPin,
  Megaphone,
  Sparkles,
  X,
} from "lucide-react";

import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  averageDailyBudget,
  buildAdForecast,
  formatCompactNumber,
  formatCurrencyFromCents,
} from "@/modules/ads/forecast";
import {
  getPrimaryOutcomeLabel,
  type AdChannel,
  type AdPromotedType,
  type AdsSettings,
} from "@/modules/ads/shared";
import { ListingPreviewCard } from "@/modules/listings/components/listing-preview-card";
import { SettingsPageHeader } from "../settings-page-header";
import { createAdCampaign } from "./actions";
import { emptyCreateAdCampaignState } from "./action-state";
import type {
  AssetOption,
  BillingStatus,
  GoogleChannelStatus,
  TargetAreaScope,
  TargetAreaSelection,
} from "./types";

type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: {
      input: string;
      sessionToken?: unknown;
    },
    callback: (
      predictions: GoogleAutocompletePrediction[] | null,
      status: string,
    ) => void,
  ) => void;
};

type GoogleWindow = Window & {
  __homzieGoogleMapsPromise?: Promise<void>;
  google?: {
    maps?: {
      places?: {
        AutocompleteService: new () => GoogleAutocompleteService;
        AutocompleteSessionToken: new () => unknown;
        PlacesServiceStatus: {
          OK: string;
        };
      };
    };
  };
};

type TargetAreaStats = TargetAreaSelection;

const googleMapsScriptId = "homzie-google-maps-places";
const GLOBAL_TARGET_PLACE_ID = "__global__";
const GLOBAL_TARGET_LABEL = "All countries and regions";

function loadGooglePlaces() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in browser."));
  }

  const googleWindow = window as GoogleWindow;

  if (googleWindow.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleWindow.__homzieGoogleMapsPromise) {
    return googleWindow.__homzieGoogleMapsPromise;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is not configured."));
  }

  googleWindow.__homzieGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      googleMapsScriptId,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Places failed to load.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = googleMapsScriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Places failed to load."));
    document.head.appendChild(script);
  });

  return googleWindow.__homzieGoogleMapsPromise;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function splitBudget(totalBudgetCents: number, channelsCount: number, index: number) {
  const base = Math.floor(totalBudgetCents / channelsCount);
  const remainder = totalBudgetCents % channelsCount;

  return base + (index < remainder ? 1 : 0);
}

async function fetchTargetAreaStats(locations: Array<{ label: string; placeId: string }>) {
  const response = await fetch("/api/ads/target-area", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ locations }),
  });

  if (!response.ok) {
    throw new Error("Could not load target area stats.");
  }

  const payload = (await response.json()) as { stats?: TargetAreaStats[] };

  return payload.stats || [];
}

function formatAreaMetric(value: number, unavailableLabel = "Unavailable") {
  if (!value) return unavailableLabel;

  return formatCompactNumber(value);
}

function dedupeTargetAreas(areas: TargetAreaSelection[]) {
  const seen = new Set<string>();

  return areas.filter((area) => {
    if (!area.placeId || seen.has(area.placeId)) return false;
    seen.add(area.placeId);
    return true;
  });
}

function summarizeTargetAreas(areas: TargetAreaSelection[], scope: TargetAreaScope) {
  if (!areas.length) return "Choose target areas";
  if (scope === "global" || areas.some((area) => area.placeId === GLOBAL_TARGET_PLACE_ID)) {
    return GLOBAL_TARGET_LABEL;
  }
  if (areas.length === 1) return areas[0]?.label || "Choose target areas";
  return `${areas[0]?.label || "Selected area"} +${areas.length - 1}`;
}

function sumTargetAreaMetric(
  areas: TargetAreaSelection[],
  key: keyof Pick<
    TargetAreaSelection,
    "activeUsersEstimate" | "populationEstimate" | "publishedListingsEstimate"
  >,
) {
  return areas.reduce((sum, area) => sum + (area[key] || 0), 0);
}

function ModalShell({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-background p-5 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
        <h3 className="pr-12 text-2xl font-bold tracking-normal">{title}</h3>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function DropdownSelect({
  label,
  options,
  value,
  onValueChange,
  placeholder,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder: string;
  value: string;
}) {
  const activeOption = options.find((option) => option.value === value);

  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex min-h-10 w-full min-w-0 items-start justify-between gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm font-semibold text-foreground outline-none transition hover:bg-muted/45 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">
              {activeOption?.label || placeholder}
            </span>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[120] max-h-72 w-[min(36rem,calc(100vw-2rem))] min-w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          >
            {options.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                disabled={option.disabled}
                className="flex cursor-pointer items-start gap-2 rounded-sm px-2.5 py-2 text-sm font-semibold outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                onSelect={() => {
                  if (option.disabled) return;
                  onValueChange(option.value);
                }}
              >
                <Check
                  className={
                    option.value === value
                      ? "size-4 text-primary"
                      : "size-4 text-transparent"
                  }
                />
                <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">
                  {option.label}
                </span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </label>
  );
}

function ListingSelect({
  assets,
  label,
  onValueChange,
  placeholder,
  value,
}: {
  assets: AssetOption[];
  label: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const activeAsset = assets.find((asset) => asset.id === value);

  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="w-full rounded-md border border-input bg-background p-2 text-left outline-none transition hover:bg-muted/45 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {activeAsset ? (
              <ListingPreviewCard listing={activeAsset} compact />
            ) : (
              <div className="flex min-h-10 items-center justify-between gap-3 px-2 py-1 text-sm font-normal text-muted-foreground">
                <span>{placeholder}</span>
                <ChevronDown className="size-4 shrink-0" />
              </div>
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[120] max-h-[28rem] w-[min(42rem,calc(100vw-2rem))] min-w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-xl"
          >
            {assets.map((asset) => (
              <DropdownMenu.Item
                key={asset.id}
                className="cursor-pointer rounded-md p-1 outline-none transition hover:bg-accent focus:bg-accent"
                onSelect={() => onValueChange(asset.id)}
              >
                <div className="flex items-start gap-2">
                  <Check
                    className={cn(
                      "mt-5 size-4 shrink-0",
                      asset.id === value ? "text-primary" : "text-transparent",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <ListingPreviewCard listing={asset} />
                  </div>
                </div>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </label>
  );
}

function EstimateLine({
  description,
  label,
  value,
}: {
  description?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="flex items-center gap-1 font-normal text-muted-foreground">
        {label}
        {description ? (
          <AnalyticsInfoPopover title={label} description={description} />
        ) : null}
      </span>
      <span className="text-right text-base font-semibold text-foreground">{value}</span>
    </div>
  );
}

function BillingGate({
  billingStatus,
}: {
  billingStatus: BillingStatus;
}) {
  if (billingStatus.hasActiveSubscription && billingStatus.hasPaymentMethod) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-foreground">Billing is ready</p>
            <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
              Campaigns can publish straight away. Ad spend will bill to{" "}
              <span className="font-semibold text-foreground">
                {billingStatus.paymentMethodLabel || "your saved card"}
              </span>{" "}
              on Homzie&apos;s monthly billing cycle.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!billingStatus.hasActiveSubscription) {
    return (
      <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="font-semibold text-foreground">Subscribe before publishing ads</p>
        <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
          Ads are only available to active subscribers. Start or reactivate your
          subscription first, then come back here to publish.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/settings/billing">Open billing</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="font-semibold text-foreground">Add a payment method before publishing</p>
      <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
        Homzie needs a saved card before we can launch ads. Add a payment method in
        billing, then publish from here.
      </p>
      <div className="mt-4">
        <Button asChild variant="outline">
          <Link href="/settings/billing">Add payment method</Link>
        </Button>
      </div>
    </div>
  );
}

export function AdsCenterClient({
  billingStatus,
  googleChannelStatus,
  listingOptions,
  reelOptions,
  settings,
  userLocation,
  userLocationPlaceId,
}: {
  billingStatus: BillingStatus;
  googleChannelStatus: GoogleChannelStatus;
  listingOptions: AssetOption[];
  reelOptions: AssetOption[];
  settings: AdsSettings;
  userLocation: string;
  userLocationPlaceId: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createAdCampaign,
    emptyCreateAdCampaignState,
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSession, setPublishSession] = useState(0);
  const [lastSuccessSession, setLastSuccessSession] = useState(-1);

  const hasGoogleListingInventory =
    settings.allowGoogleAds &&
    googleChannelStatus.available &&
    listingOptions.length > 0;
  const initialPromotedType: AdPromotedType =
    settings.allowHomzieAds || !hasGoogleListingInventory ? "profile" : "listing";

  const [selectedChannels, setSelectedChannels] = useState<AdChannel[]>(
    settings.allowHomzieAds ? ["homzie"] : hasGoogleListingInventory ? ["google"] : ["homzie"],
  );
  const [promotedType, setPromotedType] = useState<AdPromotedType>(initialPromotedType);
  const [listingId, setListingId] = useState(listingOptions[0]?.id || "");
  const [reelId, setReelId] = useState(reelOptions[0]?.id || "");
  const [targetAreaQuery, setTargetAreaQuery] = useState("");
  const [selectedTargetAreas, setSelectedTargetAreas] = useState<TargetAreaSelection[]>(
    userLocation && userLocationPlaceId
      ? [
          {
            activeUsersEstimate: 0,
            label: userLocation,
            placeId: userLocationPlaceId,
            populationEstimate: 0,
            publishedListingsEstimate: 0,
          },
        ]
      : [],
  );
  const [targetAreaScope, setTargetAreaScope] = useState<TargetAreaScope>("custom");
  const [predictions, setPredictions] = useState<GoogleAutocompletePrediction[]>([]);
  const [isAreaSearching, setIsAreaSearching] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [hasAreaInteracted, setHasAreaInteracted] = useState(false);
  const [locationStatsByPlaceId, setLocationStatsByPlaceId] = useState<
    Record<string, TargetAreaStats>
  >({});
  const sessionTokenRef = useRef<unknown | null>(null);
  const [durationDays, setDurationDays] = useState(14);
  const minBudgetRands = Math.round(settings.minCampaignBudgetCents / 100);
  const maxBudgetRands = Math.round(settings.maxCampaignBudgetCents / 100);
  const [budgetRands, setBudgetRands] = useState(minBudgetRands);
  const resolvedSelectedTargetAreas = useMemo(
    () =>
      selectedTargetAreas.map((area) => locationStatsByPlaceId[area.placeId] || area),
    [locationStatsByPlaceId, selectedTargetAreas],
  );
  const targetSummaryLabel = summarizeTargetAreas(
    resolvedSelectedTargetAreas,
    targetAreaScope,
  );
  const targetPopulationEstimate = sumTargetAreaMetric(
    resolvedSelectedTargetAreas,
    "populationEstimate",
  );
  const targetActiveUsersEstimate = sumTargetAreaMetric(
    resolvedSelectedTargetAreas,
    "activeUsersEstimate",
  );
  const targetPublishedListingsEstimate = sumTargetAreaMetric(
    resolvedSelectedTargetAreas,
    "publishedListingsEstimate",
  );
  const visiblePredictions =
    hasAreaInteracted && targetAreaQuery.trim() ? predictions : [];
  const showAreaSearching =
    hasAreaInteracted && targetAreaQuery.trim() ? isAreaSearching : false;
  const effectiveSelectedChannels = useMemo(
    () =>
      selectedChannels.filter(
        (channel) =>
          channel !== "google" ||
          (promotedType === "listing" && hasGoogleListingInventory),
      ),
    [hasGoogleListingInventory, promotedType, selectedChannels],
  );

  useEffect(() => {
    if (state.ok) {
      const successTimer = window.setTimeout(() => {
        setLastSuccessSession(publishSession);
      }, 0);
      const redirectTimer = window.setTimeout(() => {
        router.push("/settings/ads-center/campaigns");
      }, 1800);
      return () => {
        window.clearTimeout(successTimer);
        window.clearTimeout(redirectTimer);
      };
    }
  }, [publishSession, router, state.ok]);

  useEffect(() => {
    const unresolvedAreas = selectedTargetAreas.filter(
      (area) => !locationStatsByPlaceId[area.placeId],
    );

    if (!unresolvedAreas.length) return;

    void fetchTargetAreaStats(
      unresolvedAreas.map((area) => ({
        label: area.label,
        placeId: area.placeId,
      })),
    )
      .then((stats) => {
        if (!stats.length) return;

        setLocationStatsByPlaceId((current) => ({
          ...current,
          ...Object.fromEntries(stats.map((entry) => [entry.placeId, entry])),
        }));
      })
      .catch(() => {
        setPlacesError("Could not load target area stats right now.");
      });
  }, [locationStatsByPlaceId, selectedTargetAreas]);

  useEffect(() => {
    if (targetAreaScope === "global") {
      const timeout = window.setTimeout(() => {
        setPredictions([]);
        setIsAreaSearching(false);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    if (!hasAreaInteracted || !targetAreaQuery.trim()) {
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      void loadGooglePlaces()
        .then(async () => {
          if (!isCurrent) return;

          const googleWindow = window as GoogleWindow;
          const places = googleWindow.google?.maps?.places;

          if (!places) {
            setPlacesError("Google Places is unavailable right now.");
            setIsAreaSearching(false);
            return;
          }

          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new places.AutocompleteSessionToken();
          }

          setIsAreaSearching(true);
          setPlacesError(null);

          const service = new places.AutocompleteService();

          service.getPlacePredictions(
            {
              input: targetAreaQuery,
              sessionToken: sessionTokenRef.current,
            },
            async (nextPredictions, status) => {
              if (!isCurrent) return;

              setIsAreaSearching(false);

              if (status !== places.PlacesServiceStatus.OK || !nextPredictions?.length) {
                setPredictions([]);
                return;
              }

              const limitedPredictions = nextPredictions.slice(0, 5);
              setPredictions(limitedPredictions);

              try {
                const stats = await fetchTargetAreaStats(
                  limitedPredictions.map((prediction) => ({
                    label: prediction.description,
                    placeId: prediction.place_id,
                  })),
                );

                if (!isCurrent) return;

                setLocationStatsByPlaceId((current) => ({
                  ...current,
                  ...Object.fromEntries(stats.map((entry) => [entry.placeId, entry])),
                }));
              } catch {
                if (isCurrent) {
                  setPlacesError("Could not load target area stats right now.");
                }
              }
            },
          );
        })
        .catch((error) => {
          if (!isCurrent) return;
          setIsAreaSearching(false);
          setPlacesError(
            error instanceof Error
              ? error.message
              : "Google Places is unavailable right now.",
          );
        });
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [hasAreaInteracted, targetAreaQuery, targetAreaScope]);

  const selectedListing = listingOptions.find((listing) => listing.id === listingId) || null;
  const selectedReel = reelOptions.find((reel) => reel.id === reelId) || null;
  const selectedAssetLabel =
    promotedType === "listing"
      ? selectedListing?.label || "Choose a listing"
      : promotedType === "reel"
        ? selectedReel?.label || "Choose a reel"
        : "Your public Homzie profile";

  const publishBlockedReason = !billingStatus.hasActiveSubscription
    ? "You need an active subscription before publishing ads."
    : !billingStatus.hasPaymentMethod
      ? "Add a payment method in billing before publishing ads."
      : promotedType === "listing" && !listingId
        ? "Choose a listing before publishing."
        : promotedType === "reel" && !reelId
    ? "Choose a reel before publishing."
    : effectiveSelectedChannels.length === 0
      ? "Choose at least one channel."
      : !resolvedSelectedTargetAreas.length
        ? "Choose at least one target area."
        : null;

  const availablePromotedTypes = [
    { value: "profile" as const, label: "Profile", disabled: !settings.allowHomzieAds },
    { value: "listing" as const, label: "Listing", disabled: !listingOptions.length },
    { value: "reel" as const, label: "Reel", disabled: !reelOptions.length || !settings.allowHomzieAds },
  ];

  const combinedForecast = useMemo(() => {
    const channels = effectiveSelectedChannels.length
      ? effectiveSelectedChannels
      : settings.allowHomzieAds
        ? (["homzie"] as AdChannel[])
        : hasGoogleListingInventory
          ? (["google"] as AdChannel[])
          : [];

    const perChannel = channels.map((channel, index) =>
      buildAdForecast({
        channel,
        durationDays,
        objective: "traffic",
        promotedType,
        settings,
        targetActiveUsersEstimate,
        targetPopulationEstimate,
        totalBudgetCents: splitBudget(budgetRands * 100, channels.length, index),
      }),
    );

    return {
      channels,
      estimatedClicks: perChannel.reduce((sum, item) => sum + item.estimatedClicks, 0),
      estimatedImpressions: perChannel.reduce(
        (sum, item) => sum + item.estimatedImpressions,
        0,
      ),
      estimatedReach: perChannel.reduce((sum, item) => sum + item.estimatedReach, 0),
      estimatedResults: perChannel.reduce((sum, item) => sum + item.estimatedResults, 0),
      netMediaBudgetCents: perChannel.reduce(
        (sum, item) => sum + item.netMediaBudgetCents,
        0,
      ),
    };
  }, [
    budgetRands,
    durationDays,
    hasGoogleListingInventory,
    promotedType,
    effectiveSelectedChannels,
    settings,
    targetActiveUsersEstimate,
    targetPopulationEstimate,
  ]);

  const outcomeLabel = getPrimaryOutcomeLabel(promotedType, "traffic");
  const canPublish = !publishBlockedReason && combinedForecast.channels.length > 0;
  const targetAreasJson = JSON.stringify(resolvedSelectedTargetAreas);
  const isGlobalTarget =
    targetAreaScope === "global" ||
    resolvedSelectedTargetAreas.some((area) => area.placeId === GLOBAL_TARGET_PLACE_ID);

  function selectTargetArea(option: GoogleAutocompletePrediction) {
    setTargetAreaScope("custom");
    setSelectedTargetAreas((current) =>
      dedupeTargetAreas([
        ...current.filter((area) => area.placeId !== GLOBAL_TARGET_PLACE_ID),
        {
          activeUsersEstimate: 0,
          label: option.description,
          placeId: option.place_id,
          populationEstimate: 0,
          publishedListingsEstimate: 0,
        },
      ]),
    );
    setTargetAreaQuery("");
    setPredictions([]);
    setHasAreaInteracted(false);
  }

  function removeTargetArea(placeId: string) {
    setTargetAreaScope("custom");
    setSelectedTargetAreas((current) =>
      current.filter((area) => area.placeId !== placeId),
    );
  }

  function selectGlobalTarget() {
    setTargetAreaScope("global");
    setSelectedTargetAreas([
      {
        activeUsersEstimate: 0,
        label: GLOBAL_TARGET_LABEL,
        placeId: GLOBAL_TARGET_PLACE_ID,
        populationEstimate: 0,
        publishedListingsEstimate: 0,
      },
    ]);
    setTargetAreaQuery("");
    setPredictions([]);
    setHasAreaInteracted(false);
    setPlacesError(null);
  }

  function toggleChannel(channel: AdChannel) {
    if (channel === "google" && (!hasGoogleListingInventory || promotedType !== "listing")) {
      return;
    }

    if (effectiveSelectedChannels.includes(channel)) {
      if (effectiveSelectedChannels.length === 1) {
        return;
      }

      setSelectedChannels((current) => current.filter((item) => item !== channel));
      return;
    }

    setSelectedChannels((current) => [...current, channel]);
  }

  return (
    <div className="pb-10">
      <form id="ads-publish-form" action={formAction}>
        <SettingsPageHeader
          title="Ads Center"
          backHref="/settings"
          message={state.message}
          messageTone={state.ok ? "success" : state.message ? "error" : "neutral"}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild type="button" variant="outline" className="h-11 px-5 text-sm">
                <Link href="/settings/ads-center/campaigns">View campaigns</Link>
              </Button>
              <Button
                type="button"
                disabled={!canPublish || isPending}
                className="h-11 px-5 text-sm"
                onClick={() => {
                  if (!canPublish) return;
                  setPublishSession((current) => current + 1);
                  setPublishOpen(true);
                }}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Publish campaign
              </Button>
            </div>
          }
        />

        {effectiveSelectedChannels.map((channel) => (
          <input key={`channel-${channel}`} type="hidden" name="channels" value={channel} />
        ))}
        <input type="hidden" name="promotedType" value={promotedType} />
        <input type="hidden" name="listingId" value={promotedType === "listing" ? listingId : ""} />
        <input type="hidden" name="reelId" value={promotedType === "reel" ? reelId : ""} />
        <input type="hidden" name="targetAreasJson" value={targetAreasJson} />
        <input type="hidden" name="targetScope" value={targetAreaScope} />
        <input type="hidden" name="targetSummaryLabel" value={targetSummaryLabel} />
        <input
          type="hidden"
          name="targetPopulationEstimate"
          value={targetPopulationEstimate}
        />
        <input
          type="hidden"
          name="targetActiveUsersEstimate"
          value={targetActiveUsersEstimate}
        />
        <input
          type="hidden"
          name="targetPublishedListingsEstimate"
          value={targetPublishedListingsEstimate}
        />
        <input type="hidden" name="durationDays" value={durationDays} />
        <input type="hidden" name="totalBudgetRands" value={budgetRands} />

        <div className="grid gap-5 py-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.85fr)]">
          <section className="space-y-5">
            <BillingGate billingStatus={billingStatus} />

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <div>
                <h2 className="text-lg font-bold">Campaign setup</h2>
                <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
                  Pick what you want to promote, where it should run, and the total
                  budget Homzie should pace across your selected channels.
                </p>
              </div>

              <div className="mt-5 space-y-5">
                <div className="grid gap-2">
                  <Label>Channels</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.allowHomzieAds ? (
                      <button
                        type="button"
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition",
                          effectiveSelectedChannels.includes("homzie")
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-muted/45",
                        )}
                        onClick={() => toggleChannel("homzie")}
                      >
                        <Megaphone className="size-4" />
                        Homzie
                      </button>
                    ) : null}
                    {settings.allowGoogleAds ? (
                      <button
                        type="button"
                        disabled={!hasGoogleListingInventory || promotedType !== "listing"}
                        className={cn(
                          "inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                          effectiveSelectedChannels.includes("google")
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-muted/45",
                        )}
                        onClick={() => toggleChannel("google")}
                      >
                        <Globe2 className="size-4" />
                        Google
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs font-normal leading-5 text-muted-foreground">
                    {settings.allowGoogleAds && !googleChannelStatus.available
                      ? googleChannelStatus.blockedReason ||
                        "Google delivery is temporarily unavailable right now."
                      : "Use one or both channels. Google delivery is currently limited to published listing pages inside Homzie's shared DSA setup."}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Promote</Label>
                  <div className="flex flex-wrap gap-2">
                    {availablePromotedTypes.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        className={cn(
                          "inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                          promotedType === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-muted/45",
                        )}
                        onClick={() => {
                          setPromotedType(option.value);
                          if (option.value !== "listing") {
                            setSelectedChannels((current) =>
                              current.filter((channel) => channel !== "google"),
                            );
                          }
                          if (option.value === "listing" && listingOptions[0] && !listingId) {
                            setListingId(listingOptions[0].id);
                          }
                          if (option.value === "reel" && reelOptions[0] && !reelId) {
                            setReelId(reelOptions[0].id);
                          }
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {promotedType === "listing" ? (
                  <ListingSelect
                    label="Listing"
                    assets={listingOptions}
                    value={listingId}
                    placeholder="Choose a listing"
                    onValueChange={setListingId}
                  />
                ) : null}

                {promotedType === "reel" ? (
                  <DropdownSelect
                    label="Reel"
                    value={reelId}
                    placeholder="Choose a reel"
                    onValueChange={setReelId}
                    options={reelOptions.map((reel) => ({
                      value: reel.id,
                      label: reel.label,
                    }))}
                  />
                ) : null}

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="targetAreaQuery">Target area</Label>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition",
                        isGlobalTarget
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-foreground hover:bg-muted/45",
                      )}
                      onClick={selectGlobalTarget}
                    >
                      <Globe2 className="size-3.5" />
                      All countries and regions
                    </button>
                  </div>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="targetAreaQuery"
                      value={targetAreaQuery}
                      placeholder="Start typing a city, suburb, or country"
                      className="pl-10"
                      disabled={isGlobalTarget}
                      onChange={(event) => {
                        setHasAreaInteracted(true);
                        setTargetAreaScope("custom");
                        setTargetAreaQuery(event.currentTarget.value);
                      }}
                    />
                  </div>
                  <p className="text-xs font-normal leading-5 text-muted-foreground">
                    Search and add one or more cities, suburbs, or countries. Homzie
                    combines the selected areas into one delivery forecast.
                  </p>
                  {resolvedSelectedTargetAreas.length ? (
                    <div className="flex flex-wrap gap-2">
                      {resolvedSelectedTargetAreas.map((area) => (
                        <span
                          key={area.placeId}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
                        >
                          {area.label}
                          <button
                            type="button"
                            className="rounded-full text-muted-foreground transition hover:text-foreground"
                            aria-label={`Remove ${area.label}`}
                            onClick={() => removeTargetArea(area.placeId)}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {placesError ? (
                    <p className="rounded-md bg-muted px-3 py-2 text-xs font-normal text-muted-foreground">
                      {placesError}
                    </p>
                  ) : null}
                  {visiblePredictions.length || showAreaSearching ? (
                    <div className="rounded-lg border border-border bg-muted/40 p-2">
                      {visiblePredictions.map((option) => {
                        const stats = locationStatsByPlaceId[option.place_id];

                        return (
                          <button
                            key={option.place_id}
                            type="button"
                            className="flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-white"
                            onClick={() => selectTargetArea(option)}
                          >
                            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold">
                                {option.structured_formatting?.main_text || option.description}
                              </span>
                              <span className="block text-xs font-normal text-muted-foreground">
                                {option.structured_formatting?.secondary_text || "Google Places"}
                              </span>
                              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                                {formatAreaMetric(stats?.populationEstimate || 0)} population ·{" "}
                                {formatAreaMetric(stats?.activeUsersEstimate || 0, "0")} active
                                users · {formatAreaMetric(stats?.publishedListingsEstimate || 0, "0")}{" "}
                                live listings
                              </span>
                            </span>
                            {resolvedSelectedTargetAreas.some(
                              (area) => area.placeId === option.place_id,
                            ) ? (
                              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                            ) : null}
                          </button>
                        );
                      })}
                      {showAreaSearching ? (
                        <p className="px-3 py-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                          Searching places
                        </p>
                      ) : null}
                      <p className="px-3 pb-1 pt-2 text-right text-[9px] font-normal uppercase tracking-[0.35em] text-muted-foreground">
                        Powered by Google
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-border bg-background px-4 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-normal uppercase tracking-[0.12em] text-muted-foreground">
                        Selected area totals
                      </p>
                      <p className="text-xs font-normal text-muted-foreground">
                        {resolvedSelectedTargetAreas.length
                          ? isGlobalTarget
                            ? "Global audience"
                            : `${resolvedSelectedTargetAreas.length} area${resolvedSelectedTargetAreas.length === 1 ? "" : "s"}`
                          : "No areas selected"}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div>
                        <p className="flex items-center gap-1 text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                          Population
                          <AnalyticsInfoPopover
                            title="Population"
                            description="A population estimate for the selected area. This helps Homzie size the total available audience, even if not everyone there is active in the product."
                          />
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatAreaMetric(targetPopulationEstimate)}
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1 text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                          Active users
                          <AnalyticsInfoPopover
                            title="Active users"
                            description="People in the selected area who are currently active inside Homzie. This is the strongest direct signal for likely in-app delivery."
                          />
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatAreaMetric(targetActiveUsersEstimate, "0")}
                        </p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1 text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                          Live listings
                          <AnalyticsInfoPopover
                            title="Live listings"
                            description="Published listings currently available in the selected area. This helps Homzie estimate how competitive the local inventory is."
                          />
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatAreaMetric(targetPublishedListingsEstimate, "0")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Budget and duration</h2>
                  <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
                    Set the total budget and runtime. Homzie will pace that spend
                    across the channels you selected.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background px-4 py-3 text-right">
                  <p className="text-[11px] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                    Max daily spend
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {formatCurrencyFromCents(
                      averageDailyBudget(budgetRands * 100, durationDays),
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-6">
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="totalBudgetRands">Total budget</Label>
                    <span className="text-sm font-semibold text-primary">
                      {formatCurrencyFromCents(budgetRands * 100)}
                    </span>
                  </div>
                  <input
                    id="budgetRange"
                    type="range"
                    min={minBudgetRands}
                    max={maxBudgetRands}
                    step="50"
                    value={budgetRands}
                    onChange={(event) =>
                      setBudgetRands(
                        clamp(Number(event.currentTarget.value), minBudgetRands, maxBudgetRands),
                      )
                    }
                    className="reel-progress-slider"
                  />
                  <Input
                    id="totalBudgetRands"
                    type="number"
                    min={minBudgetRands}
                    max={maxBudgetRands}
                    step="50"
                    value={budgetRands}
                    onChange={(event) =>
                      setBudgetRands(
                        clamp(Number(event.currentTarget.value), minBudgetRands, maxBudgetRands),
                      )
                    }
                  />
                  <p className="text-xs font-normal text-muted-foreground">
                    Budgets from {formatCurrencyFromCents(settings.minCampaignBudgetCents)} to{" "}
                    {formatCurrencyFromCents(settings.maxCampaignBudgetCents)}.
                  </p>
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="durationDaysInput">Duration</Label>
                    <span className="text-sm font-semibold text-primary">{durationDays} days</span>
                  </div>
                  <input
                    id="durationRange"
                    type="range"
                    min="3"
                    max="60"
                    step="1"
                    value={durationDays}
                    onChange={(event) =>
                      setDurationDays(clamp(Number(event.currentTarget.value), 3, 60))
                    }
                    className="reel-progress-slider"
                  />
                  <Input
                    id="durationDaysInput"
                    type="number"
                    min="3"
                    max="60"
                    step="1"
                    value={durationDays}
                    onChange={(event) =>
                      setDurationDays(clamp(Number(event.currentTarget.value), 3, 60))
                    }
                  />
                </div>
              </div>
            </section>
          </section>

          <section className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <BarChart3 className="size-4" />
                </span>
                <div>
                  <h2 className="text-lg font-bold">Projected delivery</h2>
                  <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
                    A condensed cross-channel estimate based on your current budget,
                    duration, and available inventory.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-background px-4 py-3">
                <EstimateLine
                  label="Running on"
                  description="The channels Homzie will use for this campaign. Google only becomes available once the shared DSA automation is approved and healthy."
                  value={
                    combinedForecast.channels.length
                      ? combinedForecast.channels
                          .map((channel) => (channel === "google" ? "Google" : "Homzie"))
                          .join(" + ")
                      : "No channels selected"
                  }
                />
                <EstimateLine
                  label="Target area"
                  description="The area Homzie will use to size forecasted delivery and audience potential for the selected campaign."
                  value={resolvedSelectedTargetAreas.length ? targetSummaryLabel : "Choose areas"}
                />
                <EstimateLine
                  label="Estimated reach"
                  description="Estimated unique people Homzie expects to reach across the selected channels during the campaign."
                  value={formatCompactNumber(combinedForecast.estimatedReach)}
                />
                <EstimateLine
                  label="Estimated clicks"
                  description="Estimated clicks across the selected channels based on the current budget, duration, and forecast model."
                  value={formatCompactNumber(combinedForecast.estimatedClicks)}
                />
                <EstimateLine
                  label={outcomeLabel}
                  description={`The projected primary outcome for this campaign based on the selected asset type. This is a modeled estimate, not a guaranteed result.`}
                  value={formatCompactNumber(combinedForecast.estimatedResults)}
                />
                <EstimateLine
                  label="Estimated impressions"
                  description="Estimated total times the campaign could be shown across the selected channels during the run."
                  value={formatCompactNumber(combinedForecast.estimatedImpressions)}
                />
                <EstimateLine
                  label="Media spend after fees"
                  description="The portion of the approved campaign budget projected to be used as media spend after Homzie’s platform margin is applied."
                  value={formatCurrencyFromCents(combinedForecast.netMediaBudgetCents)}
                />
              </div>

              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-foreground">Billing cadence</p>
                <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                  Homzie bills delivered ad spend to your saved payment method on the
                  monthly billing cycle. Pausing an ad stops future delivery, but spend
                  already used stays billable and is not refunded.
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">Selected asset</p>
                <div className="mt-3">
                  {promotedType === "listing" && selectedListing ? (
                    <ListingPreviewCard listing={selectedListing} compact />
                  ) : (
                    <p className="text-sm font-normal leading-6 text-muted-foreground break-words">
                      {selectedAssetLabel}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </section>
        </div>

        {publishOpen ? (
          <ModalShell title="Publish campaign" onClose={() => setPublishOpen(false)}>
            {lastSuccessSession === publishSession ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">Campaign published</p>
                  <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                    Your campaign is now ready for delivery. Taking you to your
                    campaigns overview now&hellip;
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => router.push("/settings/ads-center/campaigns")}
                  >
                    View campaigns
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">Campaign summary</p>
                  <div className="mt-3 space-y-2 text-sm font-normal text-muted-foreground">
                    <div className="flex justify-between gap-4">
                      <span>Promoting</span>
                      <span className="text-right text-foreground">{selectedAssetLabel}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Channels</span>
                      <span className="text-right text-foreground">
                        {combinedForecast.channels
                          .map((channel) => (channel === "google" ? "Google" : "Homzie"))
                          .join(" + ")}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Target area</span>
                      <span className="text-right text-foreground">
                        {resolvedSelectedTargetAreas.length ? targetSummaryLabel : "Required"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Total budget</span>
                      <span className="text-right text-foreground">
                        {formatCurrencyFromCents(budgetRands * 100)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Duration</span>
                      <span className="text-right text-foreground">{durationDays} days</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Saved payment method</span>
                      <span className="text-right text-foreground">
                        {billingStatus.paymentMethodLabel || "Required in billing"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    You are publishing this campaign for immediate delivery.
                  </p>
                  <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                    Homzie will pace the budget across the selected channels and bill
                    delivery to your saved card on the monthly billing cycle. Pausing
                    later stops future delivery, not spend already used.
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setPublishOpen(false)}>
                    Keep editing
                  </Button>
                  <Button type="submit" disabled={!canPublish || isPending}>
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                    {isPending ? "Publishing..." : "Publish campaign"}
                  </Button>
                </div>
              </div>
            )}
          </ModalShell>
        ) : null}
      </form>
    </div>
  );
}
