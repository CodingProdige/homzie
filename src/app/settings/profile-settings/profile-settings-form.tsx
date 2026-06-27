"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import {
  AtSign,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  MapPin,
  Save,
  X,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { UsernameAvailability } from "@/modules/auth/actions";
import { normalizeUsername } from "@/modules/auth/username";
import {
  profileRoleOptions,
  profileRoleSentenceLabel,
  type ProfileRole,
} from "@/modules/users/profile-role";
import { SettingsPageHeader } from "../settings-page-header";
import {
  checkProfileUsernameAvailability,
  type ProfileSettingsState,
  updateProfileSettings,
} from "./actions";

type ProfileSettingsFormProps = {
  initialProfile: {
    avatarUrl: string | null;
    bio: string;
    contactEmail: string;
    contactPhone: string;
    initials: string;
    location: string;
    locationCity: string;
    locationCountry: string;
    locationPlaceData: string;
    locationPlaceId: string;
    locationProvince: string;
    locationSuburb: string;
    name: string;
    publicContactVisible: boolean;
    profileRole: ProfileRole;
    username: string;
    whatsappNumber: string;
  };
};

const initialState: ProfileSettingsState = {
  message: "",
  ok: false,
};

const phoneCountries = [
  { code: "ZA", dialCode: "+27", flag: "🇿🇦", label: "South Africa" },
  { code: "US", dialCode: "+1", flag: "🇺🇸", label: "United States" },
  { code: "GB", dialCode: "+44", flag: "🇬🇧", label: "United Kingdom" },
  { code: "AE", dialCode: "+971", flag: "🇦🇪", label: "United Arab Emirates" },
  { code: "AU", dialCode: "+61", flag: "🇦🇺", label: "Australia" },
  { code: "DE", dialCode: "+49", flag: "🇩🇪", label: "Germany" },
  { code: "NL", dialCode: "+31", flag: "🇳🇱", label: "Netherlands" },
] as const;

type PhoneCountry = (typeof phoneCountries)[number];

const defaultPhoneCountry = phoneCountries[0];

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function sanitizeNationalNumber(value: string, country: PhoneCountry) {
  let digits = digitsOnly(value);
  const dialDigits = digitsOnly(country.dialCode);

  if (digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }

  if (country.code === "ZA") {
    digits = digits.replace(/^0+/, "");
  }

  return digits;
}

function toInternationalPhone(country: PhoneCountry, nationalNumber: string) {
  const sanitized = sanitizeNationalNumber(nationalNumber, country);

  return sanitized ? `${country.dialCode}${sanitized}` : "";
}

function splitInternationalPhone(value: string) {
  const compactValue = value.replace(/\s/g, "");
  const match = phoneCountries.find((country) =>
    compactValue.startsWith(country.dialCode),
  );
  const country = match || defaultPhoneCountry;
  const nationalNumber = match
    ? compactValue.slice(country.dialCode.length)
    : value;

  return {
    country,
    nationalNumber: sanitizeNationalNumber(nationalNumber, country),
  };
}

const googleMapsScriptId = "homzie-google-maps-places";

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
    callback: (
      predictions: GoogleAutocompletePrediction[] | null,
      status: string,
    ) => void,
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
      sessionToken?: unknown;
    },
    callback: (place: GooglePlaceDetails | null, status: string) => void,
  ) => void;
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

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return Promise.reject(new Error("Google Places is not configured."));
  }

  googleWindow.__homzieGoogleMapsPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(googleMapsScriptId);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Could not load Google Places.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = googleMapsScriptId;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Places."));
    document.head.appendChild(script);
  });

  return googleWindow.__homzieGoogleMapsPromise;
}

function splitLocation(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    city:
      parts.length > 4
        ? parts[parts.length - 3] || ""
        : parts.length > 1
          ? parts[parts.length - 2] || ""
          : "",
    country: parts[parts.length - 1] || "",
    province: parts.length > 4 ? parts[parts.length - 2] || "" : "",
    suburb: parts.length > 2 ? parts[parts.length - 3] || "" : "",
  };
}

function displayCityLabel(parts: {
  city: string;
  country: string;
  province: string;
}) {
  return [parts.city, parts.province, parts.country].filter(Boolean).join(", ");
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
    suburb:
      addressComponent(place, "sublocality") ||
      addressComponent(place, "sublocality_level_1") ||
      addressComponent(place, "neighborhood") ||
      fallbackParts.suburb,
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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full min-w-0 px-3 sm:w-auto sm:min-w-32"
      disabled={disabled || pending}
    >
      <Save className="size-4" />
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}

