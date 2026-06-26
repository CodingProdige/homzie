"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadDiscoverListingCount } from "@/modules/listings/actions";
import {
  featureOptions,
  listingTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";
import type {
  DiscoverListingFilters,
  ListingFilterOptions,
} from "@/modules/listings/server/discover-listings";

type PropertySearchBarProps = {
  action?: string;
  className?: string;
  countryName?: string;
  filters: DiscoverListingFilters & { areas?: string[]; features?: string[] };
  options: ListingFilterOptions;
  resultCount?: number;
  submitLabel?: string;
  variant?: "default" | "hero";
};

type SelectOption = {
  label: string;
  value: string;
};

type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

type GooglePlaces = {
  AutocompleteService: new () => {
    getPlacePredictions: (
      request: {
        input: string;
        sessionToken?: unknown;
        types?: string[];
      },
      callback: (
        results: GoogleAutocompletePrediction[] | null,
        status: string,
      ) => void,
    ) => void;
  };
  AutocompleteSessionToken: new () => unknown;
  PlacesServiceStatus: {
    OK: string;
  };
};

type GoogleWindow = Window & {
  __homzieGoogleMapsPromise?: Promise<void>;
  google?: {
    maps?: {
      places?: GooglePlaces;
    };
  };
};

const googleMapsScriptId = "homzie-google-maps-places";
const propertySearchSessionKey = "homzie.propertySearch.filters.v2";

const bedroomOptions = ["1", "2", "3", "4", "5"].map((value) => ({
  label: `${value}+`,
  value,
}));

function selectedAreas(filters: PropertySearchBarProps["filters"]) {
  if (Array.isArray(filters.areas) && filters.areas.length) return filters.areas;
  if (Array.isArray(filters.area)) return filters.area;
  if (typeof filters.area === "string" && filters.area) return [filters.area];

  return [];
}

function selectedFeatures(filters: PropertySearchBarProps["filters"]) {
  if (Array.isArray(filters.features)) return filters.features;
  if (typeof filters.features === "string" && filters.features) {
    return [filters.features];
  }

  return [];
}

function selectedOptionValues<T extends { value: string }>(
  options: readonly T[],
  value?: string[] | string,
) {
  const allowedValues = new Set(options.map((option) => option.value));

  return (Array.isArray(value) ? value : value ? [value] : [])
    .filter((item): item is string => typeof item === "string")
    .filter((item) => allowedValues.has(item));
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function hasExplicitPropertySearchState(filters: PropertySearchBarProps["filters"]) {
  return Boolean(
    selectedAreas(filters).length ||
      selectedOptionValues(listingTypeOptions, filters.listingType).length ||
      selectedOptionValues(propertyTypeOptions, filters.propertyType).length ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.bedrooms ||
      filters.bathrooms ||
      filters.garages ||
      filters.parking ||
      filters.minFloorSize ||
      filters.minErfSize ||
      filters.buyerIncentive ||
      selectedFeatures(filters).length,
  );
}

function readSessionSearchState() {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.sessionStorage.getItem(propertySearchSessionKey);

    if (!rawValue) return null;

    const value = JSON.parse(rawValue) as Record<string, unknown>;

    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    return {
      areas: stringList(value.areas).slice(0, 8),
      bathrooms: stringValue(value.bathrooms),
      bedrooms: stringValue(value.bedrooms),
      buyerIncentive: stringValue(value.buyerIncentive),
      features: stringList(value.features).filter((feature) =>
        (featureOptions as readonly string[]).includes(feature),
      ),
      garages: stringValue(value.garages),
      listingTypes: selectedOptionValues(listingTypeOptions, stringList(value.listingTypes)),
      maxPrice: stringValue(value.maxPrice),
      minErfSize: stringValue(value.minErfSize),
      minFloorSize: stringValue(value.minFloorSize),
      minPrice: stringValue(value.minPrice),
      parking: stringValue(value.parking),
      propertyTypes: selectedOptionValues(
        propertyTypeOptions,
        stringList(value.propertyTypes),
      ),
    };
  } catch {
    return null;
  }
}

function formatPrice(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) return value;

  return new Intl.NumberFormat("en", {
    currency: "ZAR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(number);
}

function formatListingCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "listing" : "listings"}`;
}

function optionLabel(options: SelectOption[], value?: string, fallback = "Any") {
  return options.find((option) => option.value === value)?.label || fallback;
}

function placeRegionLabel(place: GoogleAutocompletePrediction) {
  const mainText = place.structured_formatting?.main_text?.trim();

  if (mainText) return mainText;

  return place.description.split(",")[0]?.trim() || place.description;
}

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
    return Promise.reject(new Error("Google Places is not configured."));
  }

  googleWindow.__homzieGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(googleMapsScriptId);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Could not load Google Places.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = googleMapsScriptId;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Places."));
    document.head.appendChild(script);
  });

  return googleWindow.__homzieGoogleMapsPromise;
}

function SearchSelect({
  className,
  label,
  onChange,
  options,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) {
  const activeLabel = optionLabel(options, value, label);

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-12 min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-background px-4 text-left text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            className,
          )}
        >
          <span className="min-w-0 truncate">{activeLabel}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-[130] max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-48 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
        >
          {options.map((option) => (
            <DropdownMenu.Item
              key={`${label}-${option.value || "any"}`}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-semibold outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onSelect={() => onChange(option.value)}
            >
              <Check
                className={cn(
                  "size-4",
                  option.value === value ? "text-primary" : "text-transparent",
                )}
              />
              <span className="min-w-0 truncate">{option.label}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MultiSearchSelect({
  allLabel,
  className,
  label,
  onChange,
  options,
  values,
}: {
  allLabel: string;
  className?: string;
  label: string;
  onChange: (values: string[]) => void;
  options: SelectOption[];
  values: string[];
}) {
  const selected = new Set(values);
  const activeLabel =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? optionLabel(options, values[0], label)
        : `${values.length} selected`;

  function toggleValue(value: string) {
    if (!value) {
      onChange([]);
      return;
    }

    const nextValues = selected.has(value)
      ? values.filter((item) => item !== value)
      : [...values, value];

    onChange(nextValues);
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-12 min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-background px-4 text-left text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            className,
          )}
        >
          <span className="min-w-0 truncate">{activeLabel}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={8}
          className="z-[130] max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-48 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
        >
          <DropdownMenu.Item
            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-semibold outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onSelect={(event) => {
              event.preventDefault();
              toggleValue("");
            }}
          >
            <Check
              className={cn(
                "size-4",
                values.length === 0 ? "text-primary" : "text-transparent",
              )}
            />
            <span className="min-w-0 truncate">{allLabel}</span>
          </DropdownMenu.Item>
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={`${label}-${option.value}`}
              checked={selected.has(option.value)}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2.5 text-sm font-semibold outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onCheckedChange={() => toggleValue(option.value)}
              onSelect={(event) => event.preventDefault()}
            >
              <Check
                className={cn(
                  "size-4",
                  selected.has(option.value) ? "text-primary" : "text-transparent",
                )}
              />
              <span className="min-w-0 truncate">{option.label}</span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function FieldSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold">
      <span>{label}</span>
      <SearchSelect
        label="Any"
        onChange={onChange}
        options={[{ label: "Any", value: "" }, ...options]}
        value={value}
      />
    </label>
  );
}

export function PropertySearchBar({
  action = "/listings",
  className,
  countryName,
  filters,
  options,
  resultCount,
  submitLabel = "Show me",
  variant = "default",
}: PropertySearchBarProps) {
  const shouldHydrateFromSession = !hasExplicitPropertySearchState(filters);
  const [areas, setAreas] = useState(() => selectedAreas(filters));
  const [areaQuery, setAreaQuery] = useState("");
  const [listingTypes, setListingTypes] = useState(() => {
    const selected = selectedOptionValues(listingTypeOptions, filters.listingType);

    return selected;
  });
  const [propertyTypes, setPropertyTypes] = useState(() =>
    selectedOptionValues(propertyTypeOptions, filters.propertyType),
  );
  const [minPrice, setMinPrice] = useState(filters.minPrice || "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice || "");
  const [bedrooms, setBedrooms] = useState(filters.bedrooms || "");
  const [bathrooms, setBathrooms] = useState(filters.bathrooms || "");
  const [garages, setGarages] = useState(filters.garages || "");
  const [parking, setParking] = useState(filters.parking || "");
  const [minFloorSize, setMinFloorSize] = useState(filters.minFloorSize || "");
  const [minErfSize, setMinErfSize] = useState(filters.minErfSize || "");
  const [buyerIncentive, setBuyerIncentive] = useState(
    filters.buyerIncentive || "",
  );
  const [features, setFeatures] = useState(() => new Set(selectedFeatures(filters)));
  const hasLoadedSessionStateRef = useRef(!shouldHydrateFromSession);
  const didHydrateSessionStateRef = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [placePredictions, setPlacePredictions] = useState<
    GoogleAutocompletePrediction[]
  >([]);
  const [placesStatus, setPlacesStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [liveResultCount, setLiveResultCount] = useState(resultCount);
  const [isCountPending, setIsCountPending] = useState(false);

  const areaSuggestions = useMemo(() => {
    const query = areaQuery.trim().toLowerCase();
    const selected = new Set(areas.map((area) => area.toLowerCase()));

    return options.areas
      .filter((area) => !selected.has(area.toLowerCase()))
      .filter((area) => !query || area.toLowerCase().includes(query))
      .slice(0, 8);
  }, [areaQuery, areas, options.areas]);

  const priceOptions = options.prices.map((price) => ({
    label: formatPrice(price),
    value: price,
  }));
  const listingTypeSelectOptions = listingTypeOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const propertyTypeSelectOptions = propertyTypeOptions.map((option) => ({
    label: option.label,
    value: option.value,
  }));
  const listingTypeLabel =
    listingTypes.length === 0
      ? "All listing types"
      : listingTypes
          .map((value) => optionLabel(listingTypeSelectOptions, value, value))
          .join(", ");
  const propertyTypeLabel =
    propertyTypes.length === 0
      ? "All property types"
      : propertyTypes
          .map((value) => optionLabel(propertyTypeSelectOptions, value, value))
          .join(", ");
  const priceLabel =
    minPrice || maxPrice
      ? `${minPrice ? formatPrice(minPrice) : "Any"} - ${
          maxPrice ? formatPrice(maxPrice) : "Any"
        }`
      : "Any price";
  const isHero = variant === "hero";
  const modalFilterCount =
    [
      bathrooms,
      garages,
      parking,
      buyerIncentive,
      minFloorSize,
      minErfSize,
    ].filter(Boolean).length + features.size;
  const currentFilters = useMemo<DiscoverListingFilters>(
    () => ({
      area: areas,
      bathrooms,
      bedrooms,
      buyerIncentive,
      countryName,
      features: Array.from(features),
      garages,
      listingType: listingTypes,
      maxPrice,
      minErfSize,
      minFloorSize,
      minPrice,
      parking,
      propertyType: propertyTypes,
    }),
    [
      areas,
      bathrooms,
      bedrooms,
      buyerIncentive,
      countryName,
      features,
      garages,
      listingTypes,
      maxPrice,
      minErfSize,
      minFloorSize,
      minPrice,
      parking,
      propertyTypes,
    ],
  );
  const hasActiveCriteria = Boolean(
    areas.length ||
      propertyTypes.length ||
      minPrice ||
      maxPrice ||
      bedrooms ||
      bathrooms ||
      garages ||
      parking ||
      minFloorSize ||
      minErfSize ||
      buyerIncentive ||
      features.size ||
      listingTypes.length,
  );
  const countLabel = hasActiveCriteria ? "match your filters" : "available";
  const countMessage =
    typeof liveResultCount === "number"
      ? `${formatListingCount(liveResultCount)} ${countLabel}`
      : "Listings available";

  useEffect(() => {
    if (!shouldHydrateFromSession) {
      hasLoadedSessionStateRef.current = true;
      return;
    }

    const sessionState = readSessionSearchState();

    if (!sessionState) {
      hasLoadedSessionStateRef.current = true;
      return;
    }

    didHydrateSessionStateRef.current = true;
    const timeout = window.setTimeout(() => {
      setAreas(sessionState.areas);
      setBathrooms(sessionState.bathrooms);
      setBedrooms(sessionState.bedrooms);
      setBuyerIncentive(sessionState.buyerIncentive);
      setFeatures(new Set(sessionState.features));
      setGarages(sessionState.garages);
      setListingTypes(sessionState.listingTypes);
      setMaxPrice(sessionState.maxPrice);
      setMinErfSize(sessionState.minErfSize);
      setMinFloorSize(sessionState.minFloorSize);
      setMinPrice(sessionState.minPrice);
      setParking(sessionState.parking);
      setPropertyTypes(sessionState.propertyTypes);
      hasLoadedSessionStateRef.current = true;
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [shouldHydrateFromSession]);

  useEffect(() => {
    if (!hasLoadedSessionStateRef.current) return;
    if (didHydrateSessionStateRef.current) {
      didHydrateSessionStateRef.current = false;
      return;
    }

    window.sessionStorage.setItem(
      propertySearchSessionKey,
      JSON.stringify({
        areas,
        bathrooms,
        bedrooms,
        buyerIncentive,
        features: Array.from(features),
        garages,
        listingTypes,
        maxPrice,
        minErfSize,
        minFloorSize,
        minPrice,
        parking,
        propertyTypes,
      }),
    );
  }, [
    areas,
    bathrooms,
    bedrooms,
    buyerIncentive,
    features,
    garages,
    listingTypes,
    maxPrice,
    minErfSize,
    minFloorSize,
    minPrice,
    parking,
    propertyTypes,
  ]);

  useEffect(() => {
    if (!hasLoadedSessionStateRef.current) return;

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      setIsCountPending(true);

      void loadDiscoverListingCount(currentFilters)
        .then((count) => {
          if (isCurrent) {
            setLiveResultCount(count);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setLiveResultCount(resultCount);
          }
        })
        .finally(() => {
          if (isCurrent) {
            setIsCountPending(false);
          }
        });
    }, 220);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [currentFilters, resultCount]);

  useEffect(() => {
    if (!isHero) return;

    let isCurrent = true;

    async function refreshCount() {
      try {
        const count = await loadDiscoverListingCount(currentFilters);

        if (isCurrent) {
          setLiveResultCount(count);
        }
      } catch {
        if (isCurrent) {
          setLiveResultCount((currentCount) => currentCount ?? resultCount);
        }
      }
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshCount();
      }
    }, 15_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshCount();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCurrent = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentFilters, isHero, resultCount]);

  useEffect(() => {
    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      const query = areaQuery.trim();

      if (query.length < 2) {
        setPlacePredictions([]);
        setPlacesStatus("idle");
        return;
      }

      setPlacesStatus("loading");

      void loadGooglePlaces()
        .then(() => {
          const places = (window as GoogleWindow).google?.maps?.places;

          if (!places) {
            throw new Error("Google Places is not available.");
          }

          const service = new places.AutocompleteService();
          const sessionToken = new places.AutocompleteSessionToken();

          service.getPlacePredictions(
            {
              input: query,
              sessionToken,
              types: ["(regions)"],
            },
            (results, status) => {
              if (!isCurrent) return;

              if (status !== places.PlacesServiceStatus.OK || !results?.length) {
                setPlacePredictions([]);
                setPlacesStatus("ready");
                return;
              }

              setPlacePredictions(results.slice(0, 5));
              setPlacesStatus("ready");
            },
          );
        })
        .catch(() => {
          if (!isCurrent) return;

          setPlacePredictions([]);
          setPlacesStatus("error");
        });
    }, 180);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [areaQuery]);

  function addArea(area: string) {
    const cleanArea = area.trim();

    if (!cleanArea) return;

    setAreas((currentAreas) =>
      currentAreas.some(
        (currentArea) => currentArea.toLowerCase() === cleanArea.toLowerCase(),
      )
        ? currentAreas
        : [...currentAreas, cleanArea].slice(0, 8),
    );
    setAreaQuery("");
  }

  function addPlaceArea(place: GoogleAutocompletePrediction) {
    addArea(placeRegionLabel(place));
    setPlacePredictions([]);
  }

  function removeArea(area: string) {
    setAreas((currentAreas) => currentAreas.filter((item) => item !== area));
  }

  function toggleFeature(feature: string) {
    setFeatures((currentFeatures) => {
      const nextFeatures = new Set(currentFeatures);

      if (nextFeatures.has(feature)) {
        nextFeatures.delete(feature);
      } else {
        nextFeatures.add(feature);
      }

      return nextFeatures;
    });
  }

  const filtersDialog = (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-12 w-full", isHero && "h-14 bg-white text-base dark:bg-background")}
        >
          <SlidersHorizontal className="size-4" />
          {isHero ? "More filters" : "Filters"}
          {modalFilterCount ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
              {modalFilterCount}
            </span>
          ) : null}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-[101] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none sm:mx-auto sm:max-w-2xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <Dialog.Title className="text-base font-semibold">Filters</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" size="icon" variant="ghost" aria-label="Close">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldSelect
                label="Bathrooms"
                onChange={setBathrooms}
                options={options.bathrooms.map((value) => ({
                  label: `${value}+`,
                  value,
                }))}
                value={bathrooms}
              />
              <FieldSelect
                label="Garages"
                onChange={setGarages}
                options={options.garages.map((value) => ({
                  label: `${value}+`,
                  value,
                }))}
                value={garages}
              />
              <FieldSelect
                label="Parking"
                onChange={setParking}
                options={options.parking.map((value) => ({
                  label: `${value}+`,
                  value,
                }))}
                value={parking}
              />
              <FieldSelect
                label="Buyer badge"
                onChange={setBuyerIncentive}
                options={options.buyerIncentives.map((value) => ({
                  label: value,
                  value,
                }))}
                value={buyerIncentive}
              />
              <FieldSelect
                label="Min floor size"
                onChange={setMinFloorSize}
                options={options.floorSizes.map((value) => ({
                  label: `${value} m2`,
                  value,
                }))}
                value={minFloorSize}
              />
              <FieldSelect
                label="Min erf size"
                onChange={setMinErfSize}
                options={options.erfSizes.map((value) => ({
                  label: `${value} m2`,
                  value,
                }))}
                value={minErfSize}
              />
            </div>
            <fieldset className="mt-5 grid gap-2">
              <legend className="text-xs font-semibold">Features</legend>
              <div className="flex flex-wrap gap-2">
                {featureOptions.map((feature) => (
                  <button
                    key={feature}
                    type="button"
                    className={cn(
                      "rounded-full border border-border bg-muted/45 px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary",
                      features.has(feature) &&
                        "border-primary bg-primary/10 text-primary",
                    )}
                    onClick={() => toggleFeature(feature)}
                  >
                    #{feature.replace(/\s+/g, "")}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border p-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setBathrooms("");
                setGarages("");
                setParking("");
                setBuyerIncentive("");
                setMinFloorSize("");
                setMinErfSize("");
                setFeatures(new Set());
              }}
            >
              Clear
            </Button>
            <Dialog.Close asChild>
              <Button type="button">
                Done
                {typeof liveResultCount === "number"
                  ? ` (${formatListingCount(liveResultCount)})`
                  : null}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  function renderAreaInput() {
    return (
      <div
        className={cn(
          "relative flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary",
          isHero &&
            "min-h-16 border-border/80 bg-white px-5 text-brand-black shadow-sm dark:bg-background dark:text-foreground",
        )}
      >
      <Search className={cn("size-4 shrink-0 text-muted-foreground", isHero && "size-5")} />
      {areas.map((area) => (
        <span
          key={area}
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"
        >
          <span className="max-w-36 truncate">{area}</span>
          <button
            type="button"
            aria-label={`Remove ${area}`}
            onClick={() => removeArea(area)}
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={areaQuery}
        onChange={(event) => setAreaQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addArea(areaQuery);
          }
        }}
        placeholder={
          areas.length
            ? "Add area"
            : isHero
              ? "Search city, town, region or country"
              : "Search country, city or suburb"
        }
        className={cn(
          "min-w-32 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground",
          isHero && "text-base",
        )}
      />
      {areaQuery.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
          {areaSuggestions.length ? (
            <>
              {areaSuggestions.map((area) => (
                <button
                  key={area}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
                  onClick={() => addArea(area)}
                >
                  <span>{area}</span>
                  <span className="text-xs font-normal text-muted-foreground">Area</span>
                </button>
              ))}
            </>
          ) : null}
          {placePredictions.map((place) => (
            <button
              key={place.place_id}
              type="button"
              className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
              onClick={() => addPlaceArea(place)}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {placeRegionLabel(place)}
                </span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {place.structured_formatting?.secondary_text || "Google Places"}
                </span>
              </span>
            </button>
          ))}
          {placesStatus === "loading" ? (
            <p className="px-3 py-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Searching places
            </p>
          ) : null}
          {placePredictions.length ? (
            <p className="px-3 pb-1 pt-2 text-right text-[9px] font-normal uppercase tracking-[0.35em] text-muted-foreground">
              Powered by Google
            </p>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
            onClick={() => addArea(areaQuery)}
          >
            <span>Add &quot;{areaQuery.trim()}&quot;</span>
            <span className="text-xs font-normal text-muted-foreground">Custom</span>
          </button>
        </div>
      ) : null}
      </div>
    );
  }

  const areaInput = renderAreaInput();

  if (isHero) {
    return (
      <form
        ref={formRef}
        action={action}
        className={cn(
          "relative z-20 rounded-xl border border-white/80 bg-white/94 p-5 text-brand-black shadow-[0_18px_46px_rgba(126,87,255,0.16),0_0_22px_rgba(235,62,188,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-background/92 dark:text-foreground",
          className,
        )}
      >
        {countryName ? (
          <input type="hidden" name="countryName" value={countryName} />
        ) : null}
        {areas.map((area) => (
          <input key={`area-input-${area}`} type="hidden" name="area" value={area} />
        ))}
        {Array.from(features).map((feature) => (
          <input
            key={`feature-input-${feature}`}
            type="hidden"
            name="features"
            value={feature}
          />
        ))}
        {listingTypes.map((listingType) => (
          <input
            key={`listing-type-input-${listingType}`}
            type="hidden"
            name="listingType"
            value={listingType}
          />
        ))}
        {propertyTypes.map((propertyType) => (
          <input
            key={`property-type-input-${propertyType}`}
            type="hidden"
            name="propertyType"
            value={propertyType}
          />
        ))}
        <input type="hidden" name="minPrice" value={minPrice} />
        <input type="hidden" name="maxPrice" value={maxPrice} />
        <input type="hidden" name="bedrooms" value={bedrooms} />
        <input type="hidden" name="bathrooms" value={bathrooms} />
        <input type="hidden" name="garages" value={garages} />
        <input type="hidden" name="parking" value={parking} />
        <input type="hidden" name="minFloorSize" value={minFloorSize} />
        <input type="hidden" name="minErfSize" value={minErfSize} />
        <input type="hidden" name="buyerIncentive" value={buyerIncentive} />

        <div
          aria-live="polite"
          className="mb-4 flex items-center justify-center text-center text-xs font-normal text-muted-foreground sm:text-sm"
        >
          {typeof liveResultCount === "number" ? (
            <span>
              <span className="text-primary">
                {formatListingCount(liveResultCount)}
              </span>{" "}
              <span>{countLabel}</span>
            </span>
          ) : (
            <span>{countMessage}</span>
          )}
          {isCountPending ? (
            <span className="ml-2 inline-block size-1.5 animate-pulse rounded-full bg-primary" />
          ) : null}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem]">
          {areaInput}
          <Button type="submit" className="h-14 px-8 text-sm shadow-lg shadow-primary/25 sm:h-16 sm:text-base">
            {submitLabel}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MultiSearchSelect
            allLabel="All listing types"
            className="h-12 bg-white text-sm dark:bg-background sm:h-14 sm:text-base"
            label="Listing type"
            onChange={setListingTypes}
            options={listingTypeSelectOptions}
            values={listingTypes}
          />
          <MultiSearchSelect
            allLabel="All types"
            className="h-12 bg-white text-sm dark:bg-background sm:h-14 sm:text-base"
            label="All types"
            onChange={setPropertyTypes}
            options={propertyTypeSelectOptions}
            values={propertyTypes}
          />
          <SearchSelect
            className="h-12 bg-white text-sm dark:bg-background sm:h-14 sm:text-base lg:col-start-3"
            label="Bedrooms"
            onChange={setBedrooms}
            options={[{ label: "Bedrooms", value: "" }, ...bedroomOptions]}
            value={bedrooms}
          />
          <SearchSelect
            className="h-12 bg-white text-sm dark:bg-background sm:h-14 sm:text-base lg:col-start-4 lg:row-start-1"
            label="Min price"
            onChange={setMinPrice}
            options={[{ label: "Min price", value: "" }, ...priceOptions]}
            value={minPrice}
          />
          <SearchSelect
            className="col-span-2 h-12 bg-white text-sm dark:bg-background sm:col-span-1 sm:h-14 sm:text-base lg:col-start-5 lg:row-start-1"
            label="Max price"
            onChange={setMaxPrice}
            options={[{ label: "Max price", value: "" }, ...priceOptions]}
            value={maxPrice}
          />
          <div className="col-span-2 lg:col-span-1 lg:col-start-6 lg:row-start-1">
            {filtersDialog}
          </div>
        </div>
      </form>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className={cn(
        isHero
          ? "rounded-xl border border-white/70 bg-white/92 p-4 text-brand-black shadow-2xl shadow-primary/15 backdrop-blur-xl dark:border-white/10 dark:bg-background/90 dark:text-foreground sm:p-5"
          : "rounded-lg border border-border bg-card p-2 text-card-foreground shadow-xl",
        className,
      )}
    >
      {countryName ? (
        <input type="hidden" name="countryName" value={countryName} />
      ) : null}
      {areas.map((area) => (
        <input key={`area-input-${area}`} type="hidden" name="area" value={area} />
      ))}
      {Array.from(features).map((feature) => (
        <input
          key={`feature-input-${feature}`}
          type="hidden"
          name="features"
          value={feature}
        />
      ))}
      {listingTypes.map((listingType) => (
        <input
          key={`listing-type-input-${listingType}`}
          type="hidden"
          name="listingType"
          value={listingType}
        />
      ))}
      {propertyTypes.map((propertyType) => (
        <input
          key={`property-type-input-${propertyType}`}
          type="hidden"
          name="propertyType"
          value={propertyType}
        />
      ))}
      <input type="hidden" name="minPrice" value={minPrice} />
      <input type="hidden" name="maxPrice" value={maxPrice} />
      <input type="hidden" name="bedrooms" value={bedrooms} />
      <input type="hidden" name="bathrooms" value={bathrooms} />
      <input type="hidden" name="garages" value={garages} />
      <input type="hidden" name="parking" value={parking} />
      <input type="hidden" name="minFloorSize" value={minFloorSize} />
      <input type="hidden" name="minErfSize" value={minErfSize} />
      <input type="hidden" name="buyerIncentive" value={buyerIncentive} />

      <div
        className={cn(
          "grid gap-2",
          isHero
            ? "lg:grid-cols-[auto_auto_minmax(18rem,1fr)_auto]"
            : "lg:grid-cols-[11rem_minmax(18rem,1fr)_auto]",
        )}
      >
        <MultiSearchSelect
          allLabel="All listing types"
          className={cn(
            "order-2 lg:order-1",
            isHero &&
              "h-12 border-transparent bg-[var(--homzie-gradient)] px-5 text-white shadow-lg shadow-primary/25 hover:brightness-105",
          )}
          label="Listing type"
          onChange={setListingTypes}
          options={listingTypeSelectOptions}
          values={listingTypes}
        />

        <div
          className={cn(
            "relative order-1 flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary lg:order-2",
            isHero && "min-h-14 border-border/70 bg-white text-brand-black dark:bg-background dark:text-foreground lg:col-span-2",
          )}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {areas.map((area) => (
            <span
              key={area}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"
            >
              <span className="max-w-36 truncate">{area}</span>
              <button
                type="button"
                aria-label={`Remove ${area}`}
                onClick={() => removeArea(area)}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={areaQuery}
            onChange={(event) => setAreaQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addArea(areaQuery);
              }
            }}
            placeholder={
              areas.length
                ? "Add area"
                : isHero
                  ? "Search city, town, region or country"
                  : "Search country, city or suburb"
            }
            className="min-w-32 flex-1 bg-transparent text-sm font-normal outline-none placeholder:text-muted-foreground"
          />
          {areaQuery.trim() ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
              {areaSuggestions.length ? (
                <>
                  {areaSuggestions.map((area) => (
                    <button
                      key={area}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
                      onClick={() => addArea(area)}
                    >
                      <span>{area}</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        Area
                      </span>
                    </button>
                  ))}
                </>
              ) : null}
              {placePredictions.map((place) => (
                <button
                  key={place.place_id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
                  onClick={() => addPlaceArea(place)}
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {placeRegionLabel(place)}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {place.structured_formatting?.secondary_text || "Google Places"}
                    </span>
                  </span>
                </button>
              ))}
              {placesStatus === "loading" ? (
                <p className="px-3 py-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
                  Searching places
                </p>
              ) : null}
              {placePredictions.length ? (
                <p className="px-3 pb-1 pt-2 text-right text-[9px] font-normal uppercase tracking-[0.35em] text-muted-foreground">
                  Powered by Google
                </p>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
                onClick={() => addArea(areaQuery)}
              >
                <span>Add &quot;{areaQuery.trim()}&quot;</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Custom
                </span>
              </button>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "order-3 grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:grid-cols-[auto_auto]",
            isHero && "lg:col-start-4 lg:row-start-1",
          )}
        >
          <Button
            type="submit"
            className={cn(
              "h-12",
              isHero && "h-14 px-8 shadow-lg shadow-primary/25",
            )}
          >
            {submitLabel}
          </Button>
        </div>
      </div>

      <div className={cn("mt-2 grid gap-2 md:grid-cols-5", isHero && "mt-4")}>
        <MultiSearchSelect
          allLabel="All types"
          className={isHero ? "h-14 bg-white dark:bg-background" : undefined}
          label="Property type"
          onChange={setPropertyTypes}
          options={propertyTypeSelectOptions}
          values={propertyTypes}
        />
        <SearchSelect
          className={isHero ? "h-14 bg-white dark:bg-background" : undefined}
          label="Min price"
          onChange={setMinPrice}
          options={[{ label: "Min price", value: "" }, ...priceOptions]}
          value={minPrice}
        />
        <SearchSelect
          className={isHero ? "h-14 bg-white dark:bg-background" : undefined}
          label="Max price"
          onChange={setMaxPrice}
          options={[{ label: "Max price", value: "" }, ...priceOptions]}
          value={maxPrice}
        />
        <SearchSelect
          className={isHero ? "h-14 bg-white dark:bg-background" : undefined}
          label="Bedrooms"
          onChange={setBedrooms}
          options={[{ label: "Bedrooms", value: "" }, ...bedroomOptions]}
          value={bedrooms}
        />
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn("h-12", isHero && "h-14 bg-white dark:bg-background")}
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {modalFilterCount ? (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
                  {modalFilterCount}
                </span>
              ) : null}
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-x-3 top-1/2 z-[101] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none sm:mx-auto sm:max-w-2xl">
              <div className="flex items-center justify-between border-b border-border p-4">
                <Dialog.Title className="text-base font-semibold">Filters</Dialog.Title>
                <Dialog.Close asChild>
                  <Button type="button" size="icon" variant="ghost" aria-label="Close">
                    <X className="size-5" />
                  </Button>
                </Dialog.Close>
              </div>
              <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldSelect
                    label="Bathrooms"
                    onChange={setBathrooms}
                    options={options.bathrooms.map((value) => ({
                      label: `${value}+`,
                      value,
                    }))}
                    value={bathrooms}
                  />
                  <FieldSelect
                    label="Garages"
                    onChange={setGarages}
                    options={options.garages.map((value) => ({
                      label: `${value}+`,
                      value,
                    }))}
                    value={garages}
                  />
                  <FieldSelect
                    label="Parking"
                    onChange={setParking}
                    options={options.parking.map((value) => ({
                      label: `${value}+`,
                      value,
                    }))}
                    value={parking}
                  />
                  <FieldSelect
                    label="Buyer badge"
                    onChange={setBuyerIncentive}
                    options={options.buyerIncentives.map((value) => ({
                      label: value,
                      value,
                    }))}
                    value={buyerIncentive}
                  />
                  <FieldSelect
                    label="Min floor size"
                    onChange={setMinFloorSize}
                    options={options.floorSizes.map((value) => ({
                      label: `${value} m2`,
                      value,
                    }))}
                    value={minFloorSize}
                  />
                  <FieldSelect
                    label="Min erf size"
                    onChange={setMinErfSize}
                    options={options.erfSizes.map((value) => ({
                      label: `${value} m2`,
                      value,
                    }))}
                    value={minErfSize}
                  />
                </div>
                <fieldset className="mt-5 grid gap-2">
                  <legend className="text-xs font-semibold">Features</legend>
                  <div className="flex flex-wrap gap-2">
                    {featureOptions.map((feature) => (
                      <button
                        key={feature}
                        type="button"
                        className={cn(
                          "rounded-full border border-border bg-muted/45 px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary",
                          features.has(feature) &&
                            "border-primary bg-primary/10 text-primary",
                        )}
                        onClick={() => toggleFeature(feature)}
                      >
                        #{feature.replace(/\s+/g, "")}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border p-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setBathrooms("");
                    setGarages("");
                    setParking("");
                    setBuyerIncentive("");
                    setMinFloorSize("");
                    setMinErfSize("");
                    setFeatures(new Set());
                  }}
                >
                  Clear
                </Button>
                <Dialog.Close asChild>
                  <Button type="button">
                    Done
                    {typeof liveResultCount === "number"
                      ? ` (${formatListingCount(liveResultCount)})`
                      : null}
                  </Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <div
        className={cn(
          "mt-2 flex flex-wrap gap-2 px-1 text-xs font-normal text-muted-foreground",
          isHero && "sr-only",
        )}
      >
        <span>{listingTypeLabel}</span>
        <span>•</span>
        <span>{propertyTypeLabel}</span>
        <span>•</span>
        <span>{priceLabel}</span>
        {typeof liveResultCount === "number" ? (
          <>
            <span>•</span>
            <span>{formatListingCount(liveResultCount)}</span>
          </>
        ) : null}
      </div>
    </form>
  );
}
