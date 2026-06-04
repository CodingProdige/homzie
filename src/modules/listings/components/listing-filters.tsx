"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { type ReactNode, useRef, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  featureOptions,
  listingTypeOptions,
  propertyTypeOptions,
} from "@/modules/listings/options";
import type {
  DiscoverListingFilters,
  ListingFilterOptions,
} from "@/modules/listings/server/discover-listings";

type ListingFiltersProps = {
  action?: string;
  filters: DiscoverListingFilters & { features?: string[] };
  options: ListingFilterOptions;
  preserveCountryName?: string;
  resetHref?: string;
};

const selectFilters = [
  { name: "minPrice", label: "Min price", values: "prices" },
  { name: "maxPrice", label: "Max price", values: "prices" },
  { name: "bedrooms", label: "Beds", values: "bedrooms" },
  { name: "bathrooms", label: "Baths", values: "bathrooms" },
  { name: "garages", label: "Garages", values: "garages" },
  { name: "parking", label: "Parking", values: "parking" },
  { name: "minFloorSize", label: "Min floor m2", values: "floorSizes" },
  { name: "minErfSize", label: "Min erf m2", values: "erfSizes" },
] as const;

function fieldValue(filters: ListingFiltersProps["filters"], name: string) {
  const value = filters[name as keyof typeof filters];

  if (Array.isArray(value)) return value[0] || "";

  return typeof value === "string" ? value : "";
}

function fieldValues(filters: ListingFiltersProps["filters"], name: string) {
  const value = filters[name as keyof typeof filters];

  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value) return [value];

  return [];
}

function formatOptionLabel(name: string, value: string) {
  if (name.toLowerCase().includes("price")) {
    return new Intl.NumberFormat("en", {
      maximumFractionDigits: 0,
      style: "currency",
      currency: "ZAR",
    }).format(Number(value));
  }

  return value;
}

function AutoSubmitForm({
  action,
  children,
  className,
}: {
  action: string;
  children: ReactNode;
  className: string;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      onChange={(event) => {
        const target = event.target;

        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        ) {
          formRef.current?.requestSubmit();
        }
      }}
    >
      {children}
    </form>
  );
}

type SelectOption = {
  label: string;
  value: string;
};

