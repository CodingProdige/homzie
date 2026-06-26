"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import {
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { flushSync, useFormStatus } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Camera,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  Eye,
  Grip,
  House,
  ImagePlus,
  Link2,
  LoaderCircle,
  MapPin,
  Play,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  PageTopBar,
  PageTopBarMenuItem,
} from "@/components/page-top-bar";
import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import {
  RichTextEditor,
  richTextToPlainText,
} from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CurrencySelector } from "@/modules/currency/currency-selector";
import { useCurrency } from "@/modules/currency/currency-provider";
import { ListingCard, type ListingCardData } from "@/modules/listings/components/listing-card";
import {
  archiveListing,
  createListing,
  importListingDraftFromUrl,
  improveListingDescription,
  improveListingTitle,
  updateListing,
} from "@/modules/listings/actions";
import { toPublicMediaUrl } from "@/media/paths";
import {
  featureOptions,
  listingTypeOptions,
  mandateTypeOptions,
  propertyCategoryOptions,
  propertyTypeOptions,
  type ListingType,
  type MandateType,
  type PropertyCategory,
  type PropertyType,
} from "@/modules/listings/options";
import {
  formatGroupedMoney,
  formatGroupedNumber,
  formatPlainNumber,
  parseListingNumberInput,
  roundBathroomCount,
} from "@/modules/listings/numeric-values";
import {
  commercialPropertyTypes,
  getListingStrength,
  getListingPublishIssues as getPublishIssues,
  getListingReadinessItems,
  hasCompleteListingLocation,
  isListingStepComplete,
  landOnlyPropertyTypes,
  mandateOptionsForListingType,
  residentialPropertyTypes,
  type ListingPublishIssue as PublishIssue,
  type ListingReadinessItem as ReadinessItem,
  type ListingStrength,
  type ListingStrengthBenchmark,
} from "@/modules/listings/listing-validation";

type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  types?: string[];
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

type GoogleAutocompleteService = {
  getPlacePredictions: (
    request: {
      input: string;
      sessionToken?: unknown;
    },
    callback: (
      predictions: GoogleAutocompletePrediction[] | null,
      status: string,
    ) => void,
  ) => void;
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

type ListingFormMedia = {
  file?: File;
  id: string;
  name: string;
  path?: string;
  previewUrl: string;
  size?: number;
  sizeLabel: string;
  sourceUrl?: string;
  type?: string;
};

type ListingAutosaveMedia = Omit<ListingFormMedia, "previewUrl">;

type ListingAutosaveState = {
  activeStep: number;
  coverIndex: number;
  draft: ListingDraft;
  importedLocationCandidate?: ImportedLocationCandidate | null;
  savedAt: number;
  version: 1;
};

export type ListingDraft = {
  addressVisibility: string;
  askingPrice: string;
  availableFrom: string;
  bathrooms: string;
  bedrooms: string;
  buyerIncentive: string;
  city: string;
  country: string;
  developerName: string;
  description: string;
  erfSize: string;
  estateName: string;
  features: string[];
  floorSize: string;
  furnishedStatus: string;
  garages: string;
  grossLettableArea: string;
  googlePlaceId: string;
  googlePlaceData: string;
  insuranceEstimate: string;
  landSizeHectares: string;
  leaseExpiryDate: string;
  listingReference: string;
  listingVisibility: string;
  listingType: ListingType;
  location: string;
  localTaxes: string;
  loadingBays: string;
  mandateEndDate: string;
  mandateStartDate: string;
  mandateType: string;
  communityFees: string;
  occupancyStatus: string;
  ownershipType: string;
  outbuildings: string;
  parking: string;
  petsAllowed: string;
  powerSupply: string;
  previousAskingPrice: string;
  priceQualifier: string;
  propertyCategory: PropertyCategory;
  propertyType: PropertyType;
  province: string;
  reservationAmount: string;
  reservationEnabled: boolean;
  rentalYield: string;
  servitudes: string;
  shortLetAllowed: string;
  storeys: string;
  titleDeedStatus: string;
  streetName: string;
  streetNumber: string;
  suburb: string;
  title: string;
  postalCode: string;
  transferCostsEstimate: string;
  unitCount: string;
  unitNumber: string;
  waterRights: string;
  contactVisibility: string;
  mandateVisibility: string;
  occupancyVisibility: string;
  previousPriceVisibility: string;
  reservationVisibility: string;
  utilitiesEstimate: string;
  zoning: string;
};

export type ListingFormInitialMedia = {
  name?: string;
  path: string;
  size?: number;
  sourceUrl?: string;
  type?: string;
};

const steps = [
  { icon: Sparkles, label: "Type" },
  { icon: MapPin, label: "Location" },
  { icon: BedDouble, label: "Details" },
  { icon: CircleDollarSign, label: "Pricing" },
  { icon: Camera, label: "Media" },
  { icon: ShieldCheck, label: "Mandate" },
  { icon: Eye, label: "Visibility" },
  { icon: BadgeCheck, label: "Preview" },
];
const googleMapsScriptId = "homzie-google-maps-places";
const maxImageDimension = 2200;
const imageQuality = 0.82;
const maxDescriptionLength = 3000;
const maxTitleLength = 120;
const maxListingMediaItems = 70;
const maxListingVideoSizeMb = 80;
const videoCompressionMimeType = "video/webm;codecs=vp9,opus";
const videoCompressionBitrate = 2_500_000;
const aiActionCooldownSeconds = 30;
const maxListingFeatures = 10;
const maxFeatureLength = 24;
const priceQualifierOptions = [
  { label: "No label", value: "" },
  { label: "From", value: "From" },
  { label: "Offers from", value: "Offers from" },
  { label: "Guide price", value: "Guide price" },
  { label: "Negotiable", value: "Negotiable" },
];
const ownershipTypeOptions = [
  { label: "Not specified", value: "" },
  { label: "Freehold", value: "freehold" },
  { label: "Sectional title", value: "sectional_title" },
  { label: "Share block", value: "share_block" },
  { label: "Leasehold", value: "leasehold" },
  { label: "Permission to occupy", value: "permission_to_occupy" },
];
const titleDeedStatusOptions = [
  { label: "Not specified", value: "" },
  { label: "Available", value: "available" },
  { label: "Pending transfer", value: "pending_transfer" },
  { label: "Bond registered", value: "bond_registered" },
  { label: "Unknown", value: "unknown" },
];
const zoningOptions = [
  { label: "Not specified", value: "" },
  { label: "Residential", value: "residential" },
  { label: "Commercial", value: "commercial" },
  { label: "Industrial", value: "industrial" },
  { label: "Agricultural", value: "agricultural" },
  { label: "Mixed use", value: "mixed_use" },
  { label: "Development", value: "development" },
];
const occupancyStatusOptions = [
  { label: "Not specified", value: "" },
  { label: "Vacant", value: "vacant" },
  { label: "Owner occupied", value: "owner_occupied" },
  { label: "Tenanted", value: "tenanted" },
  { label: "Partly tenanted", value: "partly_tenanted" },
];
const yesNoOptions = [
  { label: "Not specified", value: "" },
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];
const listingVisibilityOptions = [
  { label: "Public search and profile", value: "public" },
  { label: "Profile and private links only", value: "profile_private" },
];
const addressVisibilityOptions = [
  { label: "Show area only", value: "area" },
  { label: "Show exact address", value: "exact" },
];
const contactVisibilityOptions = [
  { label: "Show agent contact actions", value: "show" },
  { label: "Hide direct contact details", value: "hide_details" },
];
const fieldVisibilityOptions = [
  { label: "Visible to public", value: "show" },
  { label: "Hidden from public", value: "hide" },
];
const powerSupplyOptions = [
  { label: "Not specified", value: "" },
  { label: "Single phase", value: "single_phase" },
  { label: "Three phase", value: "three_phase" },
  { label: "Solar / backup included", value: "solar_backup" },
];
const listingAutosavePrefix = "homzie:listings:autosave";
const listingAutosaveDbName = "homzie-listing-autosave";
const listingAutosaveStoreName = "listing-form-media";

type MediaUploadState = {
  active: boolean;
  completed: number;
  total: number;
};

type MediaPreparationState = {
  active: boolean;
  completed: number;
  total: number;
};

type ImportedListingSummary = {
  foundImageCount?: number;
  importedImageCount?: number;
  skippedExistingImageCount?: number;
  sourceUrl: string;
  warnings: string[];
};

type ImportedLocationCandidate = {
  sourceUrl: string;
  value: string;
};

type ImportedLocationSuggestion = {
  formattedAddress: string;
  option: GoogleAutocompletePrediction;
  parts: {
    city: string;
    country: string;
    postalCode: string;
    province: string;
    streetName: string;
    streetNumber: string;
    suburb: string;
  };
  place: GooglePlaceDetails | null;
};

type ImportListingActionResult = Awaited<
  ReturnType<typeof importListingDraftFromUrl>
>;

const initialDraft: ListingDraft = {
  addressVisibility: "area",
  askingPrice: "",
  availableFrom: "",
  bathrooms: "",
  bedrooms: "",
  buyerIncentive: "",
  city: "",
  country: "",
  developerName: "",
  description: "",
  erfSize: "",
  estateName: "",
  features: [],
  floorSize: "",
  furnishedStatus: "",
  garages: "",
  grossLettableArea: "",
  googlePlaceId: "",
  googlePlaceData: "",
  insuranceEstimate: "",
  landSizeHectares: "",
  leaseExpiryDate: "",
  listingReference: "",
  listingVisibility: "public",
  listingType: "sale",
  location: "",
  localTaxes: "",
  loadingBays: "",
  mandateEndDate: "",
  mandateStartDate: "",
  mandateType: "open",
  communityFees: "",
  occupancyStatus: "",
  ownershipType: "",
  outbuildings: "",
  parking: "",
  petsAllowed: "",
  powerSupply: "",
  previousAskingPrice: "",
  priceQualifier: "",
  propertyCategory: "residential",
  propertyType: "free_standing_house",
  province: "",
  reservationAmount: "",
  reservationEnabled: false,
  rentalYield: "",
  servitudes: "",
  shortLetAllowed: "",
  storeys: "",
  titleDeedStatus: "",
  streetName: "",
  streetNumber: "",
  suburb: "",
  title: "",
  postalCode: "",
  transferCostsEstimate: "",
  unitCount: "",
  unitNumber: "",
  waterRights: "",
  contactVisibility: "show",
  mandateVisibility: "show",
  occupancyVisibility: "show",
  previousPriceVisibility: "show",
  reservationVisibility: "show",
  utilitiesEstimate: "",
  zoning: "",
};

function mandateTypeValue(value: string): MandateType {
  return mandateTypeOptions.some((option) => option.value === value)
    ? (value as MandateType)
    : "open";
}

function propertyCategoryValue(value: string): PropertyCategory {
  return propertyCategoryOptions.some((option) => option.value === value)
    ? (value as PropertyCategory)
    : "residential";
}

function categoryForPropertyType(value: string): PropertyCategory {
  return (
    propertyTypeOptions.find((option) => option.value === value)?.category ||
    "residential"
  );
}

function propertyTypeValue(value: string): PropertyType {
  return propertyTypeOptions.some((option) => option.value === value)
    ? (value as PropertyType)
    : "free_standing_house";
}

function buildInitialDraft(value?: Partial<ListingDraft>) {
  const draft = { ...initialDraft, ...value };
  const propertyType = propertyTypeValue(draft.propertyType);
  const inferredCategory = categoryForPropertyType(propertyType);

  return {
    ...draft,
    features: draft.features.slice(0, maxListingFeatures).map(normalizeFeatureInput),
    mandateType: mandateTypeValue(draft.mandateType),
    propertyCategory:
      draft.propertyCategory && draft.propertyCategory === inferredCategory
        ? propertyCategoryValue(draft.propertyCategory)
        : inferredCategory,
    propertyType,
  };
}

function buildInitialMedia(value?: ListingFormInitialMedia[]) {
  return (value || [])
    .map((item, index): ListingFormMedia | null => {
      const previewUrl = toPublicMediaUrl(item.path);

      if (!previewUrl) return null;

      return {
        id: `existing-${item.path}-${index}`,
        name: item.name || item.path.split("/").pop() || "Listing image",
        path: item.path,
        previewUrl,
        size: item.size || 0,
        sizeLabel: item.size ? formatFileSize(item.size) : "Saved",
        sourceUrl: item.sourceUrl,
        type: item.type || "image/webp",
      };
    })
    .filter((item): item is ListingFormMedia => Boolean(item));
}

function getListingAutosaveKey({
  listingId,
  mode,
  profilePath,
}: {
  listingId?: string;
  mode: "create" | "edit";
  profilePath: string;
}) {
  return `${listingAutosavePrefix}:${mode}:${listingId || profilePath}`;
}

function mediaToAutosave(media: ListingFormMedia[]) {
  return media.map(({ file, id, name, path, size, sizeLabel, sourceUrl, type }) => ({
    file,
    id,
    name,
    path,
    size,
    sizeLabel,
    sourceUrl,
    type,
  }));
}

function autosaveToMedia(media: ListingAutosaveMedia[]) {
  return media
    .map((item): ListingFormMedia | null => {
      const previewUrl = item.file
        ? URL.createObjectURL(item.file)
        : toPublicMediaUrl(item.path);

      if (!previewUrl) return null;

      return {
        ...item,
        previewUrl,
        sizeLabel:
          item.sizeLabel ||
          (item.size ? formatFileSize(item.size) : item.path ? "Saved" : ""),
      };
    })
    .filter((item): item is ListingFormMedia => Boolean(item));
}

function RequiredAsterisk() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 text-base font-semibold leading-none text-destructive"
      title="Required"
    >
      *
    </span>
  );
}

type ListingDropdownOption<T extends string> = {
  description?: string;
  label: string;
  value: T;
};

