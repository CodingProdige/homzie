"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Building2, LockKeyhole, Mail, MapPin, UserRound } from "lucide-react";

import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkAgencyNameAvailability } from "@/modules/agencies/actions";
import type { AgencyNetworkOption } from "@/modules/agencies/server";
import { PasswordInput } from "./password-input";
import {
  registerWithEmail,
  setSessionCookiePersistence,
} from "../actions";

type AuthMode = "sign-in" | "register";

type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  types?: string[];
};

type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: {
      input: string;
      sessionToken?: unknown;
      types?: string[];
    },
    callback: (predictions: GoogleAutocompletePrediction[] | null, status: string) => void,
  ) => void;
};

type GooglePlaceDetails = {
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
  name?: string;
  place_id?: string;
  types?: string[];
};

type GooglePlacesService = {
  getDetails: (
    request: {
      fields: string[];
      placeId: string;
    },
    callback: (place: GooglePlaceDetails | null, status: string) => void,
  ) => void;
};

type GoogleWindow = Window & {
  __homzieGoogleMapsPromise?: Promise<void>;
  google?: {
    maps?: {
      places?: {
        AutocompleteService: new () => GoogleAutocompleteService;
        AutocompleteSessionToken: new () => unknown;
        PlacesService: new (attrContainer: HTMLElement) => GooglePlacesService;
        PlacesServiceStatus: {
          OK: string;
        };
      };
    };
  };
};

function loadGooglePlaces() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Places is only available in browser."));
  }

  const googleWindow = window as GoogleWindow;

  if (googleWindow.google?.maps?.places) {
    return Promise.resolve();
  }

  if (googleWindow.__homzieGoogleMapsPromise) {
    return googleWindow.__homzieGoogleMapsPromise;
  }

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return Promise.reject(new Error("Google Places is not configured."));
  }

  googleWindow.__homzieGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-homzie-google-maps="true"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load Google Places.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.homzieGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Places."));
    document.head.appendChild(script);
  });

  return googleWindow.__homzieGoogleMapsPromise;
}

function splitLocation(value: string) {
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);

  return {
    city: parts[0] || "",
    country: parts[parts.length - 1] || "",
    province: parts.length > 2 ? parts[parts.length - 2] : "",
  };
}

function addressComponent(
  place: GooglePlaceDetails,
  type: string,
  mode: "long_name" | "short_name" = "long_name",
) {
  return (
    place.address_components?.find((component) =>
      component.types.includes(type),
    )?.[mode] || ""
  );
}

function placeLocationParts(place: GooglePlaceDetails, fallback: string) {
  const fallbackParts = splitLocation(fallback);

  return {
    city:
      addressComponent(place, "locality") ||
      addressComponent(place, "postal_town") ||
      addressComponent(place, "administrative_area_level_2") ||
      fallbackParts.city,
    country: addressComponent(place, "country") || fallbackParts.country,
    province:
      addressComponent(place, "administrative_area_level_1") ||
      fallbackParts.province,
  };
}

function serializablePlaceData(
  place: GooglePlaceDetails | null,
  prediction: GoogleAutocompletePrediction,
) {
  if (!place) {
    return JSON.stringify({
      description: prediction.description,
      placeId: prediction.place_id,
      source: "autocomplete_prediction",
      structuredFormatting: prediction.structured_formatting || null,
      types: prediction.types || [],
    });
  }

  return JSON.stringify({
    addressComponents: place.address_components || [],
    description: prediction.description,
    formattedAddress: place.formatted_address || prediction.description,
    geometry: place.geometry?.location
      ? {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        }
      : null,
    name: place.name || prediction.structured_formatting?.main_text || "",
    placeId: place.place_id || prediction.place_id,
    source: "place_details",
    types: place.types || prediction.types || [],
  });
}

export function FieldLabel({
  children,
  description,
  htmlFor,
  title,
}: {
  children: React.ReactNode;
  description: string;
  htmlFor?: string;
  title: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      <AnalyticsInfoPopover title={title} description={description} />
    </span>
  );
}

