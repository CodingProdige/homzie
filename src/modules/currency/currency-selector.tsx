"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { supportedCurrencies } from "./currency";
import { useCurrency } from "./currency-provider";

export function CurrencySelector({ className }: { className?: string }) {
  const { currency, isUsingFallbackRates, ratesUpdatedAt, setCurrency } =
    useCurrency();
  const activeCurrency =
    supportedCurrencies.find((supportedCurrency) => supportedCurrency.code === currency) ||
    supportedCurrencies[0];
  const title = isUsingFallbackRates
    ? "Using fallback exchange rates"
    : ratesUpdatedAt
      ? `Rates updated ${ratesUpdatedAt.toLocaleDateString()}`
      : "Currency";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex h-9 min-w-24 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-black text-foreground shadow-sm outline-none transition-colors hover:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/35",
            className,
          )}
          title={title}
          aria-label="Select currency"
        >
          <span className="text-sm leading-none">{activeCurrency.flag}</span>
          <span>{activeCurrency.code}</span>
          <ChevronDown className="size-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[80] w-72 overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/20 outline-none"
        >
          <div className="px-2 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              Display currency
            </p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              Prices convert from ZAR.
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto pr-1">
            {supportedCurrencies.map((supportedCurrency) => {
              const isActive = supportedCurrency.code === currency;

              return (
                <DropdownMenu.Item
                  key={supportedCurrency.code}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm font-bold outline-none transition-colors focus:bg-accent focus:text-accent-foreground",
                    isActive && "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                  )}
                  onSelect={() => setCurrency(supportedCurrency.code)}
                >
                  <span className="text-base leading-none">{supportedCurrency.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-none">{supportedCurrency.code}</span>
                    <span
                      className={cn(
                        "mt-1 block truncate text-[11px] font-semibold leading-none text-muted-foreground",
                        isActive && "text-primary-foreground/80",
                      )}
                    >
                      {supportedCurrency.label}
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