function SelectField({
  options,
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  options: SelectOption[];
  value?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeOption =
    options.find((option) => option.value === value) || options[0];

  return (
    <label className="grid gap-1.5 text-xs font-black">
      <span>{label}</span>
      <input ref={inputRef} type="hidden" name={name} defaultValue={value || ""} />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm font-semibold text-foreground outline-none transition hover:bg-muted/45 focus:border-primary"
          >
            <span className="min-w-0 truncate">
              {activeOption?.label || "Any"}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[120] max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-44 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          >
            {options.map((option) => (
              <DropdownMenu.Item
                key={`${name}-${option.value || "any"}`}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm font-semibold outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                onSelect={() => {
                  if (!inputRef.current) return;

                  inputRef.current.value = option.value;
                  inputRef.current.form?.requestSubmit();
                }}
              >
                <Check
                  className={
                    option.value === (value || "")
                      ? "size-4 text-primary"
                      : "size-4 text-transparent"
                  }
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </label>
  );
}

function MultiSelectField({
  allLabel,
  label,
  name,
  options,
  values,
}: {
  allLabel: string;
  label: string;
  name: string;
  options: SelectOption[];
  values: string[];
}) {
  const [selectedValues, setSelectedValues] = useState(values);
  const selected = new Set(selectedValues);
  const formRef = useRef<HTMLFormElement | null>(null);
  const activeLabel =
    selectedValues.length === 0
      ? allLabel
      : selectedValues.length === 1
        ? options.find((option) => option.value === selectedValues[0])?.label ||
          allLabel
        : `${selectedValues.length} selected`;

  function updateValues(nextValues: string[]) {
    setSelectedValues(nextValues);
    window.setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  function toggleValue(value: string) {
    if (!value) {
      updateValues([]);
      return;
    }

    updateValues(
      selected.has(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value],
    );
  }

  return (
    <label className="grid gap-1.5 text-xs font-black">
      <span>{label}</span>
      <span ref={(node) => void (formRef.current = node?.closest("form") || null)}>
        {selectedValues.map((value) => (
          <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
        ))}
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm font-semibold text-foreground outline-none transition hover:bg-muted/45 focus:border-primary"
          >
            <span className="min-w-0 truncate">{activeLabel}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[120] max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-44 overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          >
            <DropdownMenu.Item
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm font-semibold outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
              onSelect={(event) => {
                event.preventDefault();
                toggleValue("");
              }}
            >
              <Check
                className={
                  selectedValues.length === 0
                    ? "size-4 text-primary"
                    : "size-4 text-transparent"
                }
              />
              <span className="min-w-0 truncate">{allLabel}</span>
            </DropdownMenu.Item>
            {options.map((option) => (
              <DropdownMenu.CheckboxItem
                key={`${name}-${option.value}`}
                checked={selected.has(option.value)}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm font-semibold outline-none transition hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                onCheckedChange={() => toggleValue(option.value)}
                onSelect={(event) => event.preventDefault()}
              >
                <Check
                  className={
                    selected.has(option.value)
                      ? "size-4 text-primary"
                      : "size-4 text-transparent"
                  }
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </DropdownMenu.CheckboxItem>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </label>
  );
}

function FiltersFields({
  layout = "grid",
  filters,
  options,
  preserveCountryName,
}: {
  layout?: "grid" | "stack";
  filters: ListingFiltersProps["filters"];
  options: ListingFilterOptions;
  preserveCountryName?: string;
}) {
  const selectedFeatures = new Set(filters.features || []);
  const primaryGridClass =
    layout === "stack" ? "grid gap-3" : "grid gap-3 md:grid-cols-4";
  const numberGridClass =
    layout === "stack"
      ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3"
      : "grid gap-3 md:grid-cols-4";
  const rulesGridClass =
    layout === "stack" ? "grid gap-3" : "grid gap-3 md:grid-cols-3";

  return (
    <>
      {preserveCountryName ? (
        <input type="hidden" name="countryName" value={preserveCountryName} />
      ) : null}
      <div className={primaryGridClass}>
        <SelectField
          label="Area"
          name="area"
          options={[
            { label: "All areas", value: "" },
            ...options.areas.map((area) => ({ label: area, value: area })),
          ]}
          value={fieldValue(filters, "area")}
        />
        <MultiSelectField
          allLabel="All listing types"
          label="Listing type"
          name="listingType"
          options={listingTypeOptions.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          values={fieldValues(filters, "listingType")}
        />
        <MultiSelectField
          allLabel="All property types"
          label="Property type"
          name="propertyType"
          options={propertyTypeOptions.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          values={fieldValues(filters, "propertyType")}
        />
        <SelectField
          label="Buyer badge"
          name="buyerIncentive"
          options={[
            { label: "Any buyer badge", value: "" },
            ...options.buyerIncentives.map((incentive) => ({
              label: incentive,
              value: incentive,
            })),
          ]}
          value={fieldValue(filters, "buyerIncentive")}
        />
      </div>

      <div className={numberGridClass}>
        {selectFilters.map((filter) => (
          <SelectField
            key={filter.name}
            label={filter.label}
            name={filter.name}
            options={[
              { label: "Any", value: "" },
              ...options[filter.values].map((value) => ({
                label: formatOptionLabel(filter.name, value),
                value,
              })),
            ]}
            value={fieldValue(filters, filter.name)}
          />
        ))}
      </div>

      <div className={rulesGridClass}>
        <SelectField
          label="Furnished"
          name="furnishedStatus"
          options={[
            { label: "Any", value: "" },
            { label: "Yes", value: "yes" },
            { label: "Partial", value: "partial" },
            { label: "No", value: "no" },
          ]}
          value={fieldValue(filters, "furnishedStatus")}
        />
        <SelectField
          label="Pets allowed"
          name="petsAllowed"
          options={[
            { label: "Any", value: "" },
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]}
          value={fieldValue(filters, "petsAllowed")}
        />
        <SelectField
          label="Short-let allowed"
          name="shortLetAllowed"
          options={[
            { label: "Any", value: "" },
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ]}
          value={fieldValue(filters, "shortLetAllowed")}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-xs font-black">Features</legend>
        <div className="flex flex-wrap gap-2">
          {featureOptions.map((feature) => (
            <label
              key={feature}
              className="cursor-pointer rounded-full border border-border bg-muted/45 px-3 py-2 text-xs font-black has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary"
            >
              <input
                type="checkbox"
                name="features"
                value={feature}
                defaultChecked={selectedFeatures.has(feature)}
                className="sr-only"
              />
              #{feature.replace(/\s+/g, "")}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function ListingFilters({
  action = "",
  filters,
  options,
  preserveCountryName,
  resetHref = action || "/listings",
}: ListingFiltersProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm lg:hidden">
      <Dialog.Root>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">Filters</p>
            <p className="text-xs font-semibold text-muted-foreground">
              Refine properties by type, price and details.
            </p>
          </div>
          <Dialog.Trigger asChild>
            <Button type="button" variant="outline">
              <SlidersHorizontal className="size-4" />
              Filters
            </Button>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-[91] max-h-[88dvh] overflow-y-auto rounded-t-lg border border-border bg-background p-4 text-foreground shadow-2xl outline-none">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-black">Filters</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm font-semibold text-muted-foreground">
                  Refine properties by type, price and listing details.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Close">
                  <X className="size-5" />
                </Button>
              </Dialog.Close>
            </div>
            <AutoSubmitForm action={action} className="grid gap-4">
              <FiltersFields
                filters={filters}
                options={options}
                preserveCountryName={preserveCountryName}
                layout="stack"
              />
              <div className="grid gap-2">
                <Button asChild variant="outline">
                  <a href={resetHref}>Reset</a>
                </Button>
              </div>
            </AutoSubmitForm>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export function ListingFiltersSidebar({
  action = "",
  filters,
  options,
  preserveCountryName,
  resetHref = action || "/listings",
}: ListingFiltersProps) {
  return (
    <aside className="hidden lg:block">
      <AutoSubmitForm
        action={action}
        className="sticky top-24 grid max-h-[calc(100dvh-7rem)] gap-4 overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm"
      >
        <div>
          <p className="text-sm font-black">Filters</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            Refine properties by type, price and details.
          </p>
        </div>
        <FiltersFields
          filters={filters}
          options={options}
          preserveCountryName={preserveCountryName}
          layout="stack"
        />
        <div className="grid gap-2">
          <Button asChild variant="outline">
            <a href={resetHref}>Reset</a>
          </Button>
        </div>
      </AutoSubmitForm>
    </aside>
  );
}
