"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  countryPreferenceOptions,
  countryPreferenceStorageKey,
  parseCountryPreference,
  persistCountryPreference,
  type CountryPreference,
} from "@/modules/location/country-preference";

function optionForPreference(preference: CountryPreference | null) {
  return countryPreferenceOptions.find(
    (option) => option.countryCode === preference?.countryCode,
  );
}

function readPreference() {
  if (typeof window === "undefined") return null;

  return parseCountryPreference(
    window.localStorage.getItem(countryPreferenceStorageKey),
  );
}

export function CountryPreferenceSelector({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [preference, setPreference] = useState<CountryPreference | null>(null);
  const activeOption = optionForPreference(preference);

  useEffect(() => {
    const timeout = window.setTimeout(() => setPreference(readPreference()), 0);

    function handleCountryPreference(event: Event) {
      setPreference((event as CustomEvent<CountryPreference>).detail);
    }

    window.addEventListener(
      "homzie:country-preference",
      handleCountryPreference,
    );

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener(
        "homzie:country-preference",
        handleCountryPreference,
      );
    };
  }, []);

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex h-9 items-center justify-center rounded-full border border-border bg-background text-xs font-black text-foreground shadow-sm outline-none transition-colors hover:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/35",
            compact ? "min-w-0 gap-1 px-2" : "min-w-24 gap-1.5 px-3",
            className,
          )}
          aria-label="Select country"
          title="Select country"
        >
          <span className="text-sm leading-none">
            {activeOption?.flag || <Globe2 className="size-4" />}
          </span>
          <span>{activeOption?.countryCode || "Country"}</span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[120] w-72 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/20 outline-none"
        >
          <div className="px-2 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Search country
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Used for discovery defaults and currency auto-selection.
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto pr-1">
            {countryPreferenceOptions.map((option) => {
              const isActive = option.countryCode === activeOption?.countryCode;

              return (
                <DropdownMenu.Item
                  key={option.countryCode}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm font-bold outline-none transition-colors focus:bg-accent focus:text-accent-foreground",
                    isActive &&
                      "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  )}
                  onSelect={() => {
                    persistCountryPreference({
                      country: option.country,
                      countryCode: option.countryCode,
                      label: option.country,
                      source: "manual",
                    });
                    router.refresh();
                  }}
                >
                  <span className="text-base leading-none">{option.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-none">{option.country}</span>
                    <span
                      className={cn(
                        "mt-1 block truncate text-[11px] font-semibold leading-none text-muted-foreground",
                        isActive && "text-primary-foreground/80",
                      )}
                    >
                      {option.countryCode} · {option.currency}
                    </span>
                  </span>
                  {isActive ? <Check className="size-4 shrink-0" /> : null}
                </DropdownMenu.Item>
              );
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
