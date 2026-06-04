export const BASE_CURRENCY = "ZAR";
export const CURRENCY_STORAGE_KEY = "homzie:selected-currency";
export const CURRENCY_SOURCE_STORAGE_KEY = "homzie:selected-currency-source";
export const CURRENCY_RATES_STORAGE_KEY = "homzie:currency-rates";

export type SupportedCurrency =
  | "AED"
  | "AUD"
  | "BGN"
  | "BRL"
  | "CAD"
  | "CHF"
  | "CZK"
  | "DKK"
  | "EUR"
  | "GBP"
  | "GHS"
  | "HKD"
  | "HUF"
  | "IDR"
  | "INR"
  | "JPY"
  | "KES"
  | "MXN"
  | "MYR"
  | "NGN"
  | "NOK"
  | "NZD"
  | "PLN"
  | "RON"
  | "SEK"
  | "SGD"
  | "THB"
  | "USD"
  | "XOF"
  | "ZAR";

export const supportedCurrencies: Array<{
  code: SupportedCurrency;
  flag: string;
  label: string;
}> = [
  { code: "AED", flag: "🇦🇪", label: "UAE dirham" },
  { code: "AUD", flag: "🇦🇺", label: "Australian dollar" },
  { code: "BGN", flag: "🇧🇬", label: "Bulgarian lev" },
  { code: "BRL", flag: "🇧🇷", label: "Brazilian real" },
  { code: "CAD", flag: "🇨🇦", label: "Canadian dollar" },
  { code: "CHF", flag: "🇨🇭", label: "Swiss franc" },
  { code: "CZK", flag: "🇨🇿", label: "Czech koruna" },
  { code: "DKK", flag: "🇩🇰", label: "Danish krone" },
  { code: "EUR", flag: "🇪🇺", label: "Euro" },
  { code: "GBP", flag: "🇬🇧", label: "British pound" },
  { code: "GHS", flag: "🇬🇭", label: "Ghanaian cedi" },
  { code: "HKD", flag: "🇭🇰", label: "Hong Kong dollar" },
  { code: "HUF", flag: "🇭🇺", label: "Hungarian forint" },
  { code: "IDR", flag: "🇮🇩", label: "Indonesian rupiah" },
  { code: "INR", flag: "🇮🇳", label: "Indian rupee" },
  { code: "JPY", flag: "🇯🇵", label: "Japanese yen" },
  { code: "KES", flag: "🇰🇪", label: "Kenyan shilling" },
  { code: "MXN", flag: "🇲🇽", label: "Mexican peso" },
  { code: "MYR", flag: "🇲🇾", label: "Malaysian ringgit" },
  { code: "NGN", flag: "🇳🇬", label: "Nigerian naira" },
  { code: "NOK", flag: "🇳🇴", label: "Norwegian krone" },
  { code: "NZD", flag: "🇳🇿", label: "New Zealand dollar" },
  { code: "PLN", flag: "🇵🇱", label: "Polish zloty" },
  { code: "RON", flag: "🇷🇴", label: "Romanian leu" },
  { code: "SEK", flag: "🇸🇪", label: "Swedish krona" },
  { code: "SGD", flag: "🇸🇬", label: "Singapore dollar" },
  { code: "THB", flag: "🇹🇭", label: "Thai baht" },
  { code: "USD", flag: "🇺🇸", label: "US dollar" },
  { code: "XOF", flag: "🇨🇮", label: "West African CFA franc" },
  { code: "ZAR", flag: "🇿🇦", label: "South African rand" },
];

export type CurrencyRates = Record<SupportedCurrency, number>;

export const fallbackCurrencyRates: CurrencyRates = {
  AED: 0.2,
  AUD: 0.084,
  BGN: 0.092,
  BRL: 0.29,
  CAD: 0.075,
  CHF: 0.045,
  CZK: 1.15,
  DKK: 0.35,
  EUR: 0.047,
  GBP: 0.041,
  GHS: 0.72,
  HKD: 0.43,
  HUF: 18.5,
  IDR: 880,
  INR: 4.72,
  JPY: 8.4,
  KES: 7.03,
  MXN: 1.02,
  MYR: 0.26,
  NGN: 76,
  NOK: 0.56,
  NZD: 0.092,
  PLN: 0.2,
  RON: 0.23,
  SEK: 0.53,
  SGD: 0.071,
  THB: 1.8,
  USD: 0.055,
  XOF: 31,
  ZAR: 1,
};

export function currencyForCountryCode(countryCode?: string | null) {
  switch ((countryCode || "").toUpperCase()) {
    case "ZA":
      return "ZAR";
    case "US":
      return "USD";
    case "GB":
    case "GI":
      return "GBP";
    case "AU":
      return "AUD";
    case "CA":
      return "CAD";
    case "NZ":
      return "NZD";
    case "AE":
      return "AED";
    case "BR":
      return "BRL";
    case "BG":
      return "BGN";
    case "IN":
      return "INR";
    case "ID":
      return "IDR";
    case "NG":
      return "NGN";
    case "KE":
      return "KES";
    case "CI":
      return "XOF";
    case "GH":
      return "GHS";
    case "HK":
      return "HKD";
    case "CZ":
      return "CZK";
    case "DK":
      return "DKK";
    case "HU":
      return "HUF";
    case "JP":
      return "JPY";
    case "MY":
      return "MYR";
    case "MX":
      return "MXN";
    case "NO":
      return "NOK";
    case "PL":
      return "PLN";
    case "RO":
      return "RON";
    case "SG":
      return "SGD";
    case "SE":
      return "SEK";
    case "CH":
    case "LI":
      return "CHF";
    case "TH":
      return "THB";
    case "AT":
    case "BE":
    case "CY":
    case "DE":
    case "EE":
    case "ES":
    case "FI":
    case "FR":
    case "GR":
    case "HR":
    case "IE":
    case "IT":
    case "LT":
    case "LU":
    case "LV":
    case "MT":
    case "NL":
    case "PT":
    case "SI":
    case "SK":
      return "EUR";
    default:
      return null;
  }
}

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

export function convertToZar(
  amount: number,
  currency: SupportedCurrency,
  rates: CurrencyRates,
) {
  const rate = rates[currency] || fallbackCurrencyRates[currency] || 1;

  return amount / rate;
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