function HeaderActions({
  disabled,
  state,
}: {
  disabled: boolean;
  state: ProfileSettingsState;
}) {
  return (
    <SettingsPageHeader
      className="lg:col-span-2"
      title="Profile settings"
      message={state.message || undefined}
      messageTone={state.ok ? "success" : "error"}
      actions={
        <SubmitButton disabled={disabled} />
      }
    />
  );
}

function Field({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      {children}
      {description ? (
        <span className="text-xs font-medium leading-5 text-muted-foreground">
          {description}
        </span>
      ) : null}
    </label>
  );
}

function UsernameField({
  availability,
  pendingUsername,
  setUsername,
  username,
}: {
  availability: UsernameAvailability;
  pendingUsername: string | null;
  setUsername: (value: string) => void;
  username: string;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold">Username</span>
      <div className="relative">
        <AtSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="username"
          value={username}
          onChange={(event) => setUsername(normalizeUsername(event.target.value))}
          maxLength={30}
          required
          className="pl-10 pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          {pendingUsername ? (
            <span className="block size-4 animate-pulse rounded-full bg-muted-foreground/35" />
          ) : availability.status === "available" ? (
            <CheckCircle2 className="size-4 text-emerald-600" />
          ) : availability.status === "taken" || availability.status === "invalid" ? (
            <XCircle className="size-4 text-destructive" />
          ) : null}
        </span>
      </div>
      <div className="min-h-10 text-xs font-medium leading-5">
        {pendingUsername ? (
          <p className="text-muted-foreground">Checking username...</p>
        ) : availability.status === "available" ? (
          <p className="flex items-center gap-2 text-emerald-600">
            <CheckCircle2 className="size-4" />
            {availability.message}
          </p>
        ) : availability.status === "taken" || availability.status === "invalid" ? (
          <p className="flex items-start gap-2 text-destructive">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            {availability.message}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Your public URL changes if you update this handle.
          </p>
        )}
      </div>
    </div>
  );
}

function LocationField({
  location,
  locationCity,
  locationCountry,
  locationPlaceId,
  locationProvince,
  setLocationCity,
  setLocationCountry,
  setLocation,
  setLocationPlaceData,
  setLocationPlaceId,
  setLocationProvince,
  setLocationSuburb,
}: {
  location: string;
  locationCity: string;
  locationCountry: string;
  locationPlaceId: string;
  locationProvince: string;
  setLocationCity: (value: string) => void;
  setLocationCountry: (value: string) => void;
  setLocation: (value: string) => void;
  setLocationPlaceData: (value: string) => void;
  setLocationPlaceId: (value: string) => void;
  setLocationProvince: (value: string) => void;
  setLocationSuburb: (value: string) => void;
}) {
  const [predictions, setPredictions] = useState<GoogleAutocompletePrediction[]>([]);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const hasGoogleSelection = Boolean(
    locationCity.trim() &&
      locationCountry.trim() &&
      locationPlaceId.trim() &&
      locationProvince.trim(),
  );

  useEffect(() => {
    if (!hasInteracted) {
      return;
    }

    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      if (location.trim().length < 2) {
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
              input: location,
              sessionToken,
              types: ["(cities)"],
            },
            (results, status) => {
              if (!isCurrent) return;

              const cityResults = (results || []).filter((result) => {
                const types = result.types || [];

                return (
                  types.includes("locality") ||
                  types.includes("postal_town") ||
                  types.includes("administrative_area_level_2") ||
                  types.includes("administrative_area_level_3")
                );
              });

              if (status !== places.PlacesServiceStatus.OK || !cityResults.length) {
                setPredictions([]);
                setIsSearching(false);
                return;
              }

              setPredictions(cityResults.slice(0, 5));
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
    }, 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [hasInteracted, location]);

  function setLocationParts(parts: {
    city: string;
    country: string;
    province: string;
    suburb: string;
  }) {
    setLocationCity(parts.city);
    setLocationCountry(parts.country);
    setLocationProvince(parts.province);
    setLocationSuburb(parts.suburb);
  }

  function clearGoogleMatch() {
    setLocationPlaceId("");
    setLocationPlaceData("");
    setLocationCountry("");
    setLocationProvince("");
  }

  function selectLocation(option: GoogleAutocompletePrediction) {
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
        const city = parts.city || option.structured_formatting?.main_text || formattedAddress;

        if (!parts.country || !parts.province) {
          throw new Error("Choose a city suggestion with province and country data.");
        }

        setLocation(city);
        setLocationPlaceId(place?.place_id || option.place_id);
        setLocationPlaceData(serializablePlaceData(place, option));
        setLocationParts({
          ...parts,
          city,
          suburb: "",
        });
        setPredictions([]);
        setPlacesError(null);
        setHasInteracted(false);
      })
      .catch((error: unknown) => {
        clearGoogleMatch();
        setPredictions([]);
        setPlacesError(
          error instanceof Error
            ? error.message
            : "Could not load full place details.",
        );
        setHasInteracted(false);
      })
      .finally(() => setIsSearching(false));
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold">Operating city</span>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="location"
          value={location}
          onChange={(event) => {
            const value = event.target.value;
            setHasInteracted(true);
            setLocation(value);
            setLocationParts({
              city: value,
              country: "",
              province: "",
              suburb: "",
            });
            clearGoogleMatch();
          }}
          maxLength={120}
          placeholder="Start typing your operating city"
          autoComplete="address-level2"
          className="pl-10"
        />
      </div>
      <p className="text-xs font-medium leading-5 text-muted-foreground">
        Choose the city you operate from. Homzie stores province and country from
        the selected city when available.
      </p>
      {locationCity || locationProvince || locationCountry ? (
        <p
          className={cn(
            "rounded-md px-3 py-2 text-xs font-semibold",
            hasGoogleSelection
              ? "bg-muted text-muted-foreground"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {hasGoogleSelection ? "Selected city" : "Select a Google city suggestion"}:{" "}
          {displayCityLabel({
            city: locationCity || location,
            country: locationCountry,
            province: locationProvince,
          }) || location}
        </p>
      ) : null}
      {placesError ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs font-normal text-muted-foreground">
          {placesError}
        </p>
      ) : null}
      {predictions.length || isSearching ? (
        <div className="rounded-lg border border-border bg-muted/40 p-2">
          {predictions.map((option) => (
            <button
              key={option.place_id}
              type="button"
              className="flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-white"
              onClick={() => selectLocation(option)}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-semibold">
                  {option.structured_formatting?.main_text || option.description}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {option.structured_formatting?.secondary_text || "Google Places"}
                </span>
              </span>
            </button>
          ))}
          {isSearching ? (
            <p className="px-3 py-2 text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Searching cities
            </p>
          ) : null}
          <p className="px-3 pb-1 pt-2 text-right text-[9px] font-normal uppercase tracking-[0.35em] text-muted-foreground">
            Powered by Google
          </p>
        </div>
      ) : null}
      <input type="hidden" name="locationCity" value={locationCity || location} />
      <input type="hidden" name="locationProvince" value={locationProvince} />
      <input type="hidden" name="locationCountry" value={locationCountry} />
      <input type="hidden" name="locationSuburb" value="" />
      <input
        type="hidden"
        name="locationGoogleSelected"
        value={hasGoogleSelection ? "on" : ""}
      />
    </div>
  );
}

