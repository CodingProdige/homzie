export const countryPreferenceCookie = "homzie_country";
export const countryPreferenceStorageKey = "homzie.countryPreference";

export type CountryPreference = {
  country?: string;
  countryCode?: string;
  label?: string;
  source?: "detected" | "manual";
};

export function encodeCountryPreference(preference: CountryPreference) {
  return encodeURIComponent(JSON.stringify(preference));
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
