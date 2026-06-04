"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Map,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  variant?: "default" | "hero";
};

type SelectOption = {
  label: string;
  value: string;
};

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

function formatPrice(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) return value;

  return new Intl.NumberFormat("en", {
    currency: "ZAR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(number);
}

function optionLabel(options: SelectOption[], value?: string, fallback = "Any") {
  return options.find((option) => option.value === value)?.label || fallback;
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-12 min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-background px-4 text-left text-sm font-black text-foreground shadow-sm transition hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
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
    <label className="grid gap-1.5 text-xs font-black">
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
  variant = "default",
}: PropertySearchBarProps) {
  const [areas, setAreas] = useState(() => selectedAreas(filters));
  const [areaQuery, setAreaQuery] = useState("");
  const [listingType, setListingType] = useState(filters.listingType || "sale");
  const [propertyType, setPropertyType] = useState(filters.propertyType || "");
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
  const [features, setFeatures] = useState(() => new Set(filters.features || []));

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
  const listingTypeLabel = optionLabel(
    listingTypeOptions.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    listingType,
    "Buy",
  );
  const propertyTypeLabel = optionLabel(
    propertyTypeOptions.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    propertyType,
    "All types",
  );
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

  const mapDialog = (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-12", isHero && "h-14 px-5 text-base")}
        >
          <Map className="size-4" />
          Map
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-3 z-[101] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none sm:inset-6">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <Dialog.Title className="text-base font-black">
                Pick areas on the map
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs font-semibold text-muted-foreground">
                Select available areas from {countryName || "your search"}.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" size="icon" variant="ghost" aria-label="Close">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="grid h-[calc(100%-4.5rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="overflow-y-auto border-b border-border p-4 lg:border-b-0 lg:border-r">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Available areas
              </p>
              <div className="mt-3 grid gap-2">
                {options.areas.map((area) => {
                  const active = areas.includes(area);

                  return (
                    <button
                      key={`map-${area}`}
                      type="button"
                      className={cn(
                        "flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm font-black transition hover:border-primary hover:text-primary",
                        active && "border-primary bg-primary/10 text-primary",
                      )}
                      onClick={() => (active ? removeArea(area) : addArea(area))}
                    >
                      <span>{area}</span>
                      <MapPin className="size-4" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="relative min-h-80 overflow-hidden bg-muted">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(126,87,255,0.24),transparent_28%),radial-gradient(circle_at_80%_35%,rgba(235,62,188,0.18),transparent_26%),linear-gradient(135deg,rgba(126,87,255,0.10),rgba(8,145,178,0.12))]" />
              <div className="absolute inset-0 grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
                {options.areas.slice(0, 16).map((area) => {
                  const active = areas.includes(area);

                  return (
                    <button
                      key={`map-pin-${area}`}
                      type="button"
                      className={cn(
                        "self-center rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-black text-foreground shadow-lg backdrop-blur transition hover:border-primary hover:text-primary",
                        active &&
                          "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                      )}
                      onClick={() => (active ? removeArea(area) : addArea(area))}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  const filtersDialog = (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-12", isHero && "h-14 bg-white text-base dark:bg-background")}
        >
          <SlidersHorizontal className="size-4" />
          {isHero ? "More filters" : "Filters"}
          {modalFilterCount ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-black leading-5 text-primary-foreground">
              {modalFilterCount}
            </span>
          ) : null}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-[101] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none sm:mx-auto sm:max-w-2xl">
          <div className="flex items-center justify-between border-b border-border p-4">
            <Dialog.Title className="text-base font-black">Filters</Dialog.Title>
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
              <legend className="text-xs font-black">Features</legend>
              <div className="flex flex-wrap gap-2">
                {featureOptions.map((feature) => (
                  <button
                    key={feature}
                    type="button"
                    className={cn(
                      "rounded-full border border-border bg-muted/45 px-3 py-2 text-xs font-black transition hover:border-primary hover:text-primary",
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
                {typeof resultCount === "number"
                  ? ` (${resultCount} ${resultCount === 1 ? "result" : "results"})`
                  : null}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );

  const areaInput = (
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
          className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-black text-primary"
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
              ? "Search by area, suburb or address"
              : "Search country, city or suburb"
        }
        className={cn(
          "min-w-32 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground",
          isHero && "text-base",
        )}
      />
      {areas[0] && isHero ? (
        <span className="inline-flex min-w-0 items-center gap-1 border-l border-border pl-2 text-xs font-black text-primary sm:gap-2 sm:pl-4 sm:text-sm">
          <MapPin className="size-5" />
          <span className="max-w-24 truncate sm:max-w-36">{areas[0]}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </span>
      ) : null}
      {areaQuery.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
          {areaSuggestions.length ? (
            areaSuggestions.map((area) => (
              <button
                key={area}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
                onClick={() => addArea(area)}
              >
                <span>{area}</span>
                <span className="text-xs font-black text-muted-foreground">Area</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
              onClick={() => addArea(areaQuery)}
            >
              <span>Add &quot;{areaQuery.trim()}&quot;</span>
              <span className="text-xs font-black text-muted-foreground">Custom</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );

  if (isHero) {
    return (
      <form
        action={action}
        className={cn(
          "rounded-xl border border-white/80 bg-white/94 p-5 text-brand-black shadow-[0_18px_46px_rgba(126,87,255,0.16),0_0_22px_rgba(235,62,188,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-background/92 dark:text-foreground",
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
        <input type="hidden" name="listingType" value={listingType} />
        <input type="hidden" name="propertyType" value={propertyType} />
        <input type="hidden" name="minPrice" value={minPrice} />
        <input type="hidden" name="maxPrice" value={maxPrice} />
        <input type="hidden" name="bedrooms" value={bedrooms} />
        <input type="hidden" name="bathrooms" value={bathrooms} />
        <input type="hidden" name="garages" value={garages} />
        <input type="hidden" name="parking" value={parking} />
        <input type="hidden" name="minFloorSize" value={minFloorSize} />
        <input type="hidden" name="minErfSize" value={minErfSize} />
        <input type="hidden" name="buyerIncentive" value={buyerIncentive} />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_8rem_10rem]">
          {areaInput}
          {mapDialog}
          <Button type="submit" className="h-14 px-8 text-sm shadow-lg shadow-primary/25 sm:h-16 sm:text-base">
            <Search className="size-5" />
            Search
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <SearchSelect
            className="h-12 bg-white text-sm dark:bg-background sm:h-14 sm:text-base"
            label="Listing type"
            onChange={setListingType}
            options={listingTypeOptions.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            value={listingType}
          />
          <SearchSelect
            className="h-12 bg-white text-sm dark:bg-background sm:h-14 sm:text-base"
            label="All types"
            onChange={setPropertyType}
            options={[
              { label: "All types", value: "" },
              ...propertyTypeOptions.map((option) => ({
                label: option.label,
                value: option.value,
              })),
            ]}
            value={propertyType}
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
            className="h-12 bg-white text-sm dark:bg-background sm:h-14 sm:text-base lg:col-start-5 lg:row-start-1"
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
      <input type="hidden" name="listingType" value={listingType} />
      <input type="hidden" name="propertyType" value={propertyType} />
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
        <SearchSelect
          className={
            isHero
              ? "h-12 border-transparent bg-[var(--homzie-gradient)] px-5 text-white shadow-lg shadow-primary/25 hover:brightness-105"
              : undefined
          }
          label="For sale"
          onChange={setListingType}
          options={listingTypeOptions.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          value={listingType}
        />

        {isHero ? (
          <SearchSelect
            className="h-12 border-transparent bg-muted/70 px-5 text-foreground shadow-none hover:bg-muted"
            label="To rent"
            onChange={setListingType}
            options={[
              { label: "To rent", value: "rental" },
              { label: "For sale", value: "sale" },
              { label: "Development", value: "development" },
              { label: "Commercial", value: "commercial" },
            ]}
            value={listingType === "rental" ? "rental" : ""}
          />
        ) : null}

        <div
          className={cn(
            "relative flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary",
            isHero && "min-h-14 border-border/70 bg-white text-brand-black dark:bg-background dark:text-foreground lg:col-span-2",
          )}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          {areas.map((area) => (
            <span
              key={area}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-black text-primary"
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
                  ? "Search by area, suburb or address"
                  : "Search country, city or suburb"
            }
            className="min-w-32 flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
          />
          {areaQuery.trim() ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[80] max-h-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl">
              {areaSuggestions.length ? (
                areaSuggestions.map((area) => (
                  <button
                    key={area}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
                    onClick={() => addArea(area)}
                  >
                    <span>{area}</span>
                    <span className="text-xs font-black text-muted-foreground">
                      Area
                    </span>
                  </button>
                ))
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-accent hover:text-accent-foreground"
                  onClick={() => addArea(areaQuery)}
                >
                  <span>Add &quot;{areaQuery.trim()}&quot;</span>
                  <span className="text-xs font-black text-muted-foreground">
                    Custom
                  </span>
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:grid-cols-[auto_auto]",
            isHero && "lg:col-start-4 lg:row-start-1",
          )}
        >
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("h-12", isHero && "h-14 px-5")}
              >
                <Map className="size-4" />
                Map
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" />
              <Dialog.Content className="fixed inset-3 z-[101] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none sm:inset-6">
                <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <Dialog.Title className="text-base font-black">
                      Pick areas on the map
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-xs font-semibold text-muted-foreground">
                      Select available areas from {countryName || "your search"}.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <Button type="button" size="icon" variant="ghost" aria-label="Close">
                      <X className="size-5" />
                    </Button>
                  </Dialog.Close>
                </div>
                <div className="grid h-[calc(100%-4.5rem)] lg:grid-cols-[22rem_minmax(0,1fr)]">
                  <div className="overflow-y-auto border-b border-border p-4 lg:border-b-0 lg:border-r">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                      Available areas
                    </p>
                    <div className="mt-3 grid gap-2">
                      {options.areas.map((area) => {
                        const active = areas.includes(area);

                        return (
                          <button
                            key={`map-${area}`}
                            type="button"
                            className={cn(
                              "flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm font-black transition hover:border-primary hover:text-primary",
                              active && "border-primary bg-primary/10 text-primary",
                            )}
                            onClick={() =>
                              active ? removeArea(area) : addArea(area)
                            }
                          >
                            <span>{area}</span>
                            <MapPin className="size-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="relative min-h-80 overflow-hidden bg-muted">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(126,87,255,0.24),transparent_28%),radial-gradient(circle_at_80%_35%,rgba(235,62,188,0.18),transparent_26%),linear-gradient(135deg,rgba(126,87,255,0.10),rgba(8,145,178,0.12))]" />
                    <div className="absolute inset-0 grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
                      {options.areas.slice(0, 16).map((area) => {
                        const active = areas.includes(area);

                        return (
                          <button
                            key={`map-pin-${area}`}
                            type="button"
                            className={cn(
                              "self-center rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-black text-foreground shadow-lg backdrop-blur transition hover:border-primary hover:text-primary",
                              active && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
                            )}
                            onClick={() =>
                              active ? removeArea(area) : addArea(area)
                            }
                          >
                            {area}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Button
            type="submit"
            className={cn(
              "h-12",
              isHero && "h-14 px-8 shadow-lg shadow-primary/25",
            )}
          >
            <Search className="size-4" />
            Search
          </Button>
        </div>
      </div>

      <div className={cn("mt-2 grid gap-2 md:grid-cols-5", isHero && "mt-4")}>
        <SearchSelect
          className={isHero ? "h-14 bg-white dark:bg-background" : undefined}
          label="Property type"
          onChange={setPropertyType}
          options={[
            { label: "All types", value: "" },
            ...propertyTypeOptions.map((option) => ({
              label: option.label,
              value: option.value,
            })),
          ]}
          value={propertyType}
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
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-black leading-5 text-primary-foreground">
                  {modalFilterCount}
                </span>
              ) : null}
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-x-3 top-1/2 z-[101] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none sm:mx-auto sm:max-w-2xl">
              <div className="flex items-center justify-between border-b border-border p-4">
                <Dialog.Title className="text-base font-black">Filters</Dialog.Title>
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
                  <legend className="text-xs font-black">Features</legend>
                  <div className="flex flex-wrap gap-2">
                    {featureOptions.map((feature) => (
                      <button
                        key={feature}
                        type="button"
                        className={cn(
                          "rounded-full border border-border bg-muted/45 px-3 py-2 text-xs font-black transition hover:border-primary hover:text-primary",
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
                    {typeof resultCount === "number"
                      ? ` (${resultCount} ${resultCount === 1 ? "result" : "results"})`
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
          "mt-2 flex flex-wrap gap-2 px-1 text-xs font-semibold text-muted-foreground",
          isHero && "sr-only",
        )}
      >
        <span>{listingTypeLabel}</span>
        <span>•</span>
        <span>{propertyTypeLabel}</span>
        <span>•</span>
        <span>{priceLabel}</span>
        {typeof resultCount === "number" ? (
          <>
            <span>•</span>
            <span>{resultCount} {resultCount === 1 ? "result" : "results"}</span>
          </>
        ) : null}
      </div>
    </form>
  );
}