function PhoneField({
  label,
  name,
  setValue,
  value,
}: {
  label: string;
  name: string;
  setValue: (value: string) => void;
  value: string;
}) {
  const parsed = splitInternationalPhone(value);
  const [countryCode, setCountryCode] = useState<PhoneCountry["code"]>(
    parsed.country.code,
  );
  const country =
    phoneCountries.find((option) => option.code === countryCode) ||
    defaultPhoneCountry;
  const nationalNumber = splitInternationalPhone(value).nationalNumber;
  const normalizedValue = toInternationalPhone(country, nationalNumber);

  useEffect(() => {
    if (!value || value === normalizedValue) return;

    const timeout = window.setTimeout(() => setValue(normalizedValue), 0);

    return () => window.clearTimeout(timeout);
  }, [normalizedValue, setValue, value]);

  function updateNumber(nextCountry: PhoneCountry, nextNationalNumber: string) {
    setValue(toInternationalPhone(nextCountry, nextNationalNumber));
  }

  return (
    <div className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex min-w-0 overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <select
          value={country.code}
          onChange={(event) => {
            const nextCountry =
              phoneCountries.find((option) => option.code === event.target.value) ||
              defaultPhoneCountry;
            setCountryCode(nextCountry.code);
            updateNumber(nextCountry, nationalNumber);
          }}
          aria-label={`${label} country prefix`}
          className="h-9 w-[6.75rem] shrink-0 border-r border-input bg-background px-2 text-sm font-bold outline-none sm:w-[7.5rem] sm:px-3"
        >
          {phoneCountries.map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.dialCode}
            </option>
          ))}
        </select>
        <input
          value={nationalNumber}
          onChange={(event) => updateNumber(country, event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder={country.code === "ZA" ? "82 123 4567" : "Phone number"}
          className="h-9 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground md:text-sm"
        />
      </div>
      <input type="hidden" name={name} value={normalizedValue} />
      <span className="text-xs font-medium leading-5 text-muted-foreground">
        Saved as {normalizedValue || `${country.dialCode}...`}
      </span>
    </div>
  );
}

