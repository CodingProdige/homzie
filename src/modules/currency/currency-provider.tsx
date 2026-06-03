"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CURRENCY_RATES_STORAGE_KEY,
  CURRENCY_STORAGE_KEY,
  fallbackCurrencyRates,
  formatZarCents,
  formatZarCentsCompact,
  formatZarPriceLabel,
  isSupportedCurrency,
  supportedCurrencies,
  type CurrencyRates,
  type SupportedCurrency,
} from "./currency";

type StoredRates = {
  fetchedAt: number;
  rates: CurrencyRates;
  ratesUpdatedAt?: number;
};

type CurrencyContextValue = {
  currency: SupportedCurrency;
  formatPriceCents: (cents: number) => string;
  formatPriceCentsCompact: (cents: number) => string;
  formatPriceLabel: (label: string | null | undefined) => string;
  isUsingFallbackRates: boolean;
  ratesUpdatedAt: Date | null;
  setCurrency: (currency: SupportedCurrency) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

function readStoredCurrency() {
  if (typeof window === "undefined") return "ZAR";

  const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);

  return stored && isSupportedCurrency(stored) ? stored : "ZAR";
}

function readStoredRates() {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CURRENCY_RATES_STORAGE_KEY) || "null",
    ) as StoredRates | null;

    if (!parsed?.rates || typeof parsed.fetchedAt !== "number") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function mergeRates(value: unknown) {
  if (Array.isArray(value)) {
    return value.reduce<CurrencyRates>((rates, rateRow) => {
      if (!rateRow || typeof rateRow !== "object" || Array.isArray(rateRow)) {
        return rates;
      }

      const { quote, rate } = rateRow as { quote?: unknown; rate?: unknown };

      if (
        typeof quote === "string" &&
        isSupportedCurrency(quote) &&
        typeof rate === "number" &&
        Number.isFinite(rate)
      ) {
        rates[quote] = rate;
      }

      return rates;
    }, { ...fallbackCurrencyRates });
  }

  if (!value || typeof value !== "object") {
    return fallbackCurrencyRates;
  }

  const rawRates = value as Record<string, unknown>;

  return supportedCurrencies.reduce<CurrencyRates>((rates, currency) => {
    const nextRate = rawRates[currency.code];

    rates[currency.code] =
      typeof nextRate === "number" && Number.isFinite(nextRate)
        ? nextRate
        : fallbackCurrencyRates[currency.code];

    return rates;
  }, { ...fallbackCurrencyRates });
}

function readRatesDate(value: unknown) {
  if (Array.isArray(value)) {
    const datedRow = value.find(
      (rateRow) =>
        rateRow &&
        typeof rateRow === "object" &&
        !Array.isArray(rateRow) &&
        typeof (rateRow as { date?: unknown }).date === "string",
    ) as { date?: string } | undefined;

    return datedRow?.date || null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const { date } = value as { date?: unknown };

  return typeof date === "string" ? date : null;
}

function dateFromApiDate(value: string | null, fallback: number) {
  if (!value) return new Date(fallback);

  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>("ZAR");
  const [rates, setRates] = useState<CurrencyRates>(fallbackCurrencyRates);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<Date | null>(null);
  const [isUsingFallbackRates, setIsUsingFallbackRates] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setCurrencyState(readStoredCurrency());

      const storedRates = readStoredRates();

      if (storedRates) {
        setRates(storedRates.rates);
        setRatesUpdatedAt(
          new Date(storedRates.ratesUpdatedAt || storedRates.fetchedAt),
        );
        setIsUsingFallbackRates(false);
      }

      const shouldRefresh =
        !storedRates || Date.now() - storedRates.fetchedAt > ONE_DAY_MS;

      if (!shouldRefresh) return;

      const targetCurrencies = supportedCurrencies
        .filter((supportedCurrency) => supportedCurrency.code !== "ZAR")
        .map((supportedCurrency) => supportedCurrency.code)
        .join(",");

      fetch(`https://api.frankfurter.dev/v2/rates?base=ZAR&quotes=${targetCurrencies}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: unknown) => {
          if (!payload || typeof payload !== "object") {
            return;
          }

          const rawRates = Array.isArray(payload)
            ? payload
            : (payload as { rates?: unknown }).rates;
          const nextRates = mergeRates(rawRates);
          const fetchedAt = Date.now();
          const ratesDate = dateFromApiDate(readRatesDate(payload), fetchedAt);

          setRates(nextRates);
          setRatesUpdatedAt(ratesDate);
          setIsUsingFallbackRates(false);
          window.localStorage.setItem(
            CURRENCY_RATES_STORAGE_KEY,
            JSON.stringify({
              fetchedAt,
              rates: nextRates,
              ratesUpdatedAt: ratesDate.getTime(),
            }),
          );
        })
        .catch(() => {
          setIsUsingFallbackRates(!storedRates);
        });
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const setCurrency = (nextCurrency: SupportedCurrency) => {
    setCurrencyState(nextCurrency);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency);
    }
  };

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      formatPriceCents: (cents) => formatZarCents(cents, currency, rates),
      formatPriceCentsCompact: (cents) =>
        formatZarCentsCompact(cents, currency, rates),
      formatPriceLabel: (label) => formatZarPriceLabel(label, currency, rates),
      isUsingFallbackRates,
      ratesUpdatedAt,
      setCurrency,
    }),
    [currency, isUsingFallbackRates, rates, ratesUpdatedAt],
  );

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used inside CurrencyProvider");
  }

  return context;
}