function ListingDropdown<T extends string>({
  description,
  hideLabel = false,
  label,
  onChange,
  options,
  required = false,
  value,
}: {
  description?: string;
  hideLabel?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: readonly ListingDropdownOption<T>[];
  required?: boolean;
  value: T;
}) {
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div className="min-w-0">
      {hideLabel ? null : (
        <p className="inline-flex items-center text-sm font-medium">
          {label}
          {required ? <RequiredAsterisk /> : null}
        </p>
      )}
      {!hideLabel && description ? (
        <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="mt-2 flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-background px-4 text-left text-sm font-normal outline-none transition-colors hover:border-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
          >
            <span className="min-w-0 truncate">{selected?.label || "Select"}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[90] max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/20 outline-none"
          >
            {options.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-normal outline-none transition-colors focus:bg-primary/10 focus:text-primary",
                  option.value === value && "bg-primary/10 text-primary",
                )}
                onSelect={() => onChange(option.value)}
              >
                <span className="min-w-0">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block line-clamp-2 text-xs font-normal leading-4 text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {option.value === value ? (
                  <Check className="size-4 shrink-0" />
                ) : null}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function syncMediaInputFiles(
  input: HTMLInputElement | null,
  media: ListingFormMedia[],
) {
  if (!input) return;

  const transfer = new DataTransfer();

  media
    .map((item) => item.file)
    .filter((file): file is File => Boolean(file))
    .forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

function openListingAutosaveDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(listingAutosaveDbName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(listingAutosaveStoreName, {
        keyPath: "key",
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadAutosavedMedia(key: string) {
  const db = await openListingAutosaveDb();

  return new Promise<ListingAutosaveMedia[]>((resolve) => {
    const transaction = db.transaction(listingAutosaveStoreName, "readonly");
    const request = transaction.objectStore(listingAutosaveStoreName).get(key);

    request.onsuccess = () => {
      const result = request.result as
        | { media?: ListingAutosaveMedia[] }
        | undefined;

      resolve(result?.media || []);
    };
    request.onerror = () => resolve([]);
    transaction.oncomplete = () => db.close();
  });
}

async function saveAutosavedMedia(key: string, media: ListingFormMedia[]) {
  const db = await openListingAutosaveDb();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(listingAutosaveStoreName, "readwrite");

    transaction
      .objectStore(listingAutosaveStoreName)
      .put({ key, media: mediaToAutosave(media) });
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function clearAutosavedMedia(key: string) {
  const db = await openListingAutosaveDb();

  return new Promise<void>((resolve) => {
    const transaction = db.transaction(listingAutosaveStoreName, "readwrite");

    transaction.objectStore(listingAutosaveStoreName).delete(key);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      resolve();
    };
  });
}

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

function updateDraft<K extends keyof ListingDraft>(
  setDraft: Dispatch<SetStateAction<ListingDraft>>,
  key: K,
  value: ListingDraft[K],
) {
  setDraft((current) => ({ ...current, [key]: value }));
}

function useCountdown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;

    const interval = window.setInterval(() => {
      setSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [seconds]);

  return [seconds, setSeconds] as const;
}

function getCooldownSeconds(message?: string) {
  const match = message?.match(/(\d+)\s+seconds?/i);

  return match ? Number(match[1]) : 0;
}

function getAiResponseClassName(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("improved") ||
    normalizedMessage.includes("saved") ||
    normalizedMessage.includes("ready")
  ) {
    return "text-emerald-600";
  }

  if (
    normalizedMessage.includes("cooldown") ||
    normalizedMessage.includes("add ")
  ) {
    return "text-amber-600";
  }

  return "text-destructive";
}

function integerInputValue(value: string) {
  return value.replace(/\D/g, "");
}

function decimalInputValue(value: string, decimalPlaces = 2) {
  const normalized = value.replace(",", ".");
  const sanitized = normalized.replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = sanitized.split(".");

  if (!sanitized.includes(".")) {
    return whole;
  }

  return `${whole}.${decimalParts.join("").slice(0, decimalPlaces)}`;
}

function steppedDecimalInputValue(
  value: string,
  step: number,
  decimalPlaces: number,
) {
  const parsed = parseListingNumberInput(value);

  if (parsed === null) return "";

  return formatPlainNumber(
    step === 0.5 ? roundBathroomCount(parsed) : Math.round(parsed / step) * step,
    decimalPlaces,
  );
}

function normalizeFeatureInput(value: string) {
  return value
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxFeatureLength);
}

function SubmitButtons({
  intent,
  isMediaBusy,
  mediaBusyLabel = "Uploading",
  onReset,
  onBlockedPublish,
  publishIssues,
  setIntent,
}: {
  intent: "draft" | "published";
  isMediaBusy?: boolean;
  mediaBusyLabel?: string;
  onBlockedPublish: () => void;
  onReset: () => void;
  publishIssues: PublishIssue[];
  setIntent: (intent: "draft" | "published") => void;
}) {
  const { pending } = useFormStatus();
  const publishBlocked = publishIssues.length > 0;
  const savingDraft = pending && intent === "draft";
  const publishing = pending && intent === "published";

  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-2 sm:gap-3">
      <Button
        className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
        type="button"
        variant="outline"
        disabled={isMediaBusy}
        onClick={onReset}
      >
        <span className="sm:hidden">Reset</span>
        <span className="hidden sm:inline">Reset form</span>
      </Button>
      <Button
        className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
        type="submit"
        name="publishIntent"
        value="draft"
        variant="outline"
        disabled={savingDraft || isMediaBusy}
        onClick={() => setIntent("draft")}
      >
        {isMediaBusy ? mediaBusyLabel : savingDraft ? "Saving" : "Save draft"}
      </Button>
      <Button
        className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
        type={publishBlocked ? "button" : "submit"}
        name="publishIntent"
        value="published"
        disabled={isMediaBusy || (publishing && !publishBlocked)}
        onClick={() => {
          setIntent("published");

          if (publishBlocked) {
            onBlockedPublish();
          }
        }}
      >
        {isMediaBusy ? (
          mediaBusyLabel
        ) : publishing && !publishBlocked ? (
          "Publishing"
        ) : (
          <>
            <span className="sm:hidden">Publish</span>
            <span className="hidden sm:inline">Publish listing</span>
          </>
        )}
      </Button>
    </div>
  );
}

function EditSubmitButtons({
  formId,
  intent,
  isMediaBusy,
  mediaBusyLabel = "Uploading",
  listingId,
  onBlockedPublish,
  publishIssues,
  setIntent,
}: {
  formId: string;
  intent: "draft" | "published";
  isMediaBusy?: boolean;
  mediaBusyLabel?: string;
  listingId?: string;
  onBlockedPublish: () => void;
  publishIssues: PublishIssue[];
  setIntent: (intent: "draft" | "published") => void;
}) {
  const { pending } = useFormStatus();
  const publishBlocked = publishIssues.length > 0;
  const savingDraft = pending && intent === "draft";
  const publishing = pending && intent === "published";

  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-2 sm:gap-3">
      {listingId ? (
        <ArchiveListingDialog disabled={Boolean(isMediaBusy)} formId={formId} />
      ) : null}
      {intent === "draft" ? (
        <>
          <Button
            className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
            type="submit"
            name="publishIntent"
            value="draft"
            variant="outline"
            disabled={savingDraft || isMediaBusy}
            onClick={() => setIntent("draft")}
          >
            {isMediaBusy ? mediaBusyLabel : savingDraft ? "Updating" : "Update draft"}
          </Button>
          <Button
            className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
            type={publishBlocked ? "button" : "submit"}
            name="publishIntent"
            value="published"
            disabled={isMediaBusy || (publishing && !publishBlocked)}
            onClick={() => {
              setIntent("published");

              if (publishBlocked) {
                onBlockedPublish();
              }
            }}
          >
            {isMediaBusy
              ? mediaBusyLabel
              : publishing && !publishBlocked
                ? "Publishing"
                : "Publish listing"}
          </Button>
        </>
      ) : (
        <Button
          className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
          type={publishBlocked ? "button" : "submit"}
          name="publishIntent"
          value="published"
          disabled={isMediaBusy || (publishing && !publishBlocked)}
          onClick={() => {
            setIntent("published");

            if (publishBlocked) {
              onBlockedPublish();
            }
          }}
        >
          {isMediaBusy
            ? mediaBusyLabel
            : publishing && !publishBlocked
              ? "Updating"
              : "Update listing"}
        </Button>
      )}
    </div>
  );
}

function ListingPublishProgress({
  imageCount,
  intent,
  isUploadingMedia,
  mediaCount,
  mode,
  uploadedCount,
  uploadCount,
  videoCount,
}: {
  imageCount: number;
  intent: "draft" | "published";
  isUploadingMedia?: boolean;
  mediaCount: number;
  mode: "create" | "edit";
  uploadedCount?: number;
  uploadCount: number;
  videoCount: number;
}) {
  const { pending } = useFormStatus();
  const [progress, setProgress] = useState(14);
  const publishing = pending && intent === "published";
  const processing = isUploadingMedia || publishing;
  const uploadProgress =
    isUploadingMedia && uploadCount
      ? Math.min(88, 12 + ((uploadedCount || 0) / uploadCount) * 76)
      : progress;
  const steps = [
    "Checking required listing fields",
    uploadCount
      ? isUploadingMedia
        ? `Uploading media ${Math.min(uploadedCount || 0, uploadCount)} of ${uploadCount}`
        : "Listing media uploaded"
      : "Keeping saved media",
    "Saving listing details",
    uploadCount > 10 && !isUploadingMedia
      ? "Finalizing listing after media upload"
      : mode === "edit"
        ? "Updating public listing"
        : "Publishing public listing",
  ];
  const activeStepIndex = Math.min(
    steps.length - 1,
    isUploadingMedia ? 1 : Math.floor((uploadProgress / 100) * steps.length),
  );

  useEffect(() => {
    if (!publishing) return;

    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(current + (current < 65 ? 8 : 3), 92));
    }, 850);

    return () => window.clearInterval(interval);
  }, [publishing]);

  if (!processing) return null;

  return (
    <section
      role="status"
      aria-live="polite"
      className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-4 text-foreground shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <LoaderCircle className="size-5 animate-spin" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {isUploadingMedia
                  ? "Uploading listing media"
                  : mode === "edit"
                    ? "Updating listing"
                    : "Publishing listing"}
              </p>
              <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
                Keep this page open while Homzie processes the listing.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {mediaCount} media
              </span>
              <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                {imageCount} images
              </span>
              <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                {videoCount} videos
              </span>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-background">
            <span
              className="block h-full rounded-full bg-[image:var(--homzie-gradient)] transition-[width] duration-700 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          {uploadCount > 10 ? (
            <p className="mt-2 text-xs font-normal leading-5 text-muted-foreground">
              Larger media sets are uploaded before the listing is saved, so
              this still completes from one button press.
            </p>
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((step, index) => {
              const isDone = index < activeStepIndex;
              const isActive = index === activeStepIndex;

              return (
                <div
                  key={step}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-normal text-muted-foreground",
                    isActive && "border-primary/35 text-primary",
                    isDone && "text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border border-border",
                      isActive && "border-primary bg-primary/10",
                      isDone && "border-primary bg-primary text-primary-foreground",
                    )}
                  >
                    {isDone ? (
                      <Check className="size-3" />
                    ) : isActive ? (
                      <LoaderCircle className="size-3 animate-spin" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchiveListingDialog({
  disabled,
  formId,
  triggerId,
}: {
  disabled?: boolean;
  formId: string;
  triggerId?: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          id={triggerId}
          className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
          type="button"
          variant="outline"
          disabled={disabled}
        >
          <Trash2 className="size-4" />
          <span className="hidden sm:inline">Remove listing</span>
          <span className="sm:hidden">Remove</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] w-[min(calc(100vw-2rem),30rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
              <CircleAlert className="size-5" />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">
                Archive this listing?
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                This will not delete the listing. It will be archived and no
                longer publicly visible. Archiving does not affect performance
                stats, and removing a listing to alter recorded performance is
                not permitted. Published listings remain part of performance
                history. If the same property is recorded as sold by another
                agent, this listing will count as sold externally. Drafts that
                were never published do not count toward analytics.
              </Dialog.Description>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              form={formId}
              type="submit"
              name="listingAction"
              value="archive"
              variant="destructive"
              formAction={archiveListing}
            >
              Confirm archive
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PublishRequirementsDialog({
  issues,
  onGoToStep,
  onOpenChange,
  open,
}: {
  issues: PublishIssue[];
  onGoToStep: (step: number) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const groupedIssues = steps
    .map((step, index) => ({
      issues: issues.filter((issue) => issue.step === index),
      label: step.label,
      step: index,
    }))
    .filter((group) => group.issues.length > 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] max-h-[min(40rem,calc(100dvh-2rem))] w-[min(calc(100vw-2rem),34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-600">
              <CircleAlert className="size-5" />
            </span>
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">
                Finish these items before publishing
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                Your draft is saved, but Homzie needs these public-facing basics
                before the listing can go live.
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {groupedIssues.map((group) => (
              <button
                key={group.step}
                type="button"
                className="w-full rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/35 hover:bg-primary/5"
                onClick={() => onGoToStep(group.step)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{group.label}</p>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    {group.issues.length} missing
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {group.issues.map((issue) => (
                    <li
                      key={issue.message}
                      className="flex gap-2 text-xs font-normal leading-5 text-muted-foreground"
                    >
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                Keep editing
              </Button>
            </Dialog.Close>
            {groupedIssues[0] ? (
              <Button
                type="button"
                onClick={() => onGoToStep(groupedIssues[0].step)}
              >
                Go to first issue
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ListingStrengthPanel({
  items,
  onGoToStep,
  strength,
}: {
  items: ReadinessItem[];
  onGoToStep: (step: number) => void;
  strength: ListingStrength;
}) {
  const missingItems = items.filter((item) => !item.isComplete);
  const isStrong = strength.percent >= 90;
  const isGood = strength.percent >= 75;

  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-primary">
            Listing strength
          </p>
          <p className="mt-1 text-sm font-normal leading-5 text-muted-foreground">
            {strength.comparison}
          </p>
          {missingItems.length ? (
            <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
              Improve{" "}
              {missingItems
                .slice(0, 3)
                .map((item) => item.label.toLowerCase())
                .join(", ")}
              {missingItems.length > 3 ? " and more" : ""}.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
              isStrong
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : isGood
                  ? "bg-primary/10 text-primary"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            )}
          >
            {isStrong ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {strength.label} · {strength.percent}%
          </span>
          {missingItems[0] ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onGoToStep(missingItems[0].step)}
            >
              Improve next
              <ArrowRight className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-[image:var(--homzie-gradient)] transition-[width] duration-500"
          style={{ width: `${strength.percent}%` }}
        />
      </div>
    </section>
  );
}

function ListingPublishSuccess({
  createAnotherPath,
  listingPath,
}: {
  createAnotherPath: string;
  listingPath: string;
}) {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[720px] items-center justify-center">
        <section className="w-full rounded-lg border border-border bg-card p-6 text-center text-card-foreground shadow-sm sm:p-8">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="size-8 stroke-[2.8]" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">Listing published</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-normal leading-6 text-muted-foreground">
            Your listing is live on your Homzie profile and ready to be linked
            to reels.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button asChild>
              <Link href={listingPath} replace>View listing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={createAnotherPath}>Create another</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ListingDuplicateWarning({
  createAnotherPath,
  profileListingsPath,
}: {
  createAnotherPath: string;
  profileListingsPath: string;
}) {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[720px] items-center justify-center">
        <section className="w-full rounded-lg border border-border bg-card p-6 text-center text-card-foreground shadow-sm sm:p-8">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-amber-100 text-amber-600">
            <CircleAlert className="size-8 stroke-[2.8]" />
          </div>
          <h1 className="mt-5 text-xl font-semibold">Listing already exists</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-normal leading-6 text-muted-foreground">
            This profile already has an active listing for that property. Open
            the existing listing instead of creating a duplicate.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button asChild>
              <Link href={profileListingsPath}>View existing listing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={createAnotherPath}>Create a different listing</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

async function compressImageFile(file: File) {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    maxImageDimension / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", imageQuality),
  );

  if (!blob || blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
    type: "image/webp",
  });
}

function isVideoMedia(item: Pick<ListingFormMedia, "type" | "name" | "previewUrl">) {
  return (
    item.type?.startsWith("video/") ||
    /\.(mp4|mov|webm)$/i.test(item.name) ||
    /\.(mp4|mov|webm)(?:\?|$)/i.test(item.previewUrl)
  );
}

function isImageMedia(item: Pick<ListingFormMedia, "type" | "name" | "previewUrl">) {
  return !isVideoMedia(item);
}

async function videoDuration(file: File) {
  const url = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read that video."));
    });

    return Number.isFinite(video.duration) ? video.duration : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressVideoFile(file: File) {
  if (!file.type.startsWith("video/")) return file;

  const duration = await videoDuration(file);

  if (duration > 90) {
    throw new Error("Listing videos must be 90 seconds or shorter.");
  }

  const canCompress =
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported(videoCompressionMimeType);

  if (!canCompress || file.size <= maxListingVideoSizeMb * 1024 * 1024) {
    return file;
  }

  const url = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not optimize that video."));
    });

    const captureStream = (video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
    }).captureStream;
    const stream = typeof captureStream === "function" ? captureStream.call(video) : null;

    if (!stream) return file;

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: videoCompressionMimeType,
      videoBitsPerSecond: videoCompressionBitrate,
      audioBitsPerSecond: 128_000,
    });

    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onerror = () => reject(new Error("Could not optimize that video."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
      video.onended = () => {
        if (recorder.state !== "inactive") recorder.stop();
      };
      recorder.start(1000);
      void video.play().catch(reject);
    });

    if (!compressedBlob.size || compressedBlob.size >= file.size) return file;

    return new File([compressedBlob], file.name.replace(/\.[^.]+$/, ".webm"), {
      type: "video/webm",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function optimizeMediaFile(file: File) {
  if (file.type.startsWith("image/")) return compressImageFile(file);
  if (file.type.startsWith("video/")) return compressVideoFile(file);

  return file;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

function movedMediaDestinationIndex(
  length: number,
  fromIndex: number,
  insertIndex: number,
) {
  if (
    fromIndex < 0 ||
    fromIndex >= length ||
    insertIndex < 0 ||
    insertIndex > length
  ) {
    return null;
  }

  return insertIndex > fromIndex ? insertIndex - 1 : insertIndex;
}

function moveMediaItem<T>(items: T[], fromIndex: number, insertIndex: number) {
  const destinationIndex = movedMediaDestinationIndex(
    items.length,
    fromIndex,
    insertIndex,
  );

  if (destinationIndex === null || destinationIndex === fromIndex) {
    return items;
  }

  const next = [...items];
  const [movedItem] = next.splice(fromIndex, 1);
  next.splice(destinationIndex, 0, movedItem);

  return next;
}

function movedMediaIndex(
  index: number,
  length: number,
  fromIndex: number,
  insertIndex: number,
) {
  const destinationIndex = movedMediaDestinationIndex(
    length,
    fromIndex,
    insertIndex,
  );

  if (destinationIndex === null || destinationIndex === fromIndex) {
    return index;
  }

  const order = Array.from({ length }, (_, itemIndex) => itemIndex);
  const [movedIndex] = order.splice(fromIndex, 1);
  order.splice(destinationIndex, 0, movedIndex);

  return order.indexOf(index);
}

function formatListingPrice(
  value: string,
  listingType: ListingType,
  formatPriceCents: (cents: number) => string,
) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) return "Price not set";

  const formatted = formatPriceCents(Math.round(amount * 100));

  return listingType === "rental" ? `${formatted}/month` : formatted;
}

function formatEditableCurrencyValue(
  value: string,
  convertFromZarAmount: (amountZar: number) => number,
) {
  const amount = parseListingNumberInput(value);

  if (amount === null) return "";

  const converted = convertFromZarAmount(amount);

  return formatGroupedMoney(converted);
}

function inferMoneyEditingDecimalSeparator(value: string) {
  const lastDotIndex = value.lastIndexOf(".");
  const lastCommaIndex = value.lastIndexOf(",");

  if (lastDotIndex >= 0 && lastCommaIndex >= 0) {
    return lastDotIndex > lastCommaIndex ? "." : ",";
  }

  const separator =
    lastDotIndex >= 0 ? "." : lastCommaIndex >= 0 ? "," : null;

  if (!separator) return null;
  if (value.endsWith(separator)) return separator;

  const parts = value.split(separator);
  const finalPart = parts[parts.length - 1] || "";

  return finalPart.length > 0 && finalPart.length <= 2 ? separator : null;
}

function formatMoneyEditingValue(value: string) {
  const cleaned = value.replace(/\s+/g, "").replace(/[^\d.,]/g, "");

  if (!cleaned || !/\d/.test(cleaned)) return "";

  const decimalSeparator = inferMoneyEditingDecimalSeparator(cleaned);

  if (!decimalSeparator) {
    const wholeDigits = cleaned.replace(/\D/g, "");

    return wholeDigits ? formatGroupedNumber(Number(wholeDigits), 0) : "";
  }

  const decimalIndex = cleaned.lastIndexOf(decimalSeparator);
  const wholeDigits = cleaned.slice(0, decimalIndex).replace(/\D/g, "");
  const decimalDigits = cleaned
    .slice(decimalIndex + 1)
    .replace(/\D/g, "")
    .slice(0, 2);
  const wholeValue = wholeDigits ? Number(wholeDigits) : 0;

  return `${formatGroupedNumber(wholeValue, 0)}.${decimalDigits}`;
}

function editableCurrencyToZarValue(
  value: string,
  convertToZarAmount: (amount: number) => number,
) {
  const amount = parseListingNumberInput(value);

  if (amount === null) return "";

  return formatPlainNumber(convertToZarAmount(amount), 2);
}

function CurrencyAmountInput({
  className,
  convertFromZarAmount,
  convertToZarAmount,
  onValueChange,
  placeholder,
  value,
}: {
  className?: string;
  convertFromZarAmount: (amountZar: number) => number;
  convertToZarAmount: (amount: number) => number;
  onValueChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const formattedValue = formatEditableCurrencyValue(value, convertFromZarAmount);
  const [displayValue, setDisplayValue] = useState(formattedValue);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDisplayValue(formattedValue);
    }
  }, [formattedValue]);

  return (
    <input
      value={displayValue}
      type="text"
      inputMode="decimal"
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(event) => {
        const nextDisplayValue = formatMoneyEditingValue(event.target.value);

        setDisplayValue(nextDisplayValue);
        onValueChange(editableCurrencyToZarValue(nextDisplayValue, convertToZarAmount));
      }}
      onBlur={() => {
        focusedRef.current = false;

        const amount = parseListingNumberInput(displayValue);

        if (amount === null) {
          setDisplayValue("");
          onValueChange("");
          return;
        }

        setDisplayValue(formatGroupedMoney(amount));
        onValueChange(formatPlainNumber(convertToZarAmount(amount), 2));
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

function isReducedPrice(askingPrice: string, previousAskingPrice: string) {
  const current = Number(askingPrice);
  const previous = Number(previousAskingPrice);

  return (
    Number.isFinite(current) &&
    Number.isFinite(previous) &&
    current > 0 &&
    previous > current
  );
}

function ListingCostInput({
  convertFromZarAmount,
  convertToZarAmount,
  currency,
  description,
  draftKey,
  label,
  placeholder,
  setDraft,
  value,
}: {
  convertFromZarAmount: (amountZar: number) => number;
  convertToZarAmount: (amount: number) => number;
  currency: string;
  description?: string;
  draftKey: keyof ListingDraft;
  label: string;
  placeholder?: string;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium">
      <span className="inline-flex items-center gap-1.5">
        {label} ({currency})
        {description ? (
          <AnalyticsInfoPopover title={label} description={description} />
        ) : null}
      </span>
      <CurrencyAmountInput
        value={value}
        convertFromZarAmount={convertFromZarAmount}
        convertToZarAmount={convertToZarAmount}
        onValueChange={(nextValue) => updateDraft(setDraft, draftKey, nextValue)}
        placeholder={placeholder || "0.00"}
        className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}

function ListingSelect({
  description,
  draftKey,
  label,
  setDraft,
  value,
}: {
  description?: string;
  draftKey: keyof ListingDraft;
  label: string;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
  value: string;
}) {
  return (
    <div>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        {label}
        {description ? (
          <AnalyticsInfoPopover title={label} description={description} />
        ) : null}
      </span>
      <ListingDropdown
        hideLabel
        label={label}
        options={yesNoOptions}
        value={value}
        onChange={(nextValue) => updateDraft(setDraft, draftKey, nextValue)}
      />
    </div>
  );
}

function DateInput({
  name,
  onChange,
  value,
}: {
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;

    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }

  return (
    <span className="relative mt-2 block">
      <input
        ref={inputRef}
        name={name}
        value={value}
        type="date"
        onClick={openPicker}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full cursor-pointer rounded-md border border-border bg-background px-4 pr-14 text-sm font-normal outline-none transition-colors [color-scheme:light] focus:border-primary dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md bg-primary/10 text-primary">
        <CalendarDays className="size-4" />
      </span>
    </span>
  );
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
    postalCode: addressComponent(place, "postal_code"),
    province:
      addressComponent(place, "administrative_area_level_1") ||
      fallbackParts.province,
    streetName: addressComponent(place, "route"),
    streetNumber: addressComponent(place, "street_number"),
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

async function getPlaceDetailsForPrediction(
  option: GoogleAutocompletePrediction,
) {
  await loadGooglePlaces();
  const places = (window as GoogleWindow).google?.maps?.places;

  if (!places) {
    throw new Error("Google Places is not available.");
  }

  const service = new places.PlacesService(document.createElement("div"));
  const sessionToken = new places.AutocompleteSessionToken();

  return new Promise<GooglePlaceDetails | null>((resolve) => {
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
        sessionToken,
      },
      (result, status) => {
        resolve(status === places.PlacesServiceStatus.OK ? result : null);
      },
    );
  });
}

async function findImportedLocationSuggestion(value: string) {
  await loadGooglePlaces();
  const places = (window as GoogleWindow).google?.maps?.places;

  if (!places) {
    throw new Error("Google Places is not available.");
  }

  const service = new places.AutocompleteService();
  const sessionToken = new places.AutocompleteSessionToken();

  const predictions = await new Promise<GoogleAutocompletePrediction[]>(
    (resolve) => {
      service.getPlacePredictions(
        {
          input: value,
          sessionToken,
        },
        (results, status) => {
          resolve(
            status === places.PlacesServiceStatus.OK && results?.length
              ? results
              : [],
          );
        },
      );
    },
  );
  const option = predictions[0];

  if (!option) return null;

  const place = await getPlaceDetailsForPrediction(option);
  const formattedAddress = place?.formatted_address || option.description;

  return {
    formattedAddress,
    option,
    parts: placeLocationParts(place || {}, formattedAddress),
    place,
  } satisfies ImportedLocationSuggestion;
}

function ImportListingFromLinkPanel({
  existingImportedMediaSources,
  onImported,
  summary,
}: {
  existingImportedMediaSources: string[];
  onImported: (result: ImportListingActionResult) => void;
  summary: ImportedListingSummary | null;
}) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function importDraft() {
    const nextUrl = url.trim();

    if (!nextUrl) {
      setMessage("Paste a listing link first.");
      return;
    }

    setMessage("");

    startTransition(async () => {
      const result = await importListingDraftFromUrl(
        nextUrl,
        existingImportedMediaSources,
      );

      if ("error" in result && result.error) {
        setMessage(result.error);
        return;
      }

      onImported(result);
      setMessage("Imported. Review every field before publishing.");
    });
  }

  function handleImportKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    importDraft();
  }

  return (
    <section className="mt-5 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"
            htmlFor="listing-import-url"
          >
            <Link2 className="size-3.5" />
            Import from link
          </label>
          <p className="mt-1 text-sm font-normal leading-5 text-muted-foreground">
            Paste a listing URL to prefill the form. Review fields before publishing.
          </p>
          <input
            id="listing-import-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={handleImportKeyDown}
            placeholder="https://example.com/property/..."
            className="mt-3 h-11 w-full min-w-0 rounded-md border border-border bg-background px-4 text-sm font-normal text-foreground outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20"
            disabled={isPending}
          />
        </div>
        <Button
          type="button"
          className="h-11 whitespace-nowrap lg:mb-0"
          disabled={isPending}
          onClick={importDraft}
        >
          {isPending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Importing
            </>
          ) : (
            <>
              <Link2 className="size-4" />
              Import draft
            </>
          )}
        </Button>
      </div>

      {message || summary ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-normal text-muted-foreground">
          {message ? <span>{message}</span> : null}
          {summary ? (
            <span className="rounded-full bg-muted px-2.5 py-1">
              {(summary.importedImageCount ?? 0).toLocaleString()} images imported
              {summary.skippedExistingImageCount
                ? `, ${summary.skippedExistingImageCount.toLocaleString()} already attached`
                : ""}
            </span>
          ) : null}
          {summary?.warnings.slice(0, 2).map((warning) => (
            <span
              key={warning}
              className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300"
            >
              {warning}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function CreateListingPage({
  initialCoverIndex = 0,
  initialDraft,
  initialMedia,
  initialPublishIntent = "published",
  duplicateListingId,
  listingId,
  listingError,
  listingStrengthBenchmark,
  listingUpdateFeedback,
  mode = "create",
  profilePath,
  publishedListingId,
}: {
  initialCoverIndex?: number;
  initialDraft?: Partial<ListingDraft>;
  initialMedia?: ListingFormInitialMedia[];
  initialPublishIntent?: "draft" | "published";
  duplicateListingId?: string;
  listingId?: string;
  listingError?: string;
  listingStrengthBenchmark?: ListingStrengthBenchmark | null;
  listingUpdateFeedback?: "draft" | "published" | "updated";
  mode?: "create" | "edit";
  profilePath: string;
  publishedListingId?: string;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [draft, setDraft] = useState<ListingDraft>(() =>
    buildInitialDraft(initialDraft),
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishRequirementsOpen, setPublishRequirementsOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [publishIntent, setPublishIntent] =
    useState<"draft" | "published">(initialPublishIntent);
  const [media, setMedia] = useState<ListingFormMedia[]>(() =>
    buildInitialMedia(initialMedia),
  );
  const [publishMessage, setPublishMessage] = useState("");
  const [coverIndex, setCoverIndex] = useState(initialCoverIndex);
  const [importSummary, setImportSummary] =
    useState<ImportedListingSummary | null>(null);
  const [importedLocationCandidate, setImportedLocationCandidate] =
    useState<ImportedLocationCandidate | null>(null);
  const [mediaUploadState, setMediaUploadState] = useState<MediaUploadState>({
    active: false,
    completed: 0,
    total: 0,
  });
  const [mediaPreparationState, setMediaPreparationState] =
    useState<MediaPreparationState>({
      active: false,
      completed: 0,
      total: 0,
    });
  const [mediaStatus, setMediaStatus] = useState("");
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const stepsScrollerRef = useRef<HTMLDivElement>(null);
  const autosaveHydratedRef = useRef(false);
  const mediaRef = useRef<ListingFormMedia[]>([]);
  const [stepScrollState, setStepScrollState] = useState({
    canScrollNext: false,
    canScrollPrevious: false,
  });
  const autosaveKey = useMemo(
    () => getListingAutosaveKey({ listingId, mode, profilePath }),
    [listingId, mode, profilePath],
  );
  const formId = `listing-form-${mode}-${listingId || "new"}`;
  const formAction = mode === "edit" ? updateListing : createListing;
  const isPublishedEdit = mode === "edit" && initialPublishIntent === "published";
  const isLocationRepairMode =
    isPublishedEdit && !hasCompleteListingLocation(draft);
  const isLocationLocked = isPublishedEdit && !isLocationRepairMode;
  const profileListingsPath = `${profilePath}?tab=listings`;
  const backHref = mode === "edit" && listingId ? `/listings/${listingId}` : profileListingsPath;
  const listingHref = listingId ? `/listings/${listingId}` : "";
  const activeListingType = listingTypeOptions.find(
    (option) => option.value === draft.listingType,
  );
  const activePropertyType = propertyTypeOptions.find(
    (option) => option.value === draft.propertyType,
  );
  const availablePropertyCategories = useMemo(
    () =>
      propertyCategoryOptions.filter((category) =>
        propertyTypeOptions.some(
          (option) =>
            option.category === category.value &&
            (option.listingTypes as readonly ListingType[]).includes(draft.listingType),
        ),
      ),
    [draft.listingType],
  );
  const availablePropertyTypes = useMemo(
    () =>
      propertyTypeOptions.filter(
        (option) =>
          option.category === draft.propertyCategory &&
          (option.listingTypes as readonly ListingType[]).includes(draft.listingType),
      ),
    [draft.listingType, draft.propertyCategory],
  );
  const requiresLocationConfirmation = Boolean(
    importedLocationCandidate &&
      !draft.googlePlaceId &&
      importedLocationCandidate.value.trim() === draft.location.trim(),
  );
  const publishIssues = useMemo(
    () =>
      getPublishIssues(draft, media.length, {
        requiresLocationConfirmation,
      }),
    [draft, media.length, requiresLocationConfirmation],
  );
  const readinessItems = useMemo(
    () =>
      getListingReadinessItems(draft, media.length, {
        requiresLocationConfirmation,
      }),
    [draft, media.length, requiresLocationConfirmation],
  );
  const listingStrength = useMemo(
    () =>
      getListingStrength(draft, media.length, {
        benchmark: listingStrengthBenchmark,
        requiresLocationConfirmation,
      }),
    [draft, listingStrengthBenchmark, media.length, requiresLocationConfirmation],
  );
  const uploadMedia = media.filter((item) => item.file);
  const uploadMediaCount = uploadMedia.length;
  const isUploadingMedia = mediaUploadState.active;
  const isPreparingMedia = mediaPreparationState.active;
  const isMediaBusy = isUploadingMedia || isPreparingMedia;
  const mediaBusyLabel = isUploadingMedia ? "Uploading" : "Preparing media";
  const publishIssueSteps = useMemo(
    () => new Set(publishIssues.map((issue) => issue.step)),
    [publishIssues],
  );

  function openPublishRequirements() {
    const firstIssue = publishIssues[0];

    if (firstIssue) {
      setActiveStep(firstIssue.step);
      setPublishMessage(
        `Listing incomplete: ${publishIssues
          .map((issue) => issue.message)
          .join(" ")}`,
      );
    }

    setPublishRequirementsOpen(true);
  }

  function goToPublishIssueStep(step: number) {
    setActiveStep(step);
    setPublishRequirementsOpen(false);
  }

  useEffect(() => {
    if (!publishedListingId) return;

    window.localStorage.removeItem(autosaveKey);
    void clearAutosavedMedia(autosaveKey);
  }, [autosaveKey, publishedListingId]);

  useEffect(() => {
    if (
      !availablePropertyCategories.some(
        (option) => option.value === draft.propertyCategory,
      )
    ) {
      const nextCategory = availablePropertyCategories[0]?.value || "residential";
      updateDraft(setDraft, "propertyCategory", nextCategory);
      return;
    }

    if (
      !availablePropertyTypes.some((option) => option.value === draft.propertyType)
    ) {
      const nextPropertyType = availablePropertyTypes[0]?.value;

      if (nextPropertyType) {
        updateDraft(setDraft, "propertyType", nextPropertyType);
      }
    }
  }, [
    availablePropertyCategories,
    availablePropertyTypes,
    draft.propertyCategory,
    draft.propertyType,
  ]);

  useEffect(() => {
    let isCurrent = true;

    async function loadAutosave() {
      try {
        const savedState = window.localStorage.getItem(autosaveKey);
        const parsedState = savedState
          ? (JSON.parse(savedState) as Partial<ListingAutosaveState>)
          : null;
        const savedMedia = await loadAutosavedMedia(autosaveKey);

        if (!isCurrent) return;

        if (parsedState?.version === 1 && parsedState.draft) {
          setDraft(buildInitialDraft(parsedState.draft));
          setImportedLocationCandidate(parsedState.importedLocationCandidate || null);
          setActiveStep(
            Math.min(Math.max(Number(parsedState.activeStep || 0), 0), steps.length - 1),
          );
          setCoverIndex(Math.max(Number(parsedState.coverIndex || 0), 0));
        }

        if (savedMedia.length) {
          const restoredMedia = autosaveToMedia(savedMedia);

          setMedia(restoredMedia);
          syncMediaInputFiles(mediaInputRef.current, restoredMedia);
          setMediaStatus("Restored unsaved listing photos from this browser.");
        }
      } catch (error) {
        console.error("[listings] could not load autosaved listing", error);
      } finally {
        if (isCurrent) {
          autosaveHydratedRef.current = true;
        }
      }
    }

    void loadAutosave();

    return () => {
      isCurrent = false;
    };
  }, [autosaveKey]);

  useEffect(() => {
    if (!autosaveHydratedRef.current) return;

    const timeout = window.setTimeout(() => {
      const autosaveState: ListingAutosaveState = {
        activeStep,
        coverIndex,
        draft,
        importedLocationCandidate,
        savedAt: Date.now(),
        version: 1,
      };

      try {
        window.localStorage.setItem(autosaveKey, JSON.stringify(autosaveState));
        void saveAutosavedMedia(autosaveKey, media).catch((error) => {
          console.error("[listings] could not autosave listing media", error);
        });
      } catch (error) {
        console.error("[listings] could not autosave listing", error);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [activeStep, autosaveKey, coverIndex, draft, importedLocationCandidate, media]);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => {
    const scroller = stepsScrollerRef.current;

    if (!scroller) return;

    function updateScrollState() {
      const element = stepsScrollerRef.current;

      if (!element) return;

      setStepScrollState({
        canScrollNext:
          element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
        canScrollPrevious: element.scrollLeft > 4,
      });
    }

    updateScrollState();
    scroller.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  useEffect(
    () => () => {
      mediaRef.current.forEach((item) => {
        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    },
    [],
  );

  function goNext() {
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setActiveStep((current) => Math.max(current - 1, 0));
  }

  function syncMediaFiles(nextMedia: ListingFormMedia[]) {
    const transfer = new DataTransfer();

    nextMedia
      .map((item) => item.file)
      .filter((file): file is File => Boolean(file))
      .forEach((file) => transfer.items.add(file));

    if (mediaInputRef.current) {
      mediaInputRef.current.files = transfer.files;
    }
  }

  function applyImportedListing(result: ImportListingActionResult) {
    if ("error" in result) return;

    const importedDraft = result.draft || {};
    const importedMedia = buildInitialMedia(result.media);
    const hasImportedLocation = Boolean(importedDraft.location);

    setDraft((current) =>
      buildInitialDraft({
        ...current,
        ...importedDraft,
        features: importedDraft.features?.length
          ? importedDraft.features
          : current.features,
        googlePlaceData: "",
        googlePlaceId: "",
      }),
    );

    if (importedMedia.length) {
      setMedia((current) => {
        const existingSourceUrls = new Set(
          current
            .map((item) => item.sourceUrl)
            .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl)),
        );
        const uniqueImportedMedia = importedMedia.filter(
          (item) =>
            item.path &&
            !current.some((existingItem) => existingItem.path === item.path) &&
            (!item.sourceUrl || !existingSourceUrls.has(item.sourceUrl)),
        );
        const next = [...current, ...uniqueImportedMedia].slice(
          0,
          maxListingMediaItems,
        );

        syncMediaFiles(next);

        return next;
      });
      setCoverIndex((current) => (media.length ? current : 0));
    }

    setImportSummary({
      foundImageCount: result.foundImageCount,
      importedImageCount: result.importedImageCount,
      skippedExistingImageCount: result.skippedExistingImageCount,
      sourceUrl: result.sourceUrl,
      warnings: result.warnings,
    });
    setImportedLocationCandidate(
      hasImportedLocation
        ? {
            sourceUrl: result.sourceUrl,
            value: importedDraft.location || "",
          }
        : null,
    );
    setActiveStep(1);
    setPublishMessage("Imported draft from link. Review every field before publishing.");
  }

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    const availableSlots = Math.max(maxListingMediaItems - media.length, 0);
    const files = selectedFiles.slice(0, availableSlots);
    const skippedCount = Math.max(selectedFiles.length - files.length, 0);
    setMediaStatus("");

    if (!files.length) {
      if (selectedFiles.length) {
        setMediaStatus(`You can add up to ${maxListingMediaItems} media items.`);
      }

      return;
    }

    setMediaPreparationState({
      active: true,
      completed: 0,
      total: files.length,
    });
    setMediaStatus(`Preparing media 0 of ${files.length}...`);

    const compressedFiles: File[] = [];

    try {
      for (const file of files) {
        const optimizedFile = await optimizeMediaFile(file);

        compressedFiles.push(optimizedFile);
        setMediaPreparationState({
          active: true,
          completed: compressedFiles.length,
          total: files.length,
        });
        setMediaStatus(`Preparing media ${compressedFiles.length} of ${files.length}...`);
      }
    } catch (error) {
      setMediaPreparationState({
        active: false,
        completed: 0,
        total: files.length,
      });
      setMediaStatus(
        error instanceof Error ? error.message : "Could not optimize that media.",
      );
      return;
    }
    const oversizedVideo = compressedFiles.find(
      (file) =>
        file.type.startsWith("video/") &&
        file.size > maxListingVideoSizeMb * 1024 * 1024,
    );

    if (oversizedVideo) {
      setMediaPreparationState({
        active: false,
        completed: 0,
        total: files.length,
      });
      setMediaStatus(
        `Video ${oversizedVideo.name} is too large. Keep listing videos under ${maxListingVideoSizeMb}MB after optimization.`,
      );
      return;
    }

    const nextMedia = compressedFiles.map((file) => ({
      file,
      id: crypto.randomUUID?.() || `${file.name}-${Date.now()}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      sizeLabel: formatFileSize(file.size),
      type: file.type,
    }));
    setMedia((current) => {
      const updatedMedia = [...current, ...nextMedia];

      syncMediaFiles(updatedMedia);

      return updatedMedia;
    });
    setMediaPreparationState({
      active: false,
      completed: files.length,
      total: files.length,
    });
    setMediaStatus(
      `${nextMedia.length} ${nextMedia.length === 1 ? "media item is" : "media items are"} ready to upload when you save or publish.${
        skippedCount
          ? ` ${skippedCount} ${skippedCount === 1 ? "item was" : "items were"} skipped because the listing media limit is ${maxListingMediaItems}.`
          : ""
      }`,
    );
  }

  function removeMedia(index: number) {
    setMedia((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      syncMediaFiles(next);

      return next;
    });
    setCoverIndex((current) => {
      if (current === index) return 0;
      if (current > index) return current - 1;

      return Math.max(0, Math.min(current, media.length - 2));
    });
  }

  function reorderMedia(fromIndex: number, insertIndex: number) {
    setMedia((current) => {
      const next = moveMediaItem(current, fromIndex, insertIndex);

      if (next !== current) {
        syncMediaFiles(next);
      }

      return next;
    });
    setCoverIndex((current) => {
      return movedMediaIndex(current, media.length, fromIndex, insertIndex);
    });
  }

  function resetForm() {
    media.forEach((item) => {
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setActiveStep(0);
    setDraft(buildInitialDraft(initialDraft));
    setMedia(buildInitialMedia(initialMedia));
    setCoverIndex(initialCoverIndex);
    setImportSummary(null);
    setImportedLocationCandidate(null);
    setMediaUploadState({ active: false, completed: 0, total: 0 });
    setMediaPreparationState({ active: false, completed: 0, total: 0 });
    setMediaStatus("");
    setPublishMessage("");

    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }

    window.localStorage.removeItem(autosaveKey);
    void clearAutosavedMedia(autosaveKey);
  }

  function requestResetForm() {
    setResetDialogOpen(true);
  }

  function submitAfterMediaUpload(intent: "draft" | "published") {
    const triggerId =
      intent === "draft" ? `${formId}-save-draft` : `${formId}-publish`;

    window.setTimeout(() => {
      document.getElementById(triggerId)?.click();
    }, 0);
  }

  async function uploadListingMediaFile(file: File) {
    const formData = new FormData();

    formData.append("file", file, file.name);

    const response = await fetch("/api/listings/media", {
      body: formData,
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          media?: {
            name?: string;
            path?: string;
            size?: number;
            type?: string;
          };
        }
      | null;

    if (!response.ok || !payload?.media?.path) {
      throw new Error(payload?.error || "Homzie could not upload that media.");
    }

    return payload.media;
  }

  async function uploadPendingMediaAndSubmit(intent: "draft" | "published") {
    const pendingMedia = mediaRef.current.filter((item) => item.file);

    if (!pendingMedia.length) {
      submitAfterMediaUpload(intent);
      return;
    }

    setActiveStep(4);
    setPublishMessage("");
    setMediaUploadState({
      active: true,
      completed: 0,
      total: pendingMedia.length,
    });

    try {
      const uploadedMedia = mediaRef.current.map((item) => ({ ...item }));
      let completed = 0;

      for (const item of uploadedMedia) {
        if (!item.file) continue;

        const storedMedia = await uploadListingMediaFile(item.file);

        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }

        item.file = undefined;
        item.name = storedMedia.name || item.name;
        item.path = storedMedia.path;
        item.previewUrl = toPublicMediaUrl(storedMedia.path) || item.previewUrl;
        item.size = storedMedia.size || item.size;
        item.sizeLabel = storedMedia.size ? formatFileSize(storedMedia.size) : "Saved";
        item.type = storedMedia.type || item.type;
        completed += 1;
        setMediaUploadState({
          active: true,
          completed,
          total: pendingMedia.length,
        });
      }

      flushSync(() => {
        mediaRef.current = uploadedMedia;
        setMedia(uploadedMedia);
      });
      syncMediaInputFiles(mediaInputRef.current, uploadedMedia);
      if (mediaInputRef.current) {
        mediaInputRef.current.value = "";
      }
      setMediaUploadState({
        active: false,
        completed: pendingMedia.length,
        total: pendingMedia.length,
      });
      submitAfterMediaUpload(intent);
    } catch (error) {
      setMediaUploadState({
        active: false,
        completed: 0,
        total: pendingMedia.length,
      });
      setPublishMessage(
        error instanceof Error
          ? error.message
          : "Homzie could not upload that listing media. Please try again.",
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;

    if (
      submitter instanceof HTMLButtonElement &&
      submitter.name === "listingAction" &&
      submitter.value === "archive"
    ) {
      return;
    }

    const intent =
      submitter instanceof HTMLButtonElement &&
      submitter.name === "publishIntent" &&
      (submitter.value === "draft" || submitter.value === "published")
        ? submitter.value
        : publishIntent;

    setPublishIntent(intent);

    if (isMediaBusy) {
      event.preventDefault();
      return;
    }

    if (intent !== "published") {
      setPublishMessage("");
      if (uploadMediaCount) {
        event.preventDefault();
        void uploadPendingMediaAndSubmit(intent);
      }
      return;
    }

    const issues = publishIssues;

    if (!issues.length) {
      setPublishMessage("");
      setPublishRequirementsOpen(false);
      if (uploadMediaCount) {
        event.preventDefault();
        void uploadPendingMediaAndSubmit(intent);
      }
      return;
    }

    event.preventDefault();
    setActiveStep(issues[0].step);
    setPublishMessage(
      `Listing incomplete: ${issues.map((issue) => issue.message).join(" ")}`,
    );
    setPublishRequirementsOpen(true);
  }

  if (duplicateListingId) {
    return (
      <ListingDuplicateWarning
        createAnotherPath="/listings/new"
        profileListingsPath={profileListingsPath}
      />
    );
  }

  if (publishedListingId) {
    return (
      <ListingPublishSuccess
        createAnotherPath="/listings/new"
        listingPath={`/listings/${publishedListingId}`}
      />
    );
  }

  const previewImageUrls = media
    .filter(isImageMedia)
    .map((item) => item.previewUrl);
  const existingImportedMediaSources = media
    .map((item) => item.sourceUrl)
    .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl));
  const previewVideoUrls = media
    .filter(isVideoMedia)
    .map((item) => item.previewUrl);
  const videoCount = previewVideoUrls.length;
  const imageCount = media.length - videoCount;
  const selectedCoverMedia = media[coverIndex];
  const previewCover =
    selectedCoverMedia && isImageMedia(selectedCoverMedia)
      ? selectedCoverMedia.previewUrl
      : previewImageUrls[0];

  return (
    <main className="min-h-dvh w-full max-w-full bg-background text-foreground">
      <form
        id={formId}
        action={formAction}
        onSubmit={handleSubmit}
      >
        {mode === "edit" && listingId ? (
          <input type="hidden" name="listingId" value={listingId} />
        ) : null}
        <input
          type="hidden"
          name="existingMedia"
          value={JSON.stringify(
            media
              .filter((item) => item.path)
              .map((item) => ({
                name: item.name,
                path: item.path,
                size: item.size || 0,
                sourceUrl: item.sourceUrl,
                type: item.type || "image/webp",
              })),
          )}
        />
        <input
          type="hidden"
          name="requiresLocationConfirmation"
          value={requiresLocationConfirmation ? "true" : "false"}
        />
        {listingError ? (
          <div className="mx-auto mt-24 w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
              {listingError === "media-upload"
                ? "Homzie could not save that listing media. Please try again."
                : listingError === "publish-validation"
                  ? "Homzie could not publish yet because required listing details are missing. Review the highlighted steps and try again."
                  : listingError === "reservation-validation"
                    ? "Homzie could not save the reservation settings for this listing. Review the mandate and pricing details, then try again."
                    : listingError === "save-failed"
                      ? "Homzie could not save the listing details. Please try again."
                : "Homzie could not publish that listing. Please try again."}
            </div>
          </div>
        ) : null}
        <input type="hidden" name="coverIndex" value={coverIndex} />
        <input type="hidden" name="addressVisibility" value={draft.addressVisibility} />
        <input type="hidden" name="askingPrice" value={draft.askingPrice} />
        <input type="hidden" name="availableFrom" value={draft.availableFrom} />
        <input type="hidden" name="bathrooms" value={draft.bathrooms} />
        <input type="hidden" name="bedrooms" value={draft.bedrooms} />
        <input type="hidden" name="buyerIncentive" value={draft.buyerIncentive} />
        <input type="hidden" name="city" value={draft.city} />
        <input type="hidden" name="country" value={draft.country} />
        <input type="hidden" name="developerName" value={draft.developerName} />
        <input type="hidden" name="description" value={draft.description} />
        <input type="hidden" name="erfSize" value={draft.erfSize} />
        <input type="hidden" name="estateName" value={draft.estateName} />
        {draft.features.map((feature) => (
          <input key={feature} type="hidden" name="features" value={feature} />
        ))}
        <input type="hidden" name="floorSize" value={draft.floorSize} />
        <input type="hidden" name="furnishedStatus" value={draft.furnishedStatus} />
        <input type="hidden" name="garages" value={draft.garages} />
        <input type="hidden" name="grossLettableArea" value={draft.grossLettableArea} />
        <input type="hidden" name="insuranceEstimate" value={draft.insuranceEstimate} />
        <input type="hidden" name="leaseExpiryDate" value={draft.leaseExpiryDate} />
        <input type="hidden" name="listingVisibility" value={draft.listingVisibility} />
        <input type="hidden" name="streetName" value={draft.streetName} />
        <input type="hidden" name="streetNumber" value={draft.streetNumber} />
        <input type="hidden" name="suburb" value={draft.suburb} />
        <input type="hidden" name="postalCode" value={draft.postalCode} />
        <input type="hidden" name="province" value={draft.province} />
        <input type="hidden" name="googlePlaceId" value={draft.googlePlaceId} />
        <input type="hidden" name="googlePlaceData" value={draft.googlePlaceData} />
        <input type="hidden" name="listingType" value={draft.listingType} />
        <input type="hidden" name="location" value={draft.location} />
        <input type="hidden" name="localTaxes" value={draft.localTaxes} />
        <input type="hidden" name="loadingBays" value={draft.loadingBays} />
        <input type="hidden" name="mandateEndDate" value={draft.mandateEndDate} />
        <input
          type="hidden"
          name="mandateStartDate"
          value={draft.mandateStartDate}
        />
        <input type="hidden" name="mandateType" value={draft.mandateType} />
        <input type="hidden" name="communityFees" value={draft.communityFees} />
        <input type="hidden" name="occupancyStatus" value={draft.occupancyStatus} />
        <input type="hidden" name="ownershipType" value={draft.ownershipType} />
        <input type="hidden" name="outbuildings" value={draft.outbuildings} />
        <input type="hidden" name="parking" value={draft.parking} />
        <input type="hidden" name="petsAllowed" value={draft.petsAllowed} />
        <input type="hidden" name="powerSupply" value={draft.powerSupply} />
        <input
          type="hidden"
          name="previousAskingPrice"
          value={draft.previousAskingPrice}
        />
        <input type="hidden" name="priceQualifier" value={draft.priceQualifier} />
        <input type="hidden" name="propertyCategory" value={draft.propertyCategory} />
        <input type="hidden" name="propertyType" value={draft.propertyType} />
        <input type="hidden" name="reservationAmount" value={draft.reservationAmount} />
        <input type="hidden" name="reservationEnabled" value={draft.reservationEnabled ? "on" : ""} />
        <input type="hidden" name="rentalYield" value={draft.rentalYield} />
        <input type="hidden" name="servitudes" value={draft.servitudes} />
        <input type="hidden" name="shortLetAllowed" value={draft.shortLetAllowed} />
        <input type="hidden" name="landSizeHectares" value={draft.landSizeHectares} />
        <input type="hidden" name="storeys" value={draft.storeys} />
        <input type="hidden" name="titleDeedStatus" value={draft.titleDeedStatus} />
        <input type="hidden" name="title" value={draft.title} />
        <input
          type="hidden"
          name="transferCostsEstimate"
          value={draft.transferCostsEstimate}
        />
        <input type="hidden" name="unitCount" value={draft.unitCount} />
        <input type="hidden" name="unitNumber" value={draft.unitNumber} />
        <input type="hidden" name="waterRights" value={draft.waterRights} />
        <input type="hidden" name="contactVisibility" value={draft.contactVisibility} />
        <input type="hidden" name="mandateVisibility" value={draft.mandateVisibility} />
        <input type="hidden" name="occupancyVisibility" value={draft.occupancyVisibility} />
        <input type="hidden" name="previousPriceVisibility" value={draft.previousPriceVisibility} />
        <input type="hidden" name="reservationVisibility" value={draft.reservationVisibility} />
        <input type="hidden" name="utilitiesEstimate" value={draft.utilitiesEstimate} />
        <input type="hidden" name="listingReference" value={draft.listingReference} />
        <input type="hidden" name="zoning" value={draft.zoning} />
        <button
          id={`${formId}-save-draft`}
          className="hidden"
          type="submit"
          name="publishIntent"
          value="draft"
          onClick={() => setPublishIntent("draft")}
        />
        <button
          id={`${formId}-publish`}
          className="hidden"
          type="submit"
          name="publishIntent"
          value="published"
          onClick={() => setPublishIntent("published")}
        />
        <button
          id={`${formId}-update`}
          className="hidden"
          type="submit"
          name="publishIntent"
          value={publishIntent}
          onClick={() => setPublishIntent(publishIntent)}
        />
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          multiple
          className="sr-only"
          onChange={(event) => void handleMediaChange(event)}
        />

        <div className="mx-auto box-border flex w-full max-w-[1180px] min-w-0 flex-col px-6 py-4 sm:px-6 sm:py-8 lg:px-8">
          <PageTopBar
            actions={
              mode === "edit" ? (
                <>
                  {listingHref ? (
                    <Button
                      asChild
                      variant="outline"
                      className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
                    >
                      <Link href={listingHref} replace>Go to listing</Link>
                    </Button>
                  ) : null}
                  <EditSubmitButtons
                    formId={formId}
                    intent={publishIntent}
                    listingId={listingId}
                    onBlockedPublish={openPublishRequirements}
                    publishIssues={publishIssues}
                    isMediaBusy={isMediaBusy}
                    mediaBusyLabel={mediaBusyLabel}
                    setIntent={setPublishIntent}
                  />
                </>
              ) : (
                <SubmitButtons
                  intent={publishIntent}
                  onBlockedPublish={openPublishRequirements}
                  onReset={requestResetForm}
                  publishIssues={publishIssues}
                  isMediaBusy={isMediaBusy}
                  mediaBusyLabel={mediaBusyLabel}
                  setIntent={setPublishIntent}
                />
              )
            }
            mobileActions={
              mode === "edit" ? (
                <>
                  {listingHref ? (
                    <PageTopBarMenuItem
                      onSelect={() => {
                        if (isMediaBusy) return;
                        window.location.replace(listingHref);
                      }}
                    >
                      Go to listing
                    </PageTopBarMenuItem>
                  ) : null}
                  <PageTopBarMenuItem
                    onSelect={() => {
                      if (isMediaBusy) return;
                      if (publishIntent === "published" && publishIssues.length) {
                        openPublishRequirements();
                        return;
                      }
                      setPublishIntent(publishIntent);
                      document.getElementById(`${formId}-update`)?.click();
                    }}
                  >
                    {publishIntent === "draft" ? "Update draft" : "Update listing"}
                  </PageTopBarMenuItem>
                  {publishIntent === "draft" ? (
                    <PageTopBarMenuItem
                      className="text-primary"
                      onSelect={() => {
                        if (isMediaBusy) return;
                        setPublishIntent("published");
                        if (publishIssues.length) {
                          openPublishRequirements();
                          return;
                        }
                        document.getElementById(`${formId}-publish`)?.click();
                      }}
                    >
                      Publish listing
                    </PageTopBarMenuItem>
                  ) : null}
                  <PageTopBarMenuItem
                    className="text-destructive"
                    onSelect={() => {
                      if (isMediaBusy) return;
                      window.setTimeout(() => {
                        document
                          .getElementById(`${formId}-archive-trigger`)
                          ?.click();
                      }, 0);
                    }}
                  >
                    Remove listing
                  </PageTopBarMenuItem>
                </>
              ) : (
                <>
                  <PageTopBarMenuItem
                    onSelect={() => {
                      if (isMediaBusy) return;
                      requestResetForm();
                    }}
                  >
                    Reset form
                  </PageTopBarMenuItem>
                  <PageTopBarMenuItem
                    onSelect={() => {
                      if (isMediaBusy) return;
                      setPublishIntent("draft");
                      document.getElementById(`${formId}-save-draft`)?.click();
                    }}
                  >
                    Save draft
                  </PageTopBarMenuItem>
                  <PageTopBarMenuItem
                    className="text-primary"
                    onSelect={() => {
                      if (isMediaBusy) return;
                      setPublishIntent("published");
                      if (publishIssues.length) {
                        openPublishRequirements();
                        return;
                      }
                      document.getElementById(`${formId}-publish`)?.click();
                    }}
                  >
                    Publish listing
                  </PageTopBarMenuItem>
                </>
              )
            }
          >
            <Link
              href={backHref}
              replace
              className="inline-flex w-fit items-center gap-2 text-sm font-normal text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </PageTopBar>
          {mode === "edit" && listingId ? (
            <span className="hidden">
              <ArchiveListingDialog
                disabled={isMediaBusy}
                formId={formId}
                triggerId={`${formId}-archive-trigger`}
              />
            </span>
          ) : null}
          <PublishRequirementsDialog
            issues={publishIssues}
            onGoToStep={goToPublishIssueStep}
            onOpenChange={setPublishRequirementsOpen}
            open={publishRequirementsOpen}
          />
          <ListingPublishProgress
            imageCount={imageCount}
            intent={publishIntent}
            isUploadingMedia={isUploadingMedia}
            mediaCount={media.length}
            mode={mode}
            uploadedCount={mediaUploadState.completed}
            uploadCount={uploadMediaCount}
            videoCount={videoCount}
          />
          {publishMessage ? (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Listing is not ready to publish yet
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5">
                    {publishIssues.length
                      ? `${publishIssues.length} required item${
                          publishIssues.length === 1 ? "" : "s"
                        } still need attention. Jump straight to the missing fields below.`
                      : publishMessage}
                  </p>
                </div>
              </div>
              {publishIssues.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {publishIssues.slice(0, 3).map((issue) => (
                    <button
                      key={issue.message}
                      type="button"
                      className="rounded-full border border-amber-500/30 bg-background px-3 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                      onClick={() => goToPublishIssueStep(issue.step)}
                    >
                      {issue.message}
                    </button>
                  ))}
                  {publishIssues.length > 3 ? (
                    <button
                      type="button"
                      className="rounded-full border border-amber-500/30 bg-background px-3 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary/40 hover:text-primary"
                      onClick={() => setPublishRequirementsOpen(true)}
                    >
                      View all {publishIssues.length}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {listingUpdateFeedback ? (
            <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {listingUpdateFeedback === "draft"
                ? "Draft updated. Your changes have been saved."
                : listingUpdateFeedback === "published"
                  ? "Listing published. Your listing is now publicly visible."
                  : "Listing updated. Your changes have been saved."}
            </p>
          ) : null}
          {mode === "create" ? (
            <ImportListingFromLinkPanel
              existingImportedMediaSources={existingImportedMediaSources}
              onImported={applyImportedListing}
              summary={importSummary}
            />
          ) : null}
          <ListingStrengthPanel
            items={readinessItems}
            onGoToStep={goToPublishIssueStep}
            strength={listingStrength}
          />

          <Dialog.Root open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none">
                <Dialog.Title className="text-base font-semibold">
                  Reset listing form?
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                  This clears your current listing changes and removes autosaved
                  progress from this browser.
                </Dialog.Description>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Dialog.Close asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      resetForm();
                      setResetDialogOpen(false);
                    }}
                  >
                    Reset form
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <section
            className={cn(
              "mt-5 grid w-full min-w-0 max-w-full gap-4 lg:mt-7 lg:gap-6",
              activeStep === steps.length - 1
                ? "lg:grid-cols-[15rem_minmax(0,1fr)]"
                : "lg:grid-cols-[15rem_minmax(0,1fr)_22rem]",
            )}
          >
            <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <div className="h-fit max-h-[calc(100dvh-7rem)] max-w-full overflow-hidden rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm lg:overflow-y-auto lg:overscroll-contain">
                <div className="relative lg:static">
                  <div
                    ref={stepsScrollerRef}
                    className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] lg:block lg:space-y-1 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
                  >
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === activeStep;
                    const hasPublishIssue = publishIssueSteps.has(index);
                    const isComplete = isListingStepComplete(
                      index,
                      draft,
                      media.length,
                      { requiresLocationConfirmation },
                    );

                    return (
                      <button
                        key={step.label}
                        type="button"
                        className={cn(
                          "flex h-11 min-w-[9rem] shrink-0 items-center gap-2 rounded-md px-3 text-sm font-normal text-muted-foreground transition-colors hover:bg-muted lg:min-w-0 lg:w-full",
                          isActive && "bg-primary/10 text-primary",
                          isComplete && !isActive && "text-foreground",
                          hasPublishIssue &&
                            "text-amber-700 hover:bg-amber-500/10 dark:text-amber-300",
                          hasPublishIssue && isActive && "bg-amber-500/10",
                        )}
                        onClick={() => setActiveStep(index)}
                      >
                        <span
                          className={cn(
                            "grid size-7 place-items-center rounded-full border border-border bg-background",
                            isActive && "border-primary",
                            isComplete && "border-primary bg-primary text-primary-foreground",
                            hasPublishIssue &&
                              "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                          )}
                        >
                          {hasPublishIssue ? (
                            <CircleAlert className="size-4" />
                          ) : isComplete ? (
                            <Check className="size-4" />
                          ) : (
                            <Icon className="size-4" />
                          )}
                        </span>
                        <span className="whitespace-nowrap">{step.label}</span>
                      </button>
                    );
                  })}
                  </div>
                  {stepScrollState.canScrollPrevious ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center rounded-l-lg bg-gradient-to-r from-card via-card/90 to-transparent lg:hidden"
                    >
                      <span className="grid size-7 place-items-center rounded-full border border-border bg-background/95 text-primary shadow-sm">
                        <ChevronLeft className="size-4" />
                      </span>
                    </div>
                  ) : null}
                  {stepScrollState.canScrollNext ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-end rounded-r-lg bg-gradient-to-l from-card via-card/90 to-transparent lg:hidden"
                    >
                      <span className="grid size-7 place-items-center rounded-full border border-border bg-background/95 text-primary shadow-sm">
                        <ChevronRight className="size-4" />
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>

            <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
              {activeStep === steps.length - 1 ? null : (
                <div className="border-b border-border px-5 py-4">
                  <h1 className="text-base font-semibold">
                    {mode === "edit" ? "Edit listing" : "Create listing"}
                  </h1>
                  <p className="mt-1 text-sm font-normal text-muted-foreground">
                    {mode === "edit"
                      ? "Update listing details while keeping the current listing status."
                      : "Build a structured property listing that can be linked to reels and tracked in agent performance."}
                  </p>
                </div>
              )}

              <div className="min-h-[32rem] min-w-0 p-4 sm:p-6">
                {activeStep === 0 ? (
                  <ListingTypeStep
                    availablePropertyCategories={availablePropertyCategories}
                    availablePropertyTypes={availablePropertyTypes}
                    draft={draft}
                    setDraft={setDraft}
                  />
                ) : null}
                {activeStep === 1 ? (
                  <LocationStep
                    key={importedLocationCandidate?.value || "location-step"}
                    draft={draft}
                    importedLocationCandidate={importedLocationCandidate}
                    isLocked={isLocationLocked}
                    isRepairMode={isLocationRepairMode}
                    onImportedLocationResolved={() =>
                      setImportedLocationCandidate(null)
                    }
                    setDraft={setDraft}
                  />
                ) : null}
                {activeStep === 2 ? (
                  <DetailsStep draft={draft} setDraft={setDraft} />
                ) : null}
                {activeStep === 3 ? (
                  <PricingStep draft={draft} setDraft={setDraft} />
                ) : null}
                {activeStep === 4 ? (
                  <MediaStep
                    coverIndex={coverIndex}
                    media={media}
                    mediaPreparationState={mediaPreparationState}
                    mediaStatus={mediaStatus}
                    onOpenFilePicker={() => mediaInputRef.current?.click()}
                    onRemove={removeMedia}
                    onReorder={reorderMedia}
                    isPreparingMedia={isPreparingMedia}
                    setCoverIndex={setCoverIndex}
                  />
                ) : null}
                {activeStep === 5 ? (
                  <MandateStep draft={draft} setDraft={setDraft} />
                ) : null}
                {activeStep === 6 ? (
                  <VisibilityStep draft={draft} setDraft={setDraft} />
                ) : null}
                {activeStep === 7 ? (
                  <PreviewStep
                    activeListingType={activeListingType?.label || "Listing"}
                    activePropertyType={activePropertyType?.label || "Property"}
                    cover={previewCover}
                    draft={draft}
                    imageUrls={previewImageUrls}
                    setDraft={setDraft}
                    videoUrls={previewVideoUrls}
                  />
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-5">
                <Button
                  type="button"
                  variant="outline"
                  disabled={activeStep === 0}
                  onClick={goBack}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                {activeStep < steps.length - 1 ? (
                  <Button type="button" onClick={goNext}>
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type={
                      publishIssues.length &&
                      (mode !== "edit" || publishIntent === "published")
                        ? "button"
                        : "submit"
                    }
                    name="publishIntent"
                    value={mode === "edit" ? publishIntent : "published"}
                    onClick={() => {
                      if (mode !== "edit") {
                        setPublishIntent("published");
                      }

                      if (
                        publishIssues.length &&
                        (mode !== "edit" || publishIntent === "published")
                      ) {
                        openPublishRequirements();
                      }
                    }}
                  >
                    {mode === "edit"
                      ? publishIntent === "draft"
                        ? "Update draft"
                        : "Update listing"
                      : "Publish listing"}
                  </Button>
                )}
              </div>
            </section>

            <aside
              className={cn(
                "hidden lg:sticky lg:top-24 lg:self-start",
                activeStep === steps.length - 1 ? "lg:hidden" : "lg:block",
              )}
            >
              <div className="h-fit max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain">
                <ListingPreview
                  activeListingType={activeListingType?.label || "Listing"}
                  activePropertyType={activePropertyType?.label || "Property"}
                  cover={previewCover}
                  draft={draft}
                  imageUrls={previewImageUrls}
                  videoUrls={previewVideoUrls}
                  profilePath={profilePath}
                />
              </div>
            </aside>
          </section>

          {activeStep === steps.length - 1 ? null : (
            <MobileListingPreviewDialog
              activeListingType={activeListingType?.label || "Listing"}
              activePropertyType={activePropertyType?.label || "Property"}
              cover={previewCover}
              draft={draft}
              imageUrls={previewImageUrls}
              open={previewOpen}
              profilePath={profilePath}
              setOpen={setPreviewOpen}
              videoUrls={previewVideoUrls}
            />
          )}
        </div>
      </form>
    </main>
  );
}

function ListingTypeStep({
  availablePropertyCategories,
  availablePropertyTypes,
  draft,
  setDraft,
}: {
  availablePropertyCategories: typeof propertyCategoryOptions[number][];
  availablePropertyTypes: typeof propertyTypeOptions[number][];
  draft: ListingDraft;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const activeCategory = propertyCategoryOptions.find(
    (option) => option.value === draft.propertyCategory,
  );
  const activeSubtype = propertyTypeOptions.find(
    (option) => option.value === draft.propertyType,
  );

  return (
    <div className="space-y-7">
      <div>
        <h2 className="inline-flex items-center text-base font-semibold">
          What are you listing?
          <RequiredAsterisk />
        </h2>
        <div className="mt-4 grid gap-4">
          <ListingDropdown
            label="Listing intent"
            required
            value={draft.listingType}
            options={listingTypeOptions.map((option) => ({
              description: option.description,
              label: option.label,
              value: option.value,
            }))}
            onChange={(value) => updateDraft(setDraft, "listingType", value)}
          />
          <ListingDropdown
            label="Property category"
            required
            value={draft.propertyCategory}
            options={availablePropertyCategories.map((option) => ({
              description: option.description,
              label: option.label,
              value: option.value,
            }))}
            onChange={(value) => updateDraft(setDraft, "propertyCategory", value)}
          />
          <ListingDropdown
            label="Property subtype"
            required
            value={draft.propertyType}
            options={availablePropertyTypes.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            onChange={(value) => updateDraft(setDraft, "propertyType", value)}
          />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          Selected structure
        </p>
        <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
          <span className="font-semibold text-foreground">
            {activeCategory?.label || "Property"} /{" "}
            {activeSubtype?.label || "Subtype"}
          </span>{" "}
          will tailor the next steps to the right property data, pricing context,
          and mandate details.
        </p>
      </div>
    </div>
  );
}

function LocationStep({
  draft,
  importedLocationCandidate,
  isLocked = false,
  isRepairMode = false,
  onImportedLocationResolved,
  setDraft,
}: {
  draft: ListingDraft;
  importedLocationCandidate?: ImportedLocationCandidate | null;
  isLocked?: boolean;
  isRepairMode?: boolean;
  onImportedLocationResolved?: () => void;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const [query, setQuery] = useState(draft.location);
  const [predictions, setPredictions] = useState<GoogleAutocompletePrediction[]>([]);
  const [importedSuggestion, setImportedSuggestion] =
    useState<ImportedLocationSuggestion | null>(null);
  const [importedSuggestionError, setImportedSuggestionError] = useState("");
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const hasPendingImportedLocation = Boolean(
    importedLocationCandidate &&
      !draft.googlePlaceId &&
      importedLocationCandidate.value.trim() === draft.location.trim(),
  );
  const isResolvingImportedLocation = Boolean(
    hasPendingImportedLocation && !importedSuggestion && !importedSuggestionError,
  );

  useEffect(() => {
    if (!importedLocationCandidate || !hasPendingImportedLocation || isLocked) {
      return;
    }

    let isCurrent = true;

    findImportedLocationSuggestion(importedLocationCandidate.value)
      .then((suggestion) => {
        if (!isCurrent) return;

        setImportedSuggestion(suggestion);
        setImportedSuggestionError(
          suggestion
            ? ""
            : "No strong Google match was found. Search and select the location manually.",
        );
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;

        setImportedSuggestion(null);
        setImportedSuggestionError(
          error instanceof Error
            ? error.message
            : "Could not resolve this imported location.",
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [hasPendingImportedLocation, importedLocationCandidate, isLocked]);

  useEffect(() => {
    let isCurrent = true;
    const timeout = window.setTimeout(() => {
      if (isLocked) {
        setPredictions([]);
        setIsSearching(false);
        return;
      }

      if (query.trim().length < 2) {
        setPredictions([]);
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
              input: query,
              sessionToken,
            },
            (results, status) => {
              if (!isCurrent) return;

              if (status !== places.PlacesServiceStatus.OK || !results?.length) {
                setPredictions([]);
                setIsSearching(false);
                return;
              }

              setPredictions(results.slice(0, 6));
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
  }, [isLocked, query]);

  function updateAddressPart(
    key: "city" | "country" | "postalCode" | "province" | "streetName" | "streetNumber" | "suburb",
    value: string,
  ) {
    setDraft((current) => {
      if (current.googlePlaceId) return { ...current, [key]: value };
      const next = { ...current, [key]: value };
      const street = [next.streetNumber.trim(), next.streetName.trim()].filter(Boolean).join(" ");
      const composed = [street, next.suburb.trim(), next.city.trim(), next.province.trim(), next.country.trim()].filter(Boolean).join(", ");
      return { ...next, googlePlaceData: "", location: composed || current.location };
    });
  }

  function applyLocationSelection({
    formattedAddress,
    option,
    parts,
    place,
  }: ImportedLocationSuggestion) {
    setPredictions([]);
    onImportedLocationResolved?.();
    setDraft((current) => ({
      ...current,
      city: parts.city,
      country: parts.country,
      googlePlaceId: option.place_id,
      googlePlaceData: serializablePlaceData(place, option),
      location: formattedAddress,
      postalCode: parts.postalCode ?? current.postalCode,
      province: parts.province,
      streetName: parts.streetName ?? current.streetName,
      streetNumber: parts.streetNumber ?? current.streetNumber,
      suburb: parts.suburb,
    }));
  }

  async function selectLocation(option: GoogleAutocompletePrediction) {
    let place: GooglePlaceDetails | null = null;

    try {
      place = await getPlaceDetailsForPrediction(option);
    } catch {
      place = null;
    }

    const formattedAddress = place?.formatted_address || option.description;

    applyLocationSelection({
      formattedAddress,
      option,
      parts: placeLocationParts(place || {}, formattedAddress),
      place,
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Location</h2>
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          {isRepairMode
            ? "This published listing has incomplete location data. Fix the missing fields to relock the location after saving."
            : isLocked
              ? "Published listing locations are locked so performance matching cannot be avoided by changing the address."
              : "Search the address, suburb, city, or country. We store this structured so listings can be matched later."}
        </p>
      </div>
      {isRepairMode ? (
        <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
          Location repair mode is active. Complete the address details, then save
          the listing to lock this section again.
        </p>
      ) : null}
      {hasPendingImportedLocation ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                Confirm imported location
              </p>
              <h3 className="mt-2 text-base font-semibold">
                This address was imported and still needs your confirmation.
              </h3>
              <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
                Pick the Google Places match below, or search manually before
                publishing.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Action needed
            </span>
          </div>

          <div className="mt-4 rounded-md border border-border bg-background p-3">
            {isResolvingImportedLocation ? (
              <p className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                Looking for the best Google match
              </p>
            ) : importedSuggestion ? (
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <button
                  type="button"
                  className="flex min-w-0 items-start gap-3 rounded-md text-left"
                  onClick={() => applyLocationSelection(importedSuggestion)}
                >
                  <MapPin className="mt-1 size-4 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {importedSuggestion.option.structured_formatting?.main_text ||
                        importedSuggestion.option.description}
                    </span>
                    <span className="mt-1 block truncate text-xs font-normal text-muted-foreground">
                      {importedSuggestion.formattedAddress}
                    </span>
                  </span>
                </button>
                <Button
                  type="button"
                  className="h-10 whitespace-nowrap"
                  onClick={() => applyLocationSelection(importedSuggestion)}
                >
                  <CheckCircle2 className="size-4" />
                  Use this location
                </Button>
              </div>
            ) : (
              <p className="text-sm font-normal leading-6 text-muted-foreground">
                {importedSuggestionError ||
                  "No Google match has been selected yet. Search below and choose the correct location."}
              </p>
            )}
          </div>
        </div>
      ) : null}
      <div className="block text-sm font-medium">
        <span className="inline-flex items-center">
          Property location
          <RequiredAsterisk />
        </span>
        <input
          name="location"
          value={draft.location}
          onChange={(event) => {
            const value = event.target.value;
            const parts = splitLocation(value);
            setQuery(value);
            onImportedLocationResolved?.();
            setDraft((current) => ({
              ...current,
              city: parts.city,
              country: parts.country,
              googlePlaceId: "",
              googlePlaceData: "",
              location: value,
              province: parts.province,
              suburb: parts.suburb,
            }));
          }}
          placeholder="Start typing an address, city, or country"
          className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          disabled={isLocked}
          required
        />
      </div>
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
              className="flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-background"
              onClick={() => selectLocation(option)}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium">
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
              Searching places
            </p>
          ) : null}
          <p className="px-3 pb-1 pt-2 text-right text-[9px] font-normal uppercase tracking-[0.35em] text-muted-foreground">
            Powered by Google
          </p>
        </div>
      ) : null}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Address details</h3>
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              {draft.googlePlaceId
                ? "Populated from Google — edit any field if needed."
                : "Enter the full address manually."}
            </p>
          </div>
          {draft.googlePlaceId ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              Google matched
            </span>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
              Manual entry
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
            Street number
            <input
              value={draft.streetNumber}
              onChange={(event) => updateAddressPart("streetNumber", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="42"
            />
          </label>
          <label className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center">
              Street name
              {!draft.googlePlaceId ? <RequiredAsterisk /> : null}
            </span>
            <input
              value={draft.streetName}
              onChange={(event) => updateAddressPart("streetName", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="Main Road"
            />
          </label>
          <label className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center">
              Suburb
              {!draft.googlePlaceId ? <RequiredAsterisk /> : null}
            </span>
            <input
              value={draft.suburb}
              onChange={(event) => updateAddressPart("suburb", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="Denneburg"
            />
          </label>
          <label className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center">
              Postal code
              {!draft.googlePlaceId ? <RequiredAsterisk /> : null}
            </span>
            <input
              value={draft.postalCode}
              onChange={(event) => updateAddressPart("postalCode", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="7530"
            />
          </label>
          <label className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center">
              City
              <RequiredAsterisk />
            </span>
            <input
              value={draft.city}
              onChange={(event) => updateAddressPart("city", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="Paarl"
            />
          </label>
          <label className="block text-xs font-normal uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center">
              Province / state
              <RequiredAsterisk />
            </span>
            <input
              value={draft.province}
              onChange={(event) => updateAddressPart("province", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="Western Cape"
            />
          </label>
          <label className="block text-xs font-normal uppercase tracking-wide text-muted-foreground sm:col-span-2">
            <span className="inline-flex items-center">
              Country
              <RequiredAsterisk />
            </span>
            <input
              value={draft.country}
              onChange={(event) => updateAddressPart("country", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="South Africa"
            />
          </label>
        </div>
      </div>
      <label className="block text-sm font-medium">
        Unit / flat number
        <input
          value={draft.unitNumber}
          maxLength={40}
          onChange={(event) =>
            updateDraft(setDraft, "unitNumber", event.target.value.slice(0, 40))
          }
          placeholder="e.g. Flat 4B, Unit 12 (leave blank for free-standing)"
          className="mt-2 h-11 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
        />
      </label>
    </div>
  );
}

function DetailsStep({
  draft,
  setDraft,
}: {
  draft: ListingDraft;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const [customFeature, setCustomFeature] = useState("");
  const [isImprovingDescription, startDescriptionImprovement] = useTransition();
  const [isImprovingTitle, startTitleImprovement] = useTransition();
  const [descriptionImproveMessage, setDescriptionImproveMessage] = useState("");
  const [titleImproveMessage, setTitleImproveMessage] = useState("");
  const [descriptionCooldownSeconds, setDescriptionCooldownSeconds] = useCountdown();
  const [titleCooldownSeconds, setTitleCooldownSeconds] = useCountdown();
  const descriptionText = richTextToPlainText(draft.description);
  const isTitleCoolingDown = titleCooldownSeconds > 0;
  const isDescriptionCoolingDown = descriptionCooldownSeconds > 0;
  const canAddFeature = draft.features.length < maxListingFeatures;
  const isCommercial = commercialPropertyTypes.has(draft.propertyType);
  const isFarm = draft.propertyCategory === "farm";
  const isDevelopment = draft.propertyCategory === "development";
  const isResidential = draft.propertyCategory === "residential";

  function toggleFeature(feature: string) {
    const normalizedFeature = normalizeFeatureInput(feature);

    if (!normalizedFeature) return;

    const isSelected = draft.features.some(
      (item) => item.toLowerCase() === normalizedFeature.toLowerCase(),
    );

    updateDraft(
      setDraft,
      "features",
      isSelected
        ? draft.features.filter(
            (item) => item.toLowerCase() !== normalizedFeature.toLowerCase(),
          )
        : canAddFeature
          ? [...draft.features, normalizedFeature]
          : draft.features,
    );
  }

  function addCustomFeature() {
    const normalizedFeature = normalizeFeatureInput(customFeature);

    if (!normalizedFeature || !canAddFeature) return;

    if (
      draft.features.some(
        (item) => item.toLowerCase() === normalizedFeature.toLowerCase(),
      )
    ) {
      setCustomFeature("");
      return;
    }

    updateDraft(setDraft, "features", [...draft.features, normalizedFeature]);
    setCustomFeature("");
  }

  function improveTitle() {
    const currentTitle = draft.title.trim();

    if (isTitleCoolingDown) return;

    if (currentTitle.length < 4) {
      setTitleImproveMessage("Add a little more title detail first.");
      return;
    }

    setTitleImproveMessage("");
    startTitleImprovement(async () => {
      const result = await improveListingTitle({
        description: descriptionText,
        listingType: draft.listingType,
        location: draft.location,
        propertyType: draft.propertyType,
        title: currentTitle,
      });

      if ("title" in result && result.title) {
        updateDraft(setDraft, "title", result.title);
        setTitleImproveMessage("Title improved. You can still edit it.");
        setTitleCooldownSeconds(aiActionCooldownSeconds);
        return;
      }

      setTitleCooldownSeconds(getCooldownSeconds(result.error));
      setTitleImproveMessage(result.error || "Could not improve the title.");
    });
  }

  function improveDescription() {
    const currentTitle = draft.title.trim();

    if (isDescriptionCoolingDown) return;

    if (currentTitle.length < 4) {
      setDescriptionImproveMessage("Add a listing title first.");
      return;
    }

    setDescriptionImproveMessage("");
    startDescriptionImprovement(async () => {
      const result = await improveListingDescription({
        bathrooms: draft.bathrooms,
        bedrooms: draft.bedrooms,
        description: descriptionText,
        erfSize: draft.erfSize,
        features: draft.features,
        floorSize: draft.floorSize,
        listingType: draft.listingType,
        location: draft.location,
        propertyType: draft.propertyType,
        title: currentTitle,
      });

      if ("description" in result && result.description) {
        updateDraft(setDraft, "description", result.description);
        setDescriptionImproveMessage("Description improved. You can still edit it.");
        setDescriptionCooldownSeconds(aiActionCooldownSeconds);
        return;
      }

      setDescriptionCooldownSeconds(getCooldownSeconds(result.error));
      setDescriptionImproveMessage(
        result.error || "Could not improve the description.",
      );
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Listing details</h2>
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          Keep it scan-friendly. Buyers and renters should understand the listing
          in seconds.
        </p>
      </div>
      <div className="block text-sm font-medium">
        <span className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center">
            Listing title
            <RequiredAsterisk />
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {draft.title.length}/{maxTitleLength}
          </span>
        </span>
        <input
          name="title"
          value={draft.title}
          maxLength={maxTitleLength}
          onChange={(event) =>
            updateDraft(setDraft, "title", event.target.value.slice(0, maxTitleLength))
          }
          placeholder="Ultra modern family home in Paarl"
          className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
          required
        />
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            className={cn(
              "ai-action-button h-10 rounded-md px-3 text-xs font-semibold disabled:opacity-45",
              isImprovingTitle && "is-processing disabled:opacity-100",
              isTitleCoolingDown &&
                "bg-muted text-muted-foreground shadow-none hover:bg-muted disabled:opacity-100 [&_.ai-action-icon]:text-muted-foreground",
            )}
            disabled={
              isImprovingTitle || isTitleCoolingDown || draft.title.trim().length < 4
            }
            onClick={improveTitle}
            type="button"
            aria-live="polite"
          >
            <span className="ai-action-icon">
              <Sparkles className="size-4" />
            </span>
            {isImprovingTitle ? (
              <>
                Polishing
                <span className="ai-action-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </>
            ) : isTitleCoolingDown ? (
              `Available again in ${titleCooldownSeconds}s`
            ) : (
              "Improve title"
            )}
          </Button>
          {titleImproveMessage ? (
            <span
              className={cn(
                "text-xs font-bold",
                getAiResponseClassName(titleImproveMessage),
              )}
            >
              {titleImproveMessage}
            </span>
          ) : null}
        </span>
      </div>
      <div className="block text-sm font-medium">
        <span className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center">
            Description
            <RequiredAsterisk />
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {descriptionText.length}/{maxDescriptionLength}
          </span>
        </span>
        <RichTextEditor
          value={draft.description}
          maxLength={maxDescriptionLength}
          onChange={(value) => updateDraft(setDraft, "description", value)}
          placeholder="Describe the flow, finishes, standout features, and who this property suits."
          className="mt-2"
        />
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            className={cn(
              "ai-action-button h-10 rounded-md px-3 text-xs font-semibold disabled:opacity-45",
              isImprovingDescription && "is-processing disabled:opacity-100",
              isDescriptionCoolingDown &&
                "bg-muted text-muted-foreground shadow-none hover:bg-muted disabled:opacity-100 [&_.ai-action-icon]:text-muted-foreground",
            )}
            disabled={
              isImprovingDescription ||
              isDescriptionCoolingDown ||
              draft.title.trim().length < 4
            }
            onClick={improveDescription}
            type="button"
            aria-live="polite"
          >
            <span className="ai-action-icon">
              <Sparkles className="size-4" />
            </span>
            {isImprovingDescription ? (
              <>
                Writing
                <span className="ai-action-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </>
            ) : isDescriptionCoolingDown ? (
              `Available again in ${descriptionCooldownSeconds}s`
            ) : (
              "Improve description"
            )}
          </Button>
          {descriptionImproveMessage ? (
            <span
              className={cn(
                "text-xs font-bold",
                getAiResponseClassName(descriptionImproveMessage),
              )}
            >
              {descriptionImproveMessage}
            </span>
          ) : null}
        </span>
      </div>
      <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Core property facts
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(
          [
          ["bedrooms", "Bedrooms"],
          ["bathrooms", "Bathrooms"],
          ["garages", "Garages"],
          ["parking", "Parking"],
          ] satisfies Array<
            [
              "bedrooms" | "bathrooms" | "garages" | "parking",
              string,
            ]
          >
        ).map(([key, label]) => (
          <label key={key} className="block text-sm font-medium">
            <span className="inline-flex items-center">
              {label}
              {(key === "bedrooms" || key === "bathrooms") &&
              residentialPropertyTypes.has(draft.propertyType) ? (
                <RequiredAsterisk />
              ) : null}
            </span>
            <input
              name={key}
              value={draft[key]}
              type="text"
              inputMode={key === "bathrooms" ? "decimal" : "numeric"}
              onChange={(event) =>
                updateDraft(
                  setDraft,
                  key,
                  (key === "bathrooms"
                    ? decimalInputValue(event.target.value, 1)
                    : integerInputValue(event.target.value)),
                )
              }
              onBlur={(event) => {
                if (key !== "bathrooms") return;

                updateDraft(
                  setDraft,
                  "bathrooms",
                  steppedDecimalInputValue(event.target.value, 0.5, 1),
                );
              }}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">
          <span className="inline-flex items-center">
            Floor size m²
            {residentialPropertyTypes.has(draft.propertyType) ||
            commercialPropertyTypes.has(draft.propertyType) ? (
              <RequiredAsterisk />
            ) : null}
          </span>
          <input
            name="floorSize"
            value={draft.floorSize}
            type="text"
            inputMode="decimal"
            onChange={(event) =>
              updateDraft(setDraft, "floorSize", decimalInputValue(event.target.value))
            }
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="block text-sm font-medium">
          <span className="inline-flex items-center">
            Erf / land size m²
            {landOnlyPropertyTypes.has(draft.propertyType) ? (
              <RequiredAsterisk />
            ) : null}
          </span>
          <input
            name="erfSize"
            value={draft.erfSize}
            type="text"
            inputMode="decimal"
            onChange={(event) =>
              updateDraft(setDraft, "erfSize", decimalInputValue(event.target.value))
            }
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="block text-sm font-medium">
          Storeys
          <input
            name="storeys"
            value={draft.storeys}
            type="text"
            inputMode="numeric"
            onChange={(event) =>
              updateDraft(setDraft, "storeys", integerInputValue(event.target.value))
            }
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>
      <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Legal and operating details
        </p>
        <div className="mt-4 grid gap-4">
        <ListingDropdown
          label="Ownership"
          value={draft.ownershipType}
          options={ownershipTypeOptions}
          onChange={(value) => updateDraft(setDraft, "ownershipType", value)}
        />
        <ListingDropdown
          label="Title deed status"
          value={draft.titleDeedStatus}
          options={titleDeedStatusOptions}
          onChange={(value) => updateDraft(setDraft, "titleDeedStatus", value)}
        />
        <ListingDropdown
          label="Zoning"
          value={draft.zoning}
          options={zoningOptions}
          onChange={(value) => updateDraft(setDraft, "zoning", value)}
        />
        <label className="block text-sm font-medium">
          Servitudes / restrictions
          <input
            value={draft.servitudes}
            maxLength={180}
            onChange={(event) =>
              updateDraft(setDraft, "servitudes", event.target.value.slice(0, 180))
            }
            placeholder="Access servitude, HOA restrictions, water rights..."
            className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        </div>
      </div>
      {isResidential ? (
        <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Residential context
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm font-medium">
            Estate / complex name
            <input
              value={draft.estateName}
              maxLength={120}
              onChange={(event) =>
                updateDraft(setDraft, "estateName", event.target.value.slice(0, 120))
              }
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>
        </div>
      ) : null}
      {isCommercial ? (
        <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Commercial details
        </p>
        <div className="mt-4 grid gap-4">
          <ListingDropdown
            label="Occupancy"
            value={draft.occupancyStatus}
            options={occupancyStatusOptions}
            onChange={(value) => updateDraft(setDraft, "occupancyStatus", value)}
          />
          <label className="block text-sm font-medium">
            Gross lettable area m²
            <input
              value={draft.grossLettableArea}
              type="text"
              inputMode="decimal"
              onChange={(event) =>
                updateDraft(
                  setDraft,
                  "grossLettableArea",
                  decimalInputValue(event.target.value),
                )
              }
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
          <ListingDropdown
            label="Power supply"
            value={draft.powerSupply}
            options={powerSupplyOptions}
            onChange={(value) => updateDraft(setDraft, "powerSupply", value)}
          />
          <label className="block text-sm font-medium">
            Loading bays
            <input
              value={draft.loadingBays}
              type="text"
              inputMode="numeric"
              onChange={(event) =>
                updateDraft(setDraft, "loadingBays", integerInputValue(event.target.value))
              }
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            Lease expiry
            <DateInput
              name="leaseExpiryDate"
              value={draft.leaseExpiryDate}
              onChange={(value) => updateDraft(setDraft, "leaseExpiryDate", value)}
            />
          </label>
        </div>
        </div>
      ) : null}
      {isFarm ? (
        <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Farm and rural details
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm font-medium">
            Land size hectares
            <input
              value={draft.landSizeHectares}
              type="text"
              inputMode="decimal"
              onChange={(event) =>
                updateDraft(
                  setDraft,
                  "landSizeHectares",
                  decimalInputValue(event.target.value),
                )
              }
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
          <ListingDropdown
            label="Water rights"
            value={draft.waterRights}
            options={yesNoOptions}
            onChange={(value) => updateDraft(setDraft, "waterRights", value)}
          />
          <label className="block text-sm font-medium">
            Outbuildings / infrastructure
            <input
              value={draft.outbuildings}
              maxLength={160}
              onChange={(event) =>
                updateDraft(setDraft, "outbuildings", event.target.value.slice(0, 160))
              }
              placeholder="Sheds, stables, cold rooms, staff housing..."
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>
        </div>
      ) : null}
      {isDevelopment ? (
        <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Development details
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm font-medium">
            Developer name
            <input
              value={draft.developerName}
              maxLength={120}
              onChange={(event) =>
                updateDraft(setDraft, "developerName", event.target.value.slice(0, 120))
              }
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            Unit count
            <input
              value={draft.unitCount}
              type="text"
              inputMode="numeric"
              onChange={(event) =>
                updateDraft(setDraft, "unitCount", integerInputValue(event.target.value))
              }
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
          <ListingDropdown
            label="Availability status"
            value={draft.occupancyStatus}
            options={occupancyStatusOptions}
            onChange={(value) => updateDraft(setDraft, "occupancyStatus", value)}
          />
        </div>
        </div>
      ) : null}
      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Features</p>
          <p className="text-xs font-normal text-muted-foreground">
            {draft.features.length}/{maxListingFeatures}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {featureOptions.map((feature) => {
            const isSelected = draft.features.some(
              (item) => item.toLowerCase() === feature.toLowerCase(),
            );

            return (
              <button
                key={feature}
                type="button"
                disabled={!isSelected && !canAddFeature}
                className={cn(
                  "cursor-pointer rounded-full border border-border px-3 py-2 text-xs font-semibold transition-colors",
                  isSelected && "border-primary bg-primary/10 text-primary",
                  !isSelected &&
                    !canAddFeature &&
                    "cursor-not-allowed opacity-45",
                )}
                onClick={() => toggleFeature(feature)}
              >
                {feature}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Add custom feature</span>
            <input
              value={customFeature}
              maxLength={maxFeatureLength}
              onChange={(event) => setCustomFeature(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomFeature();
                }
              }}
              placeholder="Add custom feature"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={!canAddFeature || !normalizeFeatureInput(customFeature)}
            onClick={addCustomFeature}
          >
            Add
          </Button>
        </div>
        <p className="mt-1 text-xs font-normal text-muted-foreground">
          {customFeature.length}/{maxFeatureLength} characters per feature
        </p>
      </div>
    </div>
  );
}

function PricingStep({
  draft,
  setDraft,
}: {
  draft: ListingDraft;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const { convertFromZarAmount, convertToZarAmount, currency, formatPriceCents } =
    useCurrency();
  const showReducedPrice = isReducedPrice(
    draft.askingPrice,
    draft.previousAskingPrice,
  );
  const askingPricePlaceholder = formatEditableCurrencyValue(
    draft.listingType === "rental" ? "25000" : "4500000",
    convertFromZarAmount,
  );

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Pricing</h2>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Enter the amount buyers should see in the selected currency. Homzie
            handles conversion and storage behind the scenes.
          </p>
        </div>
        <CurrencySelector className="shrink-0 self-start" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          <span className="inline-flex items-center">
            Asking price ({currency})
            <RequiredAsterisk />
          </span>
          <CurrencyAmountInput
            value={draft.askingPrice}
            convertFromZarAmount={convertFromZarAmount}
            convertToZarAmount={convertToZarAmount}
            onValueChange={(value) => updateDraft(setDraft, "askingPrice", value)}
            placeholder={askingPricePlaceholder}
            className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            Previous price ({currency})
            <AnalyticsInfoPopover
              title="Previous price"
              description="Use this when the listing has been reduced. It only appears as Reduced from when it is higher than the asking price."
            />
          </span>
          <CurrencyAmountInput
            value={draft.previousAskingPrice}
            convertFromZarAmount={convertFromZarAmount}
            convertToZarAmount={convertToZarAmount}
            onValueChange={(value) =>
              updateDraft(setDraft, "previousAskingPrice", value)
            }
            placeholder="Optional"
            className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        <ListingDropdown
          label="Price label"
          description="Optional text shown before the price, such as From, Offers from, or Guide price."
          value={draft.priceQualifier}
          options={priceQualifierOptions}
          onChange={(value) => updateDraft(setDraft, "priceQualifier", value)}
        />
        <label className="block text-sm font-medium sm:col-span-2">
          <span className="inline-flex items-center gap-1.5">
            Buyer incentive badge
            <AnalyticsInfoPopover
              title="Buyer incentive"
              description="Optional buyer-facing badge such as No transfer duty, VAT included, Seller pays transfer costs, or Move-in ready."
            />
          </span>
          <input
            value={draft.buyerIncentive}
            maxLength={40}
            onChange={(event) =>
              updateDraft(setDraft, "buyerIncentive", event.target.value)
            }
            placeholder="No transfer duty"
            className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>
      {draft.listingType === "rental" ? (
        <label className="block text-sm font-medium">
          Available from
          <DateInput
            name="availableFrom"
            value={draft.availableFrom}
            onChange={(value) => updateDraft(setDraft, "availableFrom", value)}
          />
        </label>
      ) : null}
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h3 className="text-sm font-medium">Ownership costs</h3>
        <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
          Use local equivalents such as rates and taxes, levies, HOA, strata or
          building fees. These help buyers understand the real monthly cost.
        </p>
        <div className="mt-4 grid gap-4">
          <ListingCostInput
            convertFromZarAmount={convertFromZarAmount}
            convertToZarAmount={convertToZarAmount}
            currency={currency}
            description="Recurring local government or municipal charges associated with owning the property. In South Africa this is usually rates and taxes."
            draftKey="localTaxes"
            label="Local taxes"
            placeholder="1,500.50"
            setDraft={setDraft}
            value={draft.localTaxes}
          />
          <ListingCostInput
            convertFromZarAmount={convertFromZarAmount}
            convertToZarAmount={convertToZarAmount}
            currency={currency}
            description="Recurring body corporate, HOA, estate, strata, levy or community charges paid by the owner or occupant."
            draftKey="communityFees"
            label="Community fees"
            placeholder="2,500"
            setDraft={setDraft}
            value={draft.communityFees}
          />
          <ListingCostInput
            convertFromZarAmount={convertFromZarAmount}
            convertToZarAmount={convertToZarAmount}
            currency={currency}
            description="Estimated monthly utilities such as electricity, water, refuse, gas, internet or other recurring services."
            draftKey="utilitiesEstimate"
            label="Utilities estimate"
            setDraft={setDraft}
            value={draft.utilitiesEstimate}
          />
          <ListingCostInput
            convertFromZarAmount={convertFromZarAmount}
            convertToZarAmount={convertToZarAmount}
            currency={currency}
            description="Estimated property insurance or building cover cost where it is useful for buyers to budget ownership costs."
            draftKey="insuranceEstimate"
            label="Insurance estimate"
            setDraft={setDraft}
            value={draft.insuranceEstimate}
          />
          <ListingCostInput
            convertFromZarAmount={convertFromZarAmount}
            convertToZarAmount={convertToZarAmount}
            currency={currency}
            description="Estimated once-off transfer, registration or closing costs. Use the local equivalent for the listing market."
            draftKey="transferCostsEstimate"
            label="Transfer costs estimate"
            setDraft={setDraft}
            value={draft.transferCostsEstimate}
          />
          <label className="block text-sm font-medium">
            <span className="inline-flex items-center gap-1.5">
              Rental yield estimate (%)
              <AnalyticsInfoPopover
                title="Rental yield estimate"
                description="Estimated annual rental return as a percentage of the purchase price for buyers comparing rental potential."
              />
            </span>
            <input
              value={draft.rentalYield}
              type="text"
              inputMode="decimal"
              onChange={(event) =>
                updateDraft(
                  setDraft,
                  "rentalYield",
                  decimalInputValue(event.target.value),
                )
              }
              placeholder="Optional"
              className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h3 className="text-sm font-medium">Availability and rules</h3>
        <div className="mt-4 grid gap-4">
          {draft.listingType !== "rental" ? (
            <label className="block text-sm font-medium">
              <span className="inline-flex items-center gap-1.5">
                Occupation / available date
              <AnalyticsInfoPopover
                  title="Occupation / available date"
                  description="The earliest date the buyer or tenant can take occupation, if known."
                />
              </span>
              <DateInput
                name="availableFrom"
                value={draft.availableFrom}
                onChange={(value) => updateDraft(setDraft, "availableFrom", value)}
              />
            </label>
          ) : null}
          {draft.propertyCategory === "residential" || draft.propertyCategory === "development" ? (
            <>
              <ListingSelect
                description="Whether the property is offered with furniture included. Leave unspecified if this has not been confirmed."
                draftKey="furnishedStatus"
                label="Furnished"
                setDraft={setDraft}
                value={draft.furnishedStatus}
              />
              <ListingSelect
                description="Whether pets are permitted by the owner, body corporate, HOA or applicable property rules."
                draftKey="petsAllowed"
                label="Pets allowed"
                setDraft={setDraft}
                value={draft.petsAllowed}
              />
              <ListingSelect
                description="Whether the property can be used for short-term letting or holiday rentals where local rules allow it."
                draftKey="shortLetAllowed"
                label="Short-let allowed"
                setDraft={setDraft}
                value={draft.shortLetAllowed}
              />
            </>
          ) : null}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        {draft.priceQualifier ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {draft.priceQualifier}
          </p>
        ) : null}
        <p className={draft.priceQualifier ? "mt-1 text-2xl font-semibold" : "text-2xl font-semibold"}>
          {formatListingPrice(
            draft.askingPrice,
            draft.listingType,
            formatPriceCents,
          )}
        </p>
        {showReducedPrice ? (
          <p className="mt-1 text-sm font-medium text-red-600">
            Reduced from{" "}
            <span className="text-muted-foreground line-through">
              {formatListingPrice(
                draft.previousAskingPrice,
                draft.listingType,
                formatPriceCents,
              )}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MediaStep({
  coverIndex,
  isPreparingMedia,
  media,
  mediaPreparationState,
  mediaStatus,
  onOpenFilePicker,
  onRemove,
  onReorder,
  setCoverIndex,
}: {
  coverIndex: number;
  isPreparingMedia?: boolean;
  media: ListingFormMedia[];
  mediaPreparationState: MediaPreparationState;
  mediaStatus: string;
  onOpenFilePicker: () => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  setCoverIndex: (index: number) => void;
}) {
  const videoCount = media.filter(isVideoMedia).length;
  const imageCount = media.length - videoCount;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Media</h2>
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          Upload up to {maxListingMediaItems} photos or videos. Photos are optimized
          before saving. Videos are limited to 90 seconds and {maxListingVideoSizeMb}MB
          after optimization.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
            {media.length}/{maxListingMediaItems} total
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
            {imageCount} {imageCount === 1 ? "image" : "images"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
            {videoCount} {videoCount === 1 ? "video" : "videos"}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={cn(
          "flex min-h-44 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center transition-colors hover:bg-primary/10",
          isPreparingMedia && "cursor-wait opacity-75",
        )}
        disabled={isPreparingMedia}
        onClick={onOpenFilePicker}
      >
        {isPreparingMedia ? (
          <LoaderCircle className="size-8 animate-spin text-primary" />
        ) : (
          <ImagePlus className="size-8 text-primary" />
        )}
        <span className="mt-3 inline-flex items-center text-sm font-medium">
          {isPreparingMedia ? "Preparing media" : "Upload listing media"}
          {!isPreparingMedia ? <RequiredAsterisk /> : null}
        </span>
        <span className="mt-1 text-xs font-normal text-muted-foreground">
          {isPreparingMedia
            ? "Optimizing files and creating previews."
            : "Choose photos or video. Select a photo as the cover when possible."}
        </span>
      </button>
      <MediaPreparationStatus
        state={mediaPreparationState}
        status={mediaStatus}
      />
      {media.length ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-normal leading-5 text-muted-foreground">
              Drag media to reorder. The cover image appears first on cards and detail pages.
            </p>
            <MediaArrangementDialog
              coverIndex={coverIndex}
              disabled={isPreparingMedia}
              media={media}
              onRemove={onRemove}
              onReorder={onReorder}
              setCoverIndex={setCoverIndex}
            />
          </div>
          <MediaGrid
            coverIndex={coverIndex}
            media={media}
            onRemove={onRemove}
            onReorder={onReorder}
            setCoverIndex={setCoverIndex}
          />
        </div>
      ) : null}
    </div>
  );
}

function MediaPreparationStatus({
  state,
  status,
}: {
  state: MediaPreparationState;
  status: string;
}) {
  if (!state.active && !status) return null;

  const isError = /^(could not|video|you can add)/i.test(status);
  const progress = state.total
    ? Math.max(8, Math.min(100, (state.completed / state.total) * 100))
    : state.active
      ? 12
      : 100;
  const Icon = state.active ? LoaderCircle : isError ? CircleAlert : CheckCircle2;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-lg border p-3 text-sm",
        isError
          ? "border-destructive/25 bg-destructive/10 text-destructive"
          : "border-primary/25 bg-primary/5 text-foreground",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
            isError ? "bg-destructive/10" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className={cn("size-4", state.active && "animate-spin")} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {status ||
              `Preparing media ${Math.min(state.completed, state.total)} of ${state.total}`}
          </p>
          {state.active && state.total ? (
            <p className="mt-1 text-xs font-normal text-muted-foreground">
              {Math.min(state.completed, state.total)} of {state.total} files prepared
            </p>
          ) : null}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <span
              className={cn(
                "block h-full rounded-full transition-[width] duration-300 ease-out",
                isError ? "bg-destructive" : "bg-[image:var(--homzie-gradient)]",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaArrangementDialog({
  coverIndex,
  disabled,
  media,
  onRemove,
  onReorder,
  setCoverIndex,
}: {
  coverIndex: number;
  disabled?: boolean;
  media: ListingFormMedia[];
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  setCoverIndex: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0 px-3 text-xs sm:text-sm"
          disabled={disabled}
        >
          <Grip className="size-4" />
          Arrange media
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] flex max-h-[min(44rem,calc(100dvh-2rem))] w-[min(calc(100vw-2rem),72rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <Dialog.Title className="text-base font-semibold">
                Arrange media
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-normal text-muted-foreground">
                Drag cards to reorder, choose a cover image, or remove media from the listing.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Close media arrangement"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 overflow-y-auto p-5">
            <MediaGrid
              coverIndex={coverIndex}
              gridClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              media={media}
              onRemove={onRemove}
              onReorder={onReorder}
              setCoverIndex={setCoverIndex}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MediaGrid({
  coverIndex,
  gridClassName,
  media,
  onRemove,
  onReorder,
  setCoverIndex,
}: {
  coverIndex: number;
  gridClassName?: string;
  media: ListingFormMedia[];
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  setCoverIndex: (index: number) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "before" | "after";
  } | null>(null);

  function dropPositionForEvent(event: DragEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    return event.clientX < rect.left + rect.width / 2 ? "before" : "after";
  }

  function insertIndexForDrop(index: number, position: "before" | "after") {
    return position === "before" ? index : index + 1;
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", gridClassName)}>
      {media.map((item, index) => (
        <div
          key={item.id}
          draggable
          className={cn(
            "group relative cursor-grab overflow-hidden rounded-lg border border-border bg-muted transition-all active:cursor-grabbing",
            draggedIndex === index && "scale-[0.98] opacity-60",
            coverIndex === index && "ring-2 ring-primary",
          )}
          onDragStart={(event) => {
            setDraggedIndex(index);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(index));
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropTarget({
              index,
              position: dropPositionForEvent(event),
            });
          }}
          onDrop={(event) => {
            event.preventDefault();
            const fromIndex = Number(event.dataTransfer.getData("text/plain"));
            const position = dropPositionForEvent(event);

            if (Number.isFinite(fromIndex)) {
              onReorder(fromIndex, insertIndexForDrop(index, position));
            }

            setDraggedIndex(null);
            setDropTarget(null);
          }}
          onDragLeave={() => {
            setDropTarget((current) =>
              current?.index === index ? null : current,
            );
          }}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDropTarget(null);
          }}
        >
          {dropTarget?.index === index && draggedIndex !== index ? (
            <span
              className={cn(
                "pointer-events-none absolute inset-y-2 z-20 w-1 rounded-full bg-primary shadow-lg shadow-primary/30",
                dropTarget.position === "before" ? "left-1" : "right-1",
              )}
            />
          ) : null}
          {isVideoMedia(item) ? (
            <div className="relative aspect-[4/3] w-full bg-black">
              <video
                src={item.previewUrl}
                className="size-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
              <span className="absolute inset-0 grid place-items-center bg-black/15 text-white">
                <Play className="size-7 fill-white" />
              </span>
            </div>
          ) : (
            <Image
              src={item.previewUrl}
              alt={item.name}
              width={320}
              height={240}
              className="aspect-[4/3] w-full object-cover"
            />
          )}
          <div className="absolute left-2 top-2 inline-flex h-7 items-center gap-1 rounded-full bg-background/90 px-2 text-foreground shadow-sm">
            <span className="min-w-3 text-center text-[10px] font-bold leading-none">
              {index + 1}
            </span>
            <Grip className="size-3.5" aria-hidden="true" />
          </div>
          {coverIndex === index ? (
            <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground shadow-sm">
              Cover
            </span>
          ) : (
            <button
              type="button"
              className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background hover:text-primary"
              onClick={() => setCoverIndex(index)}
              aria-label="Set as cover image"
              title="Set as cover"
            >
              <ImagePlus className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background hover:text-destructive"
            onClick={() => onRemove(index)}
            aria-label="Remove media"
            title="Remove media"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function MandateStep({
  draft,
  setDraft,
}: {
  draft: ListingDraft;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const allowedMandateValues = mandateOptionsForListingType(draft.listingType);
  const filteredMandateOptions = mandateTypeOptions.filter((o) =>
    allowedMandateValues.includes(o.value),
  );
  const selectedMandate = filteredMandateOptions.find(
    (option) => option.value === draft.mandateType,
  );

  useEffect(() => {
    if (!filteredMandateOptions.length || selectedMandate) return;

    updateDraft(setDraft, "mandateType", filteredMandateOptions[0].value);
  }, [filteredMandateOptions, selectedMandate, setDraft]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Mandate and status</h2>
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          Mandate history feeds the performance system, so we store it clearly
          from the start.
        </p>
      </div>
      <div>
        <ListingDropdown
          label="Mandate type"
          required
          value={draft.mandateType}
          options={filteredMandateOptions.map((option) => ({
            description: option.description,
            label: option.label,
            value: option.value,
          }))}
          onChange={(value) => updateDraft(setDraft, "mandateType", value)}
        />
        {selectedMandate ? (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-border bg-muted/25 p-4 text-sm font-normal leading-6 text-muted-foreground">
            <AnalyticsInfoPopover
              title={selectedMandate.label}
              description={selectedMandate.description}
              className="mt-0.5 shrink-0"
            />
            <p>{selectedMandate.description}</p>
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Mandate start
          <DateInput
            name="mandateStartDate"
            value={draft.mandateStartDate}
            onChange={(value) => updateDraft(setDraft, "mandateStartDate", value)}
          />
        </label>
        <label className="block text-sm font-medium">
          Mandate end
          <DateInput
            name="mandateEndDate"
            value={draft.mandateEndDate}
            onChange={(value) => updateDraft(setDraft, "mandateEndDate", value)}
          />
        </label>
      </div>
      <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Your reference
        </p>
        <label className="mt-4 block text-sm font-medium">
          <span className="inline-flex items-center gap-1.5">
            Listing reference
            <AnalyticsInfoPopover
              title="Listing reference"
              description="Your own internal reference or CRM number for this listing. Only visible to you."
            />
          </span>
          <input
            value={draft.listingReference}
            maxLength={80}
            onChange={(event) =>
              updateDraft(setDraft, "listingReference", event.target.value.slice(0, 80))
            }
            placeholder="e.g. REF-2024-001 or your CRM number"
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-4 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>
      {draft.propertyCategory === "development" ? (
      <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Reservation deposit
        </p>
        <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
          Set a deposit amount buyers can place to reserve a unit in this development.
          Reservation checkout activates when enabled by the platform.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Reservation amount (ZAR)
            <CurrencyAmountInput
              value={draft.reservationAmount}
              convertFromZarAmount={(amount) => amount}
              convertToZarAmount={(amount) => amount}
              onValueChange={(value) =>
                updateDraft(setDraft, "reservationAmount", value)
              }
              placeholder="5,000"
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
            />
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40 sm:mt-6">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={draft.reservationEnabled}
              onChange={(event) =>
                updateDraft(setDraft, "reservationEnabled", event.target.checked)
              }
            />
            <span>
              Enable reservation
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Allow buyers to place a deposit to reserve this listing.
              </span>
            </span>
          </label>
        </div>
      </div>
      ) : null}
      <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm font-normal leading-6 text-muted-foreground">
        Listings cannot simply disappear from performance history after outcomes
        are recorded. Drafts stay private; published listings can be linked to
        reels and future sale outcomes.
      </div>
    </div>
  );
}

function ListingVisibilityControls({
  draft,
  setDraft,
}: {
  draft: ListingDraft;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  return (
    <section className="grid gap-4">
        <ListingDropdown
          description="Choose whether this listing appears broadly or only through your profile and shared links."
          label="Listing visibility"
          options={listingVisibilityOptions}
          value={draft.listingVisibility}
          onChange={(value) => updateDraft(setDraft, "listingVisibility", value)}
        />
        <ListingDropdown
          description="Show exact addresses only when you are comfortable exposing them publicly."
          label="Address visibility"
          options={addressVisibilityOptions}
          value={draft.addressVisibility}
          onChange={(value) => updateDraft(setDraft, "addressVisibility", value)}
        />
        <ListingDropdown
          description="Contact actions can stay visible while direct email and phone details are hidden."
          label="Contact visibility"
          options={contactVisibilityOptions}
          value={draft.contactVisibility}
          onChange={(value) => updateDraft(setDraft, "contactVisibility", value)}
        />
        <ListingDropdown
          description="Hide mandate type and expiry dates from the public card to prevent competitors from timing a poach."
          label="Mandate visibility"
          options={fieldVisibilityOptions}
          value={draft.mandateVisibility}
          onChange={(value) => updateDraft(setDraft, "mandateVisibility", value)}
        />
        <ListingDropdown
          description="Hide the original asking price to protect the seller's negotiating position."
          label="Previous price visibility"
          options={fieldVisibilityOptions}
          value={draft.previousPriceVisibility}
          onChange={(value) => updateDraft(setDraft, "previousPriceVisibility", value)}
        />
        <ListingDropdown
          description="Hide the occupation and availability date from the public listing to protect homeowner privacy."
          label="Availability date visibility"
          options={fieldVisibilityOptions}
          value={draft.occupancyVisibility}
          onChange={(value) => updateDraft(setDraft, "occupancyVisibility", value)}
        />
        {draft.propertyCategory === "development" ? (
          <ListingDropdown
            description="Hide the reservation deposit amount from buyers until they are engaged directly."
            label="Reservation amount visibility"
            options={fieldVisibilityOptions}
            value={draft.reservationVisibility}
            onChange={(value) => updateDraft(setDraft, "reservationVisibility", value)}
          />
        ) : null}
    </section>
  );
}

function VisibilityStep({
  draft,
  setDraft,
}: {
  draft: ListingDraft;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Visibility settings</h2>
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          Control what buyers and competitors can see on the public listing.
        </p>
      </div>
      <ListingVisibilityControls draft={draft} setDraft={setDraft} />
    </div>
  );
}

function PreviewStep(props: {
  activeListingType: string;
  activePropertyType: string;
  cover?: string;
  draft: ListingDraft;
  imageUrls?: string[];
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
  videoUrls?: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Preview and publish</h2>
        <p className="mt-1 text-sm font-normal text-muted-foreground">
          Check how your listing will appear to buyers before publishing.
        </p>
      </div>
      <ListingPreview {...props} profilePath="" />
    </div>
  );
}

function MobileListingPreviewDialog({
  activeListingType,
  activePropertyType,
  cover,
  draft,
  open,
  profilePath,
  setOpen,
  imageUrls,
  videoUrls,
}: {
  activeListingType: string;
  activePropertyType: string;
  cover?: string;
  draft: ListingDraft;
  open: boolean;
  profilePath: string;
  setOpen: (open: boolean) => void;
  imageUrls?: string[];
  videoUrls?: string[];
}) {
  const [buttonPosition, setButtonPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const dragStateRef = useRef<{
    height: number;
    isDragging: boolean;
    left: number;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    top: number;
    width: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  function handlePreviewPointerDown(event: PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    dragStateRef.current = {
      height: rect.height,
      isDragging: true,
      left: rect.left,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      top: rect.top,
      width: rect.width,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePreviewPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;

    if (!dragState?.isDragging || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      dragState.moved = true;
      suppressNextClickRef.current = true;
    }

    if (!dragState.moved) return;

    const padding = 12;
    const maxLeft = window.innerWidth - dragState.width - padding;
    const maxTop = window.innerHeight - dragState.height - padding;

    setButtonPosition({
      left: Math.min(Math.max(padding, dragState.left + deltaX), maxLeft),
      top: Math.min(Math.max(padding, dragState.top + deltaY), maxTop),
    });
  }

  function handlePreviewPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId === event.pointerId) {
      dragState.isDragging = false;
      dragStateRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="listing-preview-fab fixed bottom-24 right-3 z-40 grid size-14 max-w-[calc(100vw-1.5rem)] touch-none place-items-center rounded-full bg-[linear-gradient(135deg,#5b34ff,#f044b7)] text-white shadow-[0_16px_35px_rgba(124,92,255,0.35)] ring-4 ring-background lg:hidden"
          aria-label="Open listing preview"
          onClick={(event) => {
            if (!suppressNextClickRef.current) return;

            event.preventDefault();
            suppressNextClickRef.current = false;
          }}
          onPointerDown={handlePreviewPointerDown}
          onPointerMove={handlePreviewPointerMove}
          onPointerUp={handlePreviewPointerUp}
          onPointerCancel={handlePreviewPointerUp}
          style={
            buttonPosition
              ? {
                  bottom: "auto",
                  left: buttonPosition.left,
                  right: "auto",
                  top: buttonPosition.top,
                }
              : undefined
          }
        >
          <House className="relative z-10 size-5" />
          <span className="absolute right-1.5 top-1.5 z-20 grid size-4 place-items-center rounded-full border border-border bg-background text-primary shadow-md">
            <Grip className="size-2.5" />
          </span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm lg:hidden" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[88dvh] overflow-y-auto rounded-2xl border border-border bg-background p-4 text-foreground shadow-2xl outline-none lg:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold">
                Listing preview
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs font-normal text-muted-foreground">
                Check how this listing card is shaping up.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-foreground"
                aria-label="Close listing preview"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          <ListingPreview
            activeListingType={activeListingType}
            activePropertyType={activePropertyType}
                cover={cover}
                draft={draft}
                imageUrls={imageUrls}
                profilePath={profilePath}
                videoUrls={videoUrls}
              />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ListingPreview({
  activeListingType,
  activePropertyType,
  cover,
  draft,
  imageUrls,
  videoUrls,
  profilePath,
}: {
  activeListingType: string;
  activePropertyType: string;
  cover?: string;
  draft: ListingDraft;
  imageUrls?: string[];
  videoUrls?: string[];
  profilePath: string;
}) {
  const priceAmount = Number(draft.askingPrice);
  const previousPriceAmount = Number(draft.previousAskingPrice);
  const listing: ListingCardData = {
    bathrooms: draft.bathrooms,
    bedrooms: draft.bedrooms,
    buyerIncentive: draft.buyerIncentive,
    coverImageUrl: cover,
    erfSize: draft.erfSize,
    features: draft.features,
    floorSize: draft.floorSize,
    footerText: profilePath ? `Publishes to ${profilePath}` : undefined,
    garages: draft.garages,
    grossLettableArea: draft.grossLettableArea,
    isPrivate: draft.listingVisibility === "profile_private",
    imageUrls,
    landSizeHectares: draft.landSizeHectares,
    listingType: draft.listingType,
    listingTypeLabel: activeListingType,
    location:
      draft.addressVisibility === "area"
        ? [draft.suburb, draft.city, draft.country].filter(Boolean).join(", ") || draft.location
        : draft.location,
    mandateEndDate: draft.mandateVisibility === "hide" ? undefined : draft.mandateEndDate,
    mandateStartDate: draft.mandateVisibility === "hide" ? undefined : draft.mandateStartDate,
    mandateType: draft.mandateVisibility === "hide" ? null : draft.mandateType,
    loadingBays: draft.loadingBays,
    parking: draft.parking,
    previousPriceCents:
      draft.previousPriceVisibility === "hide"
        ? null
        : Number.isFinite(previousPriceAmount) && previousPriceAmount > 0
          ? Math.round(previousPriceAmount * 100)
          : null,
    priceCents:
      Number.isFinite(priceAmount) && priceAmount > 0
        ? Math.round(priceAmount * 100)
        : null,
    pricePrefix: draft.priceQualifier,
    propertyCategory: draft.propertyCategory,
    propertyTypeLabel: activePropertyType,
    title: draft.title,
    videoUrls,
  };

  return <ListingCard listing={listing} />;
}