function PreviewAvatar({
  avatarUrl,
  initials,
  name,
}: {
  avatarUrl: string | null;
  initials: string;
  name: string;
}) {
  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-1 sm:size-28 lg:size-32">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Stored avatars may be local media paths and unsaved previews.
        <img
          src={avatarUrl}
          alt={name}
          className="size-full rounded-full border-4 border-background object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full border-4 border-background bg-brand-midnight text-3xl font-bold text-white sm:text-4xl">
          {initials || "H"}
        </div>
      )}
    </div>
  );
}

export function ProfileSettingsForm({
  initialProfile,
}: ProfileSettingsFormProps) {
  const [state, formAction] = useActionState(updateProfileSettings, initialState);
  const [name, setName] = useState(initialProfile.name);
  const [username, setUsername] = useState(initialProfile.username);
  const [bio, setBio] = useState(initialProfile.bio);
  const [location, setLocation] = useState(initialProfile.location);
  const [locationCity, setLocationCity] = useState(initialProfile.locationCity);
  const [locationCountry, setLocationCountry] = useState(
    initialProfile.locationCountry,
  );
  const [locationPlaceData, setLocationPlaceData] = useState(
    initialProfile.locationPlaceData,
  );
  const [locationPlaceId, setLocationPlaceId] = useState(
    initialProfile.locationPlaceId,
  );
  const [locationProvince, setLocationProvince] = useState(
    initialProfile.locationProvince,
  );
  const [locationSuburb, setLocationSuburb] = useState(
    initialProfile.locationSuburb,
  );
  const [contactEmail, setContactEmail] = useState(initialProfile.contactEmail);
  const [contactPhone, setContactPhone] = useState(initialProfile.contactPhone);
  const [whatsappNumber, setWhatsappNumber] = useState(
    initialProfile.whatsappNumber,
  );
  const [publicContactVisible, setPublicContactVisible] = useState(
    initialProfile.publicContactVisible,
  );
  const [profileRole, setProfileRole] = useState<ProfileRole>(
    initialProfile.profileRole,
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initialProfile.avatarUrl,
  );
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [availability, setAvailability] = useState<UsernameAvailability>({
    status: "available",
    username: initialProfile.username,
    message: "Username is available.",
  });

  useEffect(() => {
    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      if (username === initialProfile.username) {
        setPendingUsername(null);
        setAvailability({
          status: "available",
          username,
          message: "Username is available.",
        });
        return;
      }

      if (!username) {
        setPendingUsername(null);
        setAvailability({ status: "empty", username: "" });
        return;
      }

      setPendingUsername(username);

      checkProfileUsernameAvailability(username)
        .then((result) => {
          if (isCurrent) {
            setAvailability(result);
            setPendingUsername(null);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setAvailability({
              status: "invalid",
              username,
              message: "Could not check username right now.",
            });
            setPendingUsername(null);
          }
        });
    }, username && username !== initialProfile.username ? 350 : 0);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [initialProfile.username, username]);

  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || initialProfile.initials,
    [initialProfile.initials, name],
  );
  const hasChanges =
    avatarChanged ||
    name !== initialProfile.name ||
    username !== initialProfile.username ||
    bio !== initialProfile.bio ||
    location !== initialProfile.location ||
    locationCity !== initialProfile.locationCity ||
    locationCountry !== initialProfile.locationCountry ||
    locationPlaceData !== initialProfile.locationPlaceData ||
    locationPlaceId !== initialProfile.locationPlaceId ||
    locationProvince !== initialProfile.locationProvince ||
    locationSuburb !== initialProfile.locationSuburb ||
    contactEmail !== initialProfile.contactEmail ||
    contactPhone !== initialProfile.contactPhone ||
    whatsappNumber !== initialProfile.whatsappNumber ||
    publicContactVisible !== initialProfile.publicContactVisible ||
    profileRole !== initialProfile.profileRole;
  const usernameReady =
    username === initialProfile.username ||
    (availability.status === "available" && !pendingUsername);
  const hasLocationInput = Boolean(
    location.trim() ||
      locationCity.trim() ||
      locationCountry.trim() ||
      locationPlaceData.trim() ||
      locationPlaceId.trim() ||
      locationProvince.trim(),
  );
  const locationReady =
    !hasLocationInput ||
    Boolean(
      location.trim() &&
        locationCity.trim() &&
        locationCountry.trim() &&
        locationPlaceData.trim() &&
        locationPlaceId.trim() &&
        locationProvince.trim(),
    );

  return (
    <form
      action={formAction}
      className="flex w-full min-w-0 max-w-none flex-col gap-6"
    >
      <HeaderActions
        disabled={!hasChanges || !usernameReady || !locationReady}
        state={state}
      />
      <div className="flex w-full min-w-0 max-w-none flex-col gap-6 pt-2">
        <section className="w-full rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="grid min-w-0 gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <PreviewAvatar
              avatarUrl={removeAvatar ? null : avatarPreview}
              initials={initials}
              name={name}
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Profile photo</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                Use a JPG, PNG, or WebP image up to 8MB.
              </p>
              <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
                <Label
                  htmlFor="avatar"
                  className="inline-flex h-9 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-4 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:text-sm"
                >
                  <Camera className="size-4" />
                  Upload photo
                </Label>
                <input
                  id="avatar"
                  name="avatar"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (!file) return;

                    setAvatarPreview(URL.createObjectURL(file));
                    setRemoveAvatar(false);
                    setAvatarChanged(true);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0"
                  onClick={() => {
                    setRemoveAvatar(true);
                    setAvatarPreview(null);
                    setAvatarChanged(true);
                  }}
                >
                  <X className="size-4" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
          <input type="hidden" name="removeAvatar" value={removeAvatar ? "on" : ""} />
        </section>

        <section className="w-full min-w-0 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold">Public profile</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
              These details appear on your public profile.
            </p>
          </div>

          <div className="mt-5 grid min-w-0 gap-5">
            <Field label="Display name">
              <Input
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
              />
            </Field>

            <UsernameField
              availability={availability}
              pendingUsername={pendingUsername}
              setUsername={setUsername}
              username={username}
            />

            <Field label="Bio" description={`${bio.length}/280 characters`}>
              <textarea
                name="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={280}
                rows={5}
                className="min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-6 shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </Field>

            <LocationField
              location={location}
              locationCity={locationCity}
              locationCountry={locationCountry}
              locationPlaceId={locationPlaceId}
              locationProvince={locationProvince}
              setLocationCity={setLocationCity}
              setLocationCountry={setLocationCountry}
              setLocation={setLocation}
              setLocationPlaceData={setLocationPlaceData}
              setLocationPlaceId={setLocationPlaceId}
              setLocationProvince={setLocationProvince}
              setLocationSuburb={setLocationSuburb}
            />
            <input
              type="hidden"
              name="locationPlaceData"
              value={locationPlaceData}
            />
            <input type="hidden" name="locationPlaceId" value={locationPlaceId} />

            <Field
              label="Profile identity"
              description="This controls how your public profile is labelled across Homzie."
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-3">
                <span className="text-sm font-semibold text-muted-foreground">
                  I am a
                </span>
                <input type="hidden" name="profileRole" value={profileRole} />
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/8 px-3 text-left text-sm font-bold text-foreground outline-none transition hover:bg-primary/12 focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="truncate">
                        {profileRoleSentenceLabel(profileRole)}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-primary" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="start"
                      sideOffset={8}
                      className="z-[80] min-w-64 overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-2xl outline-none"
                    >
                      {profileRoleOptions.map((option) => (
                        <DropdownMenu.Item
                          key={option.value}
                          onSelect={() => setProfileRole(option.value)}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                        >
                          <span className="grid size-4 place-items-center text-primary">
                            {profileRole === option.value ? (
                              <Check className="size-4" />
                            ) : null}
                          </span>
                          {option.sentenceLabel}
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </Field>
          </div>
        </section>

        <section className="w-full min-w-0 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Contact information</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-muted-foreground">
                These details can appear on your profile and listing contact cards.
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <input
                type="checkbox"
                name="publicContactVisible"
                checked={publicContactVisible}
                onChange={(event) => setPublicContactVisible(event.target.checked)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  publicContactVisible ? "bg-primary" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition-transform",
                    publicContactVisible ? "translate-x-5" : "",
                  )}
                />
              </span>
              <span className="text-sm font-bold">
                {publicContactVisible ? "Shown" : "Hidden"}
              </span>
            </label>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field
              label="Public contact email"
              description="Used on your public profile and listing contact cards. This does not change your sign-in email."
            >
              <Input
                name="contactEmail"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                maxLength={160}
                type="email"
              />
            </Field>
            <PhoneField
              label="Phone number"
              name="contactPhone"
              value={contactPhone}
              setValue={setContactPhone}
            />
            <PhoneField
              label="WhatsApp number"
              name="whatsappNumber"
              value={whatsappNumber}
              setValue={setWhatsappNumber}
            />
          </div>
        </section>
      </div>

    </form>
  );
}
