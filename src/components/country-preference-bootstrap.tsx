"use client";

import { useEffect } from "react";

import {
  countryPreferenceCookie,
  countryPreferenceStorageKey,
  encodeCountryPreference,
  parseCountryPreference,
  type CountryPreference,
} from "@/modules/location/country-preference";

const oneYearSeconds = 60 * 60 * 24 * 365;

const timezoneCountryCodes: Record<string, string> = {
  "Africa/Johannesburg": "ZA",
  "Africa/Lagos": "NG",
  "Africa/Cairo": "EG",
  "Africa/Nairobi": "KE",
  "Africa/Casablanca": "MA",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "America/Buenos_Aires": "AR",
  "Asia/Dubai": "AE",
  "Asia/Kolkata": "IN",
  "Asia/Singapore": "SG",
  "Asia/Tokyo": "JP",
  "Asia/Shanghai": "CN",
  "Australia/Brisbane": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Perth": "AU",
  "Australia/Sydney": "AU",
  "Europe/Amsterdam": "NL",
  "Europe/Berlin": "DE",
  "Europe/London": "GB",
  "Europe/Madrid": "ES",
  "Europe/Paris": "FR",
};

function persistCountryPreference(preference: CountryPreference) {
  const encoded = encodeCountryPreference(preference);

  localStorage.setItem(countryPreferenceStorageKey, encoded);
  document.cookie = `${countryPreferenceCookie}=${encoded}; path=/; max-age=${oneYearSeconds}; SameSite=Lax`;
  window.dispatchEvent(
    new CustomEvent("homzie:country-preference", { detail: preference }),
  );
}

function countryNameFromCode(countryCode: string) {
  try {
    return (
      new Intl.DisplayNames([navigator.language || "en"], { type: "region" }).of(
        countryCode,
      ) || countryCode
    );
  } catch {
    return countryCode;
  }
}

function regionFromLocale(locale: string) {
  try {
    return new Intl.Locale(locale).region || "";
  } catch {
    const match = locale.match(/[-_]([A-Z]{2}|\d{3})\b/i);

    return match?.[1]?.toUpperCase() || "";
  }
}

function inferCountryPreference() {
  const localeRegion = (navigator.languages || [navigator.language])
    .map(regionFromLocale)
    .find(Boolean);
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const countryCode =
    localeRegion || timezoneCountryCodes[timeZone] || "";

  if (!countryCode) return null;

  const country = countryNameFromCode(countryCode);

  return {
    country,
    countryCode,
    label: country,
    source: "detected",
  } satisfies CountryPreference;
}

export function CountryPreferenceBootstrap() {
  useEffect(() => {
    const stored = parseCountryPreference(
      localStorage.getItem(countryPreferenceStorageKey),
    );

    if (stored?.source === "manual") {
      persistCountryPreference(stored);
      return;
    }

    if (stored?.country || stored?.countryCode) {
      persistCountryPreference(stored);
      return;
    }

    const inferred = inferCountryPreference();

    if (inferred) {
      persistCountryPreference(inferred);
    }
  }, []);

  return null;
}
