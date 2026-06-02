export const BASE_CURRENCY = "ZAR";
export const CURRENCY_STORAGE_KEY = "homzie:selected-currency";
export const CURRENCY_RATES_STORAGE_KEY = "homzie:currency-rates";

export type SupportedCurrency =
  | "ZAR"
  | "USD"
  | "EUR"
  | "GBP"
  | "AUD"
  | "CAD"
  | "NZD"
  | "AED"
  | "INR"
  | "NGN"
  | "KES"
  | "BWP"
  | "NAD";

export const supportedCurrencies: Array<{
  code: SupportedCurrency;
  flag: string;
  label: string;
}> = [
  { code: "ZAR", flag: "🇿🇦", label: "South African rand" },
  { code: "USD", flag: "🇺🇸", label: "US dollar" },
  { code: "EUR", flag: "🇪🇺", label: "Euro" },
  { code: "GBP", flag: "🇬🇧", label: "British pound" },
  { code: "AUD", flag: "🇦🇺", label: "Australian dollar" },
  { code: "CAD", flag: "🇨🇦", label: "Canadian dollar" },
  { code: "NZD", flag: "🇳🇿", label: "New Zealand dollar" },
  { code: "AED", flag: "🇦🇪", label: "UAE dirham" },
  { code: "INR", flag: "🇮🇳", label: "Indian rupee" },
  { code: "NGN", flag: "🇳🇬", label: "Nigerian naira" },
  { code: "KES", flag: "🇰🇪", label: "Kenyan shilling" },
  { code: "BWP", flag: "🇧🇼", label: "Botswana pula" },
  { code: "NAD", flag: "🇳🇦", label: "Namibian dollar" },
];

export type CurrencyRates = Record<SupportedCurrency, number>;

export const fallbackCurrencyRates: CurrencyRates = {
  AED: 0.2,
  AUD: 0.084,
  BWP: 0.74,
  CAD: 0.075,
  EUR: 0.047,
  GBP: 0.041,
  INR: 4.72,
  KES: 7.03,
  NAD: 1,
  NGN: 76,
  NZD: 0.092,
  USD: 0.055,
  ZAR: 1,
};

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return supportedCurrencies.some((currency) => currency.code === value);
}

export function convertFromZar(
  amountZar: number,
  currency: SupportedCurrency,
  rates: CurrencyRates,
) {
  return amountZar * (rates[currency] || fallbackCurrencyRates[currency] || 1);
}

export function formatCurrencyAmount(
  amount: number,
  currency: SupportedCurrency,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(undefined, {
    currency,
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
    minimumFractionDigits: amount >= 1000 ? 0 : 0,
    style: "currency",
    ...options,
  }).format(amount);
}

export function formatZarCents(
  cents: number,
  currency: SupportedCurrency,
  rates: CurrencyRates,
  options: Intl.NumberFormatOptions = {},
) {
  const amountZar = cents / 100;
  const converted = convertFromZar(amountZar, currency, rates);

  return formatCurrencyAmount(converted, currency, options);
}

export function formatZarCentsCompact(
  cents: number,
  currency: SupportedCurrency,
  rates: CurrencyRates,
) {
  return formatZarCents(cents, currency, rates, {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
  });
}

export function formatZarPriceLabel(
  label: string | null | undefined,
  currency: SupportedCurrency,
  rates: CurrencyRates,
) {
  if (!label) return label || "";

  const match = label.match(/(from\s*)?R\s?([\d\s,]+(?:\.\d+)?)(.*)$/i);

  if (!match) return label;

  const prefix = match[1] || "";
  const value = Number(match[2].replace(/[\s,]/g, ""));
  const suffix = match[3] || "";

  if (!Number.isFinite(value)) return label;

  const converted = formatCurrencyAmount(
    convertFromZar(value, currency, rates),
    currency,
  );

  return `${prefix}${converted}${suffix}`;
}
