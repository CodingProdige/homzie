export const countryPreferenceCookie = "homzie_country";
export const countryPreferenceStorageKey = "homzie.countryPreference";
export const countryPreferenceMaxAgeSeconds = 60 * 60 * 24 * 365;

export type CountryPreference = {
  country?: string;
  countryCode?: string;
  label?: string;
  source?: "detected" | "manual";
};

export const countryPreferenceOptions: Array<{
  country: string;
  countryCode: string;
  currency: string;
  flag: string;
}> = [
  { country: "Australia", countryCode: "AU", currency: "AUD", flag: "🇦🇺" },
  { country: "Austria", countryCode: "AT", currency: "EUR", flag: "🇦🇹" },
  { country: "Belgium", countryCode: "BE", currency: "EUR", flag: "🇧🇪" },
  { country: "Brazil", countryCode: "BR", currency: "BRL", flag: "🇧🇷" },
  { country: "Bulgaria", countryCode: "BG", currency: "BGN", flag: "🇧🇬" },
  { country: "Canada", countryCode: "CA", currency: "CAD", flag: "🇨🇦" },
  { country: "Côte d'Ivoire", countryCode: "CI", currency: "XOF", flag: "🇨🇮" },
  { country: "Croatia", countryCode: "HR", currency: "EUR", flag: "🇭🇷" },
  { country: "Cyprus", countryCode: "CY", currency: "EUR", flag: "🇨🇾" },
  { country: "Czech Republic", countryCode: "CZ", currency: "CZK", flag: "🇨🇿" },
  { country: "Denmark", countryCode: "DK", currency: "DKK", flag: "🇩🇰" },
  { country: "Estonia", countryCode: "EE", currency: "EUR", flag: "🇪🇪" },
  { country: "Finland", countryCode: "FI", currency: "EUR", flag: "🇫🇮" },
  { country: "France", countryCode: "FR", currency: "EUR", flag: "🇫🇷" },
  { country: "Germany", countryCode: "DE", currency: "EUR", flag: "🇩🇪" },
  { country: "Ghana", countryCode: "GH", currency: "GHS", flag: "🇬🇭" },
  { country: "Gibraltar", countryCode: "GI", currency: "GBP", flag: "🇬🇮" },
  { country: "Greece", countryCode: "GR", currency: "EUR", flag: "🇬🇷" },
  { country: "Hong Kong", countryCode: "HK", currency: "HKD", flag: "🇭🇰" },
  { country: "Hungary", countryCode: "HU", currency: "HUF", flag: "🇭🇺" },
  { country: "India", countryCode: "IN", currency: "INR", flag: "🇮🇳" },
  { country: "Indonesia", countryCode: "ID", currency: "IDR", flag: "🇮🇩" },
  { country: "Ireland", countryCode: "IE", currency: "EUR", flag: "🇮🇪" },
  { country: "Italy", countryCode: "IT", currency: "EUR", flag: "🇮🇹" },
  { country: "Japan", countryCode: "JP", currency: "JPY", flag: "🇯🇵" },
  { country: "Kenya", countryCode: "KE", currency: "KES", flag: "🇰🇪" },
  { country: "Latvia", countryCode: "LV", currency: "EUR", flag: "🇱🇻" },
  { country: "Liechtenstein", countryCode: "LI", currency: "CHF", flag: "🇱🇮" },
  { country: "Lithuania", countryCode: "LT", currency: "EUR", flag: "🇱🇹" },
  { country: "Luxembourg", countryCode: "LU", currency: "EUR", flag: "🇱🇺" },
  { country: "Malaysia", countryCode: "MY", currency: "MYR", flag: "🇲🇾" },
  { country: "Malta", countryCode: "MT", currency: "EUR", flag: "🇲🇹" },
  { country: "Mexico", countryCode: "MX", currency: "MXN", flag: "🇲🇽" },
  { country: "Netherlands", countryCode: "NL", currency: "EUR", flag: "🇳🇱" },
  { country: "New Zealand", countryCode: "NZ", currency: "NZD", flag: "🇳🇿" },
  { country: "Nigeria", countryCode: "NG", currency: "NGN", flag: "🇳🇬" },
  { country: "Norway", countryCode: "NO", currency: "NOK", flag: "🇳🇴" },
  { country: "Poland", countryCode: "PL", currency: "PLN", flag: "🇵🇱" },
  { country: "Portugal", countryCode: "PT", currency: "EUR", flag: "🇵🇹" },
  { country: "Romania", countryCode: "RO", currency: "RON", flag: "🇷🇴" },
  { country: "Singapore", countryCode: "SG", currency: "SGD", flag: "🇸🇬" },
  { country: "Slovakia", countryCode: "SK", currency: "EUR", flag: "🇸🇰" },
  { country: "Slovenia", countryCode: "SI", currency: "EUR", flag: "🇸🇮" },
  { country: "South Africa", countryCode: "ZA", currency: "ZAR", flag: "🇿🇦" },
  { country: "Spain", countryCode: "ES", currency: "EUR", flag: "🇪🇸" },
  { country: "Sweden", countryCode: "SE", currency: "SEK", flag: "🇸🇪" },
  { country: "Switzerland", countryCode: "CH", currency: "CHF", flag: "🇨🇭" },
  { country: "Thailand", countryCode: "TH", currency: "THB", flag: "🇹🇭" },
  { country: "United Arab Emirates", countryCode: "AE", currency: "AED", flag: "🇦🇪" },
  { country: "United Kingdom", countryCode: "GB", currency: "GBP", flag: "🇬🇧" },
  { country: "United States", countryCode: "US", currency: "USD", flag: "🇺🇸" },
];