export function AgencyRegionField() {
  const [region, setRegion] = useState("");
  const [regionPlaceId, setRegionPlaceId] = useState("");
  const [regionPlaceData, setRegionPlaceData] = useState("");
  const [predictions, setPredictions] = useState<GoogleAutocompletePrediction[]>([]);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!hasInteracted) return;

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      if (region.trim().length < 2) {
        setPredictions([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setPlacesError(null);

      void loadGooglePlaces()
        .then(() => {
          const places = (window as GoogleWindow).google?.maps?.places;

          if (!places) {
            throw new Error("Google Places is not available.");
          }

          const service = new places.AutocompleteService();
          const sessionToken = new places.AutocompleteSessionToken();

          service.getPlacePredictions(
            {
              input: region,
              sessionToken,
              types: ["(regions)"],
            },
            (results, status) => {
              if (!isCurrent) return;

              if (status !== places.PlacesServiceStatus.OK || !results?.length) {
                setPredictions([]);
                setIsSearching(false);
                return;
              }

              setPredictions(results.slice(0, 5));
              setIsSearching(false);
            },
          );
        })
        .catch((error: unknown) => {
          if (!isCurrent) return;

          setPlacesError(
            error instanceof Error ? error.message : "Google Places is unavailable.",
          );
          setIsSearching(false);
        });
    }, 160);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [hasInteracted, region]);

  function clearGoogleMatch() {
    setRegionPlaceId("");
    setRegionPlaceData("");
  }

  function selectRegion(option: GoogleAutocompletePrediction) {
    setIsSearching(true);

    void loadGooglePlaces()
      .then(
        () =>
          new Promise<GooglePlaceDetails | null>((resolve) => {
            const places = (window as GoogleWindow).google?.maps?.places;

            if (!places?.PlacesService) {
              resolve(null);
              return;
            }

            const service = new places.PlacesService(document.createElement("div"));

            service.getDetails(
              {
                fields: [
                  "address_components",
                  "formatted_address",
                  "geometry",
                  "name",
                  "place_id",
                  "types",
                ],
                placeId: option.place_id,
              },
              (place, status) => {
                resolve(status === places.PlacesServiceStatus.OK ? place : null);
              },
            );
          }),
      )
      .then((place) => {
        const formattedAddress = place?.formatted_address || option.description;
        const parts = placeLocationParts(place || {}, formattedAddress);
        const label = [parts.city, parts.province, parts.country]
          .filter(Boolean)
          .join(", ") || formattedAddress;

        setRegion(label);
        setRegionPlaceId(place?.place_id || option.place_id);
        setRegionPlaceData(serializablePlaceData(place, option));
        setPredictions([]);
        setPlacesError(null);
      })
      .catch((error: unknown) => {
        setPlacesError(
          error instanceof Error ? error.message : "Could not select this place.",
        );
      })
      .finally(() => setIsSearching(false));
  }

  return (
    <div className="space-y-2">
      <FieldLabel
        htmlFor="region"
        title="Region"
        description="Choose the city, province, country, or service area this workspace operates in. Select a Google suggestion so Homzie can store the location accurately."
      >
        Region
      </FieldLabel>
      <input type="hidden" name="regionPlaceId" value={regionPlaceId} />
      <input type="hidden" name="regionPlaceData" value={regionPlaceData} />
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="region"
          name="region"
          placeholder="Paarl, Western Cape, South Africa"
          className="h-12 rounded-md pl-12 text-base"
          value={region}
          onChange={(event) => {
            setRegion(event.target.value);
            setHasInteracted(true);
            clearGoogleMatch();
          }}
          onFocus={() => setHasInteracted(true)}
        />
      </div>
      {predictions.length ? (
        <div className="overflow-hidden rounded-md border border-border bg-background shadow-lg">
          {predictions.map((option) => (
            <button
              key={option.place_id}
              type="button"
              className="block w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted"
              onClick={() => selectRegion(option)}
            >
              <span className="block truncate text-sm font-semibold">
                {option.structured_formatting?.main_text || option.description}
              </span>
              <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                {option.structured_formatting?.secondary_text || "Google Places"}
              </span>
            </button>
          ))}
          <p className="px-3 py-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
            Powered by Google
          </p>
        </div>
      ) : null}
      {isSearching ? (
        <p className="text-xs font-normal text-muted-foreground">Searching places...</p>
      ) : null}
      {placesError ? (
        <p className="text-xs font-semibold text-destructive">{placesError}</p>
      ) : null}
      {region && !regionPlaceId ? (
        <p className="text-xs font-normal text-muted-foreground">
          Select a suggestion to save verified location data.
        </p>
      ) : null}
    </div>
  );
}

