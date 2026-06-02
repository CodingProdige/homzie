"use client";

import { useCurrency } from "./currency-provider";

export function CurrencyAmount({
  cents,
  compact = false,
}: {
  cents: number;
  compact?: boolean;
}) {
  const { formatPriceCents, formatPriceCentsCompact } = useCurrency();

  return compact ? formatPriceCentsCompact(cents) : formatPriceCents(cents);
}