export function encodeCountryPreference(preference: CountryPreference) {
  return encodeURIComponent(JSON.stringify(preference));
}

export function persistCountryPreference(preference: CountryPreference) {
  if (typeof window === "undefined") return;

  const encoded = encodeCountryPreference(preference);

  localStorage.setItem(countryPreferenceStorageKey, encoded);
  document.cookie = `${countryPreferenceCookie}=${encoded}; path=/; max-age=${countryPreferenceMaxAgeSeconds}; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent("homzie:country-preference", { detail: preference }),
  );
}

export function parseCountryPreference(value?: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as CountryPreference;

    if (!parsed || typeof parsed !== "object") return null;

    const country = typeof parsed.country === "string" ? parsed.country.trim() : "";
    const countryCode =
      typeof parsed.countryCode === "string" ? parsed.countryCode.trim().toUpperCase() : "";
    const label = typeof parsed.label === "string" ? parsed.label.trim() : country;

    if (!country && !countryCode && !label) return null;

    return {
      country: country || label || undefined,
      countryCode: countryCode || undefined,
      label: label || country || countryCode || undefined,
      source: parsed.source === "manual" ? "manual" : "detected",
    } satisfies CountryPreference;
  } catch {
    return null;
  }
}

export function appendCountryPreference(
  href: string,
  preference?: CountryPreference | null,
) {
  if (!preference?.country && !preference?.countryCode) return href;

  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);

  if (preference.countryCode) {
    params.set("country", preference.countryCode);
  }

  if (preference.country) {
    params.set("countryName", preference.country);
  }

  const queryString = params.toString();

  return queryString ? `${path}?${queryString}` : path;
}

export function locationMatchesCountry(
  location: string | null | undefined,
  preference?: CountryPreference | null,
) {
  if (!location || !preference) return false;

  const normalizedLocation = location.toLowerCase();
  const country = preference.country?.toLowerCase();
  const label = preference.label?.toLowerCase();

  return Boolean(
    (country && normalizedLocation.includes(country)) ||
      (label && normalizedLocation.includes(label)),
  );
}

export function countryOptionForName(value?: string | null) {
  const normalized = (value || "").trim().toLowerCase();

  if (!normalized) return null;

  return (
    countryPreferenceOptions.find(
      (option) => option.country.toLowerCase() === normalized,
    ) || null
  );
}

export function countryOptionForCode(value?: string | null) {
  const normalized = (value || "").trim().toUpperCase();

  if (!normalized) return null;

  return (
    countryPreferenceOptions.find((option) => option.countryCode === normalized) ||
    null
  );
}

export function countryOptionFromLocation(value?: string | null) {
  const normalized = (value || "").toLowerCase();

  if (!normalized) return null;

  return (
    countryPreferenceOptions.find((option) =>
      normalized.includes(option.country.toLowerCase()),
    ) || null
  );
}

export function countryFlagFromLocation(value?: string | null) {
  return countryOptionFromLocation(value)?.flag || "";
}