export function AuthForm({
  callbackUrl,
  mode,
  networkOptions = [],
}: {
  callbackUrl?: string;
  mode: AuthMode;
  networkOptions?: AgencyNetworkOption[];
}) {
  const isRegister = mode === "register";
  const [accountType, setAccountType] = useState<"personal" | "agency">("personal");
  const [agencyType, setAgencyType] = useState<"independent" | "network" | "branch">(
    "independent",
  );
  const [agencyName, setAgencyName] = useState("");
  const [agencyNameStatus, setAgencyNameStatus] = useState<{
    available: boolean;
    message: string;
    slug: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isRegister || accountType !== "agency") {
      return;
    }

    const nextName = agencyName.trim();

    if (nextName.length < 2) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void checkAgencyNameAvailability(nextName).then((status) => {
        if (!cancelled) setAgencyNameStatus(status);
      });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [accountType, agencyName, isRegister]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "");
    const agencyName = String(formData.get("agencyName") || "");
    const parentAgencyId = String(formData.get("parentAgencyId") || "");
    const branchCode = String(formData.get("branchCode") || "");
    const region = String(formData.get("region") || "");
    const regionPlaceId = String(formData.get("regionPlaceId") || "");
    const regionPlaceDataRaw = String(formData.get("regionPlaceData") || "");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const keepSignedIn = formData.get("remember") === "on";
    let regionPlaceData: unknown;

    if (regionPlaceDataRaw) {
      try {
        regionPlaceData = JSON.parse(regionPlaceDataRaw);
      } catch {
        regionPlaceData = undefined;
      }
    }

    startTransition(async () => {
      if (isRegister) {
        const registerResult = await registerWithEmail({
          accountType,
          agencyName,
          agencyType,
          branchCode,
          name,
          email,
          password,
          parentAgencyId,
          region,
          regionPlaceData,
          regionPlaceId,
        });

        if (!registerResult.ok) {
          setError(registerResult.error);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          isRegister
            ? "Account created, but sign-in failed. Please try signing in."
            : "Invalid email or password.",
        );
        return;
      }

      await setSessionCookiePersistence(keepSignedIn);

      const nextCallbackUrl = accountType === "agency" ? "/controlroom" : callbackUrl;
      const onboardingUrl = nextCallbackUrl
        ? `/onboarding/username?callbackUrl=${encodeURIComponent(nextCallbackUrl)}`
        : "/onboarding/username";

      window.location.assign(onboardingUrl);
    });
  };

  return (
    <form className="mt-10 space-y-6" onSubmit={onSubmit}>
      {isRegister ? (
        <>
          <div className="grid gap-2">
            <Label>Account type</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  icon: UserRound,
                  label: "Personal",
                  value: "personal" as const,
                },
                {
                  icon: Building2,
                  label: "Agency",
                  value: "agency" as const,
                },
              ].map((item) => {
                const Icon = item.icon;
                const selected = accountType === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    className={[
                      "flex h-12 items-center justify-center gap-2 rounded-md border text-sm font-semibold transition",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    ].join(" ")}
                    onClick={() => setAccountType(item.value)}
                    aria-pressed={selected}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                name="name"
                placeholder="Jessica van der Merwe"
                autoComplete="name"
                className="h-12 rounded-md pl-12 text-base"
                required
              />
            </div>
          </div>

          {accountType === "agency" ? (
            <>
              <div className="grid gap-2">
                <span className="flex items-center gap-1.5">
                  <Label>Agency structure</Label>
                  <AnalyticsInfoPopover
                    title="Agency structure"
                    description="Choose Independent for a single standalone agency, Network HQ for a parent brand, or Branch agency for a local office requesting affiliation to an existing Network HQ."
                  />
                </span>
                <div className="grid gap-2">
                  {[
                    {
                      description: "One agency workspace, no parent network.",
                      label: "Independent agency",
                      value: "independent" as const,
                    },
                    {
                      description: "Parent/global brand with branch rollups.",
                      label: "Network HQ",
                      value: "network" as const,
                    },
                    {
                      description: "Local office linked to a wider brand.",
                      label: "Branch agency",
                      value: "branch" as const,
                    },
                  ].map((item) => {
                    const selected = agencyType === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        className={[
                          "rounded-md border px-3 py-2 text-left transition",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        ].join(" ")}
                        onClick={() => setAgencyType(item.value)}
                        aria-pressed={selected}
                      >
                        <span className="block text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-xs font-semibold leading-5">
                          {item.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <input type="hidden" name="agencyType" value={agencyType} />

              <div className="space-y-2">
                <FieldLabel
                  htmlFor="agencyName"
                  title={agencyType === "network" ? "Network name" : "Agency name"}
                  description={
                    agencyType === "network"
                      ? "Use the parent brand name exactly as branches should recognise it."
                      : "Use the trading name buyers and agents should see on Homzie."
                  }
                >
                  {agencyType === "network" ? "Network name" : "Agency name"}
                </FieldLabel>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="agencyName"
                    name="agencyName"
                    placeholder={
                      agencyType === "network"
                        ? "Century 21 South Africa"
                        : "Century 21 Paarl"
                    }
                    autoComplete="organization"
                    className="h-12 rounded-md pl-12 text-base"
                    value={agencyName}
                    onChange={(event) => {
                      setAgencyName(event.target.value);
                      if (event.target.value.trim().length < 2) {
                        setAgencyNameStatus(null);
                      }
                    }}
                    required
                  />
                </div>
                {agencyNameStatus ? (
                  <p
                    className={[
                      "text-xs font-semibold",
                      agencyNameStatus.available
                        ? "text-emerald-700"
                        : "text-destructive",
                    ].join(" ")}
                  >
                    {agencyNameStatus.message}
                  </p>
                ) : null}
              </div>

              {agencyType === "branch" ? (
                <div className="space-y-2">
                  <FieldLabel
                    htmlFor="parentAgencyId"
                    title="Parent Network HQ"
                    description="Select the existing Network HQ this branch belongs to. Homzie sends an affiliation request to that HQ for approval."
                  >
                    Parent Network HQ
                  </FieldLabel>
                  <div className="relative">
                    <Building2 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                    <select
                      id="parentAgencyId"
                      name="parentAgencyId"
                      className="h-12 w-full appearance-none rounded-md border border-input bg-background px-12 text-base font-normal text-foreground shadow-sm outline-none transition file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                      disabled={!networkOptions.length}
                    >
                      <option value="">
                        {networkOptions.length
                          ? "Select a Network HQ"
                          : "No Network HQs available yet"}
                      </option>
                      {networkOptions.map((network) => (
                        <option key={network.id} value={network.id}>
                          {[network.label, network.region || network.location]
                            .filter(Boolean)
                            .join(" - ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!networkOptions.length ? (
                    <p className="text-xs font-normal text-muted-foreground">
                      Create the Network HQ first, then register this branch and request
                      affiliation.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {agencyType !== "network" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <AgencyRegionField />
                  {agencyType === "branch" ? (
                    <div className="space-y-2">
                      <FieldLabel
                        htmlFor="branchCode"
                        title="Branch code"
                        description="Optional internal code used by the agency or franchise network to identify this branch."
                      >
                        Branch code
                      </FieldLabel>
                      <Input
                        id="branchCode"
                        name="branchCode"
                        placeholder="PAARL-01"
                        className="h-12 rounded-md text-base"
                        maxLength={32}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="text-sm leading-6 text-muted-foreground">
                {agencyType === "network"
                  ? "We will create a parent Network HQ that branches can request to join."
                  : agencyType === "branch"
                    ? "We will create a branch workspace and send the selected Network HQ an affiliation request."
                    : "We will create your Agency HQ and make you the owner."}
              </p>
            </>
          ) : null}
        </>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="youremail@example.com"
            autoComplete="email"
            className="h-12 rounded-md pl-12 text-base"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {!isRegister ? (
            <Link href="/forgot-password" className="text-sm font-semibold text-foreground">
              Forgot password?
            </Link>
          ) : null}
        </div>
        <PasswordInput isRegister={isRegister} />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="remember"
          name="remember"
          type="checkbox"
          defaultChecked
          className="mt-1 size-4 rounded border-border"
        />
        <div>
          <Label htmlFor="remember" className="text-sm font-medium text-muted-foreground">
            {isRegister
              ? "Keep me signed in for 30 days after creating my account"
              : "Keep me signed in for 30 days"}
          </Label>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Leave unchecked to require sign-in again after this browser session.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-12 w-full [background:var(--homzie-gradient)] text-base text-white shadow-xl shadow-primary/20 hover:opacity-95"
        disabled={isPending}
      >
        <LockKeyhole className="size-4" />
        {isPending ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
