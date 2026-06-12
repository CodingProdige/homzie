"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import {
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type PointerEvent,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { useFormStatus } from "react-dom";
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
  CircleAlert,
  CircleDollarSign,
  Grip,
  House,
  ImagePlus,
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
  improveListingDescription,
  improveListingTitle,
  updateListing,
} from "@/modules/listings/actions";
import { toPublicMediaUrl } from "@/media/paths";
import {
  featureOptions,
  listingTypeOptions,
  mandateTypeOptions,
  propertyTypeOptions,
  type ListingType,
  type PropertyType,
} from "@/modules/listings/options";

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
  type?: string;
};

type ListingAutosaveMedia = Omit<ListingFormMedia, "previewUrl">;

type ListingAutosaveState = {
  activeStep: number;
  coverIndex: number;
  draft: ListingDraft;
  savedAt: number;
  version: 1;
};

export type ListingDraft = {
  askingPrice: string;
  availableFrom: string;
  bathrooms: string;
  bedrooms: string;
  buyerIncentive: string;
  city: string;
  country: string;
  description: string;
  erfSize: string;
  features: string[];
  floorSize: string;
  furnishedStatus: string;
  garages: string;
  googlePlaceId: string;
  googlePlaceData: string;
  insuranceEstimate: string;
  listingType: ListingType;
  location: string;
  localTaxes: string;
  mandateEndDate: string;
  mandateStartDate: string;
  mandateType: string;
  communityFees: string;
  parking: string;
  petsAllowed: string;
  previousAskingPrice: string;
  priceQualifier: string;
  propertyType: PropertyType;
  province: string;
  reservationAmount: string;
  reservationEnabled: boolean;
  rentalYield: string;
  shortLetAllowed: string;
  suburb: string;
  title: string;
  transferCostsEstimate: string;
  utilitiesEstimate: string;
};

export type ListingFormInitialMedia = {
  name?: string;
  path: string;
  size?: number;
  type?: string;
};

const steps = [
  { icon: Sparkles, label: "Type" },
  { icon: MapPin, label: "Location" },
  { icon: BedDouble, label: "Details" },
  { icon: CircleDollarSign, label: "Pricing" },
  { icon: Camera, label: "Media" },
  { icon: ShieldCheck, label: "Mandate" },
  { icon: BadgeCheck, label: "Preview" },
];
const googleMapsScriptId = "homzie-google-maps-places";
const maxImageDimension = 2200;
const imageQuality = 0.82;
const maxDescriptionLength = 3000;
const maxTitleLength = 120;
const maxListingImages = 30;
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
const listingAutosavePrefix = "homzie:listings:autosave";
const listingAutosaveDbName = "homzie-listing-autosave";
const listingAutosaveStoreName = "listing-form-media";

const initialDraft: ListingDraft = {
  askingPrice: "",
  availableFrom: "",
  bathrooms: "",
  bedrooms: "",
  buyerIncentive: "",
  city: "",
  country: "",
  description: "",
  erfSize: "",
  features: [],
  floorSize: "",
  furnishedStatus: "",
  garages: "",
  googlePlaceId: "",
  googlePlaceData: "",
  insuranceEstimate: "",
  listingType: "sale",
  location: "",
  localTaxes: "",
  mandateEndDate: "",
  mandateStartDate: "",
  mandateType: "open",
  communityFees: "",
  parking: "",
  petsAllowed: "",
  previousAskingPrice: "",
  priceQualifier: "",
  propertyType: "free_standing_house",
  province: "",
  reservationAmount: "",
  reservationEnabled: false,
  rentalYield: "",
  shortLetAllowed: "",
  suburb: "",
  title: "",
  transferCostsEstimate: "",
  utilitiesEstimate: "",
};

function buildInitialDraft(value?: Partial<ListingDraft>) {
  const draft = { ...initialDraft, ...value };

  return {
    ...draft,
    features: draft.features.slice(0, maxListingFeatures).map(normalizeFeatureInput),
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
  return media.map(({ file, id, name, path, size, sizeLabel, type }) => ({
    file,
    id,
    name,
    path,
    size,
    sizeLabel,
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

function getPublishIssues(draft: ListingDraft, mediaCount: number) {
  const issues: Array<{ message: string; step: number }> = [];

  if (!draft.listingType) {
    issues.push({ message: "Choose whether this listing is for sale or rent.", step: 0 });
  }

  if (!draft.propertyType) {
    issues.push({ message: "Choose the property type.", step: 0 });
  }

  if (draft.title.trim().length < 4) {
    issues.push({ message: "Add a listing title.", step: 2 });
  }

  if (draft.location.trim().length < 2) {
    issues.push({ message: "Add the property location.", step: 1 });
  }

  if (!draft.city.trim() || !draft.province.trim() || !draft.country.trim()) {
    issues.push({ message: "Add city, province, and country.", step: 1 });
  }

  if (richTextToPlainText(draft.description).length < 40) {
    issues.push({ message: "Add a fuller property description.", step: 2 });
  }

  if (!draft.bedrooms || !draft.bathrooms || !draft.floorSize) {
    issues.push({ message: "Add bedrooms, bathrooms, and floor size.", step: 2 });
  }

  const askingPrice = Number(draft.askingPrice);

  if (!draft.askingPrice || !Number.isFinite(askingPrice) || askingPrice <= 0) {
    issues.push({ message: "Set the asking price.", step: 3 });
  }

  if (mediaCount < 1) {
    issues.push({ message: "Upload at least one listing photo or video.", step: 4 });
  }

  return issues;
}

function isListingStepComplete(
  stepIndex: number,
  draft: ListingDraft,
  mediaCount: number,
) {
  switch (stepIndex) {
    case 0:
      return Boolean(draft.listingType && draft.propertyType);
    case 1:
      return Boolean(
        draft.location.trim().length >= 2 &&
          draft.city.trim() &&
          draft.province.trim() &&
          draft.country.trim(),
      );
    case 2:
      return Boolean(
        draft.title.trim().length >= 4 &&
          richTextToPlainText(draft.description).length >= 40 &&
          draft.bedrooms &&
          draft.bathrooms &&
          draft.floorSize,
      );
    case 3:
      return Boolean(draft.askingPrice && Number(draft.askingPrice) > 0);
    case 4:
      return mediaCount > 0;
    case 5:
      return Boolean(draft.mandateType);
    case 6:
      return getPublishIssues(draft, mediaCount).length === 0;
    default:
      return false;
  }
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
  const sanitized = value.replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = sanitized.split(".");

  if (!sanitized.includes(".")) {
    return whole;
  }

  return `${whole}.${decimalParts.join("").slice(0, decimalPlaces)}`;
}

function normalizeFeatureInput(value: string) {
  return value
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxFeatureLength);
}

function featureHashtag(value: string) {
  return `#${value.replace(/\s+/g, "")}`;
}

function SubmitButtons({
  intent,
  onReset,
  setIntent,
}: {
  intent: "draft" | "published";
  onReset: () => void;
  setIntent: (intent: "draft" | "published") => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-2 sm:gap-3">
      <Button
        className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
        type="button"
        variant="outline"
        disabled={pending}
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
        disabled={pending}
        onClick={() => setIntent("draft")}
      >
        Save draft
      </Button>
      <Button
        className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
        type="submit"
        name="publishIntent"
        value="published"
        disabled={pending}
        onClick={() => setIntent("published")}
      >
        {pending && intent === "published" ? (
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
  listingId,
  setIntent,
}: {
  formId: string;
  intent: "draft" | "published";
  listingId?: string;
  setIntent: (intent: "draft" | "published") => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex min-w-0 flex-wrap justify-end gap-2 sm:gap-3">
      {listingId ? (
        <ArchiveListingDialog disabled={pending} formId={formId} />
      ) : null}
      {intent === "draft" ? (
        <>
          <Button
            className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
            type="submit"
            name="publishIntent"
            value="draft"
            variant="outline"
            disabled={pending}
            onClick={() => setIntent("draft")}
          >
            {pending ? "Updating" : "Update draft"}
          </Button>
          <Button
            className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
            type="submit"
            name="publishIntent"
            value="published"
            disabled={pending}
            onClick={() => setIntent("published")}
          >
            {pending ? "Publishing" : "Publish listing"}
          </Button>
        </>
      ) : (
        <Button
          className="h-10 px-3 text-xs sm:px-4 sm:text-sm"
          type="submit"
          name="publishIntent"
          value="published"
          disabled={pending}
          onClick={() => setIntent("published")}
        >
          {pending ? "Updating" : "Update listing"}
        </Button>
      )}
    </div>
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
              <Dialog.Title className="text-lg font-black">
                Archive this listing?
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
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
          <h1 className="mt-5 text-2xl font-black">Listing published</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
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
          <h1 className="mt-5 text-2xl font-black">Listing already exists</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
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
  if (!value) return "";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "";

  const converted = convertFromZarAmount(amount);

  return Number.isInteger(converted)
    ? String(converted)
    : converted.toFixed(2).replace(/\.?0+$/, "");
}

function editableCurrencyToZarValue(
  value: string,
  convertToZarAmount: (amount: number) => number,
) {
  if (!value) return "";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "";

  const converted = convertToZarAmount(amount);

  return Number.isInteger(converted)
    ? String(converted)
    : converted.toFixed(2).replace(/\.?0+$/, "");
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

const listingBooleanOptions = [
  { label: "Not specified", value: "" },
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

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
    <label className="block text-sm font-black">
      <span className="inline-flex items-center gap-1.5">
        {label} ({currency})
        {description ? (
          <AnalyticsInfoPopover title={label} description={description} />
        ) : null}
      </span>
      <input
        value={formatEditableCurrencyValue(value, convertFromZarAmount)}
        type="number"
        min="0"
        step="100"
        onChange={(event) =>
          updateDraft(
            setDraft,
            draftKey,
            editableCurrencyToZarValue(event.target.value, convertToZarAmount),
          )
        }
        placeholder={placeholder || "Optional"}
        className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary"
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
    <label className="block text-sm font-black">
      <span className="inline-flex items-center gap-1.5">
        {label}
        {description ? (
          <AnalyticsInfoPopover title={label} description={description} />
        ) : null}
      </span>
      <select
        value={value}
        onChange={(event) => updateDraft(setDraft, draftKey, event.target.value)}
        className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary"
      >
        {listingBooleanOptions.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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
        className="h-12 w-full cursor-pointer rounded-md border border-border bg-background px-4 pr-14 text-sm font-semibold outline-none transition-colors [color-scheme:light] focus:border-primary dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
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

export function CreateListingPage({
  initialCoverIndex = 0,
  initialDraft,
  initialMedia,
  initialPublishIntent = "published",
  duplicateListingId,
  listingId,
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
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [publishIntent, setPublishIntent] =
    useState<"draft" | "published">(initialPublishIntent);
  const [media, setMedia] = useState<ListingFormMedia[]>(() =>
    buildInitialMedia(initialMedia),
  );
  const [publishMessage, setPublishMessage] = useState("");
  const [coverIndex, setCoverIndex] = useState(initialCoverIndex);
  const [, setMediaStatus] = useState("");
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const autosaveHydratedRef = useRef(false);
  const mediaRef = useRef<ListingFormMedia[]>([]);
  const autosaveKey = useMemo(
    () => getListingAutosaveKey({ listingId, mode, profilePath }),
    [listingId, mode, profilePath],
  );
  const formId = `listing-form-${mode}-${listingId || "new"}`;
  const formAction = mode === "edit" ? updateListing : createListing;
  const isPublishedEdit = mode === "edit" && initialPublishIntent === "published";
  const profileListingsPath = `${profilePath}?tab=listings`;
  const backHref = mode === "edit" && listingId ? `/listings/${listingId}` : profileListingsPath;
  const listingHref = listingId ? `/listings/${listingId}` : "";
  const activeListingType = listingTypeOptions.find(
    (option) => option.value === draft.listingType,
  );
  const activePropertyType = propertyTypeOptions.find(
    (option) => option.value === draft.propertyType,
  );
  const availablePropertyTypes = useMemo(
    () =>
      propertyTypeOptions.filter((option) =>
        (option.listingTypes as readonly ListingType[]).includes(draft.listingType),
      ),
    [draft.listingType],
  );

  useEffect(() => {
    if (!publishedListingId) return;

    window.localStorage.removeItem(autosaveKey);
    void clearAutosavedMedia(autosaveKey);
  }, [autosaveKey, publishedListingId]);

  useEffect(() => {
    if (
      !availablePropertyTypes.some((option) => option.value === draft.propertyType)
    ) {
      updateDraft(setDraft, "propertyType", availablePropertyTypes[0].value);
    }
  }, [availablePropertyTypes, draft.propertyType]);

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
  }, [activeStep, autosaveKey, coverIndex, draft, media]);

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

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

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).slice(
      0,
      maxListingImages - media.length,
    );
    setMediaStatus("");

    if (!files.length) return;

    setMediaStatus("Optimizing media...");

    let compressedFiles: File[];

    try {
      compressedFiles = await Promise.all(files.map(optimizeMediaFile));
    } catch (error) {
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
    setMediaStatus("");
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

  function reorderMedia(fromIndex: number, toIndex: number) {
    setMedia((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current;
      }

      const next = [...current];
      const [movedItem] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedItem);
      syncMediaFiles(next);

      return next;
    });
    setCoverIndex((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= media.length ||
        toIndex >= media.length
      ) {
        return current;
      }

      if (current === fromIndex) return toIndex;

      if (fromIndex < current && toIndex >= current) return current - 1;
      if (fromIndex > current && toIndex <= current) return current + 1;

      return current;
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

    if (intent !== "published") {
      setPublishMessage("");
      return;
    }

    const issues = getPublishIssues(draft, media.length);

    if (!issues.length) {
      setPublishMessage("");
      return;
    }

    event.preventDefault();
    setActiveStep(issues[0].step);
    setPublishMessage(`Listing incomplete: ${issues.map((issue) => issue.message).join(" ")}`);
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
  const previewVideoUrls = media
    .filter(isVideoMedia)
    .map((item) => item.previewUrl);
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
                type: item.type || "image/webp",
              })),
          )}
        />
        <input type="hidden" name="coverIndex" value={coverIndex} />
        <input type="hidden" name="askingPrice" value={draft.askingPrice} />
        <input type="hidden" name="availableFrom" value={draft.availableFrom} />
        <input type="hidden" name="bathrooms" value={draft.bathrooms} />
        <input type="hidden" name="bedrooms" value={draft.bedrooms} />
        <input type="hidden" name="buyerIncentive" value={draft.buyerIncentive} />
        <input type="hidden" name="city" value={draft.city} />
        <input type="hidden" name="country" value={draft.country} />
        <input type="hidden" name="description" value={draft.description} />
        <input type="hidden" name="erfSize" value={draft.erfSize} />
        {draft.features.map((feature) => (
          <input key={feature} type="hidden" name="features" value={feature} />
        ))}
        <input type="hidden" name="floorSize" value={draft.floorSize} />
        <input type="hidden" name="furnishedStatus" value={draft.furnishedStatus} />
        <input type="hidden" name="garages" value={draft.garages} />
        <input type="hidden" name="insuranceEstimate" value={draft.insuranceEstimate} />
        <input type="hidden" name="suburb" value={draft.suburb} />
        <input type="hidden" name="province" value={draft.province} />
        <input type="hidden" name="googlePlaceId" value={draft.googlePlaceId} />
        <input type="hidden" name="googlePlaceData" value={draft.googlePlaceData} />
        <input type="hidden" name="listingType" value={draft.listingType} />
        <input type="hidden" name="location" value={draft.location} />
        <input type="hidden" name="localTaxes" value={draft.localTaxes} />
        <input type="hidden" name="mandateEndDate" value={draft.mandateEndDate} />
        <input
          type="hidden"
          name="mandateStartDate"
          value={draft.mandateStartDate}
        />
        <input type="hidden" name="mandateType" value={draft.mandateType} />
        <input type="hidden" name="communityFees" value={draft.communityFees} />
        <input type="hidden" name="parking" value={draft.parking} />
        <input type="hidden" name="petsAllowed" value={draft.petsAllowed} />
        <input
          type="hidden"
          name="previousAskingPrice"
          value={draft.previousAskingPrice}
        />
        <input type="hidden" name="priceQualifier" value={draft.priceQualifier} />
        <input type="hidden" name="propertyType" value={draft.propertyType} />
        {draft.reservationEnabled ? (
          <input type="hidden" name="reservationEnabled" value="on" />
        ) : null}
        <input
          type="hidden"
          name="reservationAmount"
          value={draft.reservationAmount}
        />
        <input type="hidden" name="rentalYield" value={draft.rentalYield} />
        <input type="hidden" name="shortLetAllowed" value={draft.shortLetAllowed} />
        <input type="hidden" name="title" value={draft.title} />
        <input
          type="hidden"
          name="transferCostsEstimate"
          value={draft.transferCostsEstimate}
        />
        <input type="hidden" name="utilitiesEstimate" value={draft.utilitiesEstimate} />
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
          name="mediaFiles"
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
                    setIntent={setPublishIntent}
                  />
                </>
              ) : (
                <SubmitButtons
                  intent={publishIntent}
                  onReset={requestResetForm}
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
                        window.location.replace(listingHref);
                      }}
                    >
                      Go to listing
                    </PageTopBarMenuItem>
                  ) : null}
                  <PageTopBarMenuItem
                    onSelect={() => {
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
                        setPublishIntent("published");
                        document.getElementById(`${formId}-publish`)?.click();
                      }}
                    >
                      Publish listing
                    </PageTopBarMenuItem>
                  ) : null}
                  <PageTopBarMenuItem
                    className="text-destructive"
                    onSelect={() => {
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
                  <PageTopBarMenuItem onSelect={requestResetForm}>
                    Reset form
                  </PageTopBarMenuItem>
                  <PageTopBarMenuItem
                    onSelect={() => {
                      setPublishIntent("draft");
                      document.getElementById(`${formId}-save-draft`)?.click();
                    }}
                  >
                    Save draft
                  </PageTopBarMenuItem>
                  <PageTopBarMenuItem
                    className="text-primary"
                    onSelect={() => {
                      setPublishIntent("published");
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
              className="inline-flex w-fit items-center gap-3 text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </PageTopBar>
          {mode === "edit" && listingId ? (
            <span className="hidden">
              <ArchiveListingDialog
                disabled={false}
                formId={formId}
                triggerId={`${formId}-archive-trigger`}
              />
            </span>
          ) : null}
          {publishMessage ? (
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300">
              {publishMessage}
            </p>
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

          <Dialog.Root open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none">
                <Dialog.Title className="text-base font-black">
                  Reset listing form?
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
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
                <div className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] lg:block lg:space-y-1 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = index === activeStep;
                    const isComplete = isListingStepComplete(
                      index,
                      draft,
                      media.length,
                    );

                    return (
                      <button
                        key={step.label}
                        type="button"
                        className={cn(
                          "flex h-11 min-w-[9rem] shrink-0 items-center gap-2 rounded-md px-3 text-sm font-black text-muted-foreground transition-colors hover:bg-muted lg:min-w-0 lg:w-full",
                          isActive && "bg-primary/10 text-primary",
                          isComplete && !isActive && "text-foreground",
                        )}
                        onClick={() => setActiveStep(index)}
                      >
                        <span
                          className={cn(
                            "grid size-7 place-items-center rounded-full border border-border bg-background",
                            isActive && "border-primary",
                            isComplete && "border-primary bg-primary text-primary-foreground",
                          )}
                        >
                          {isComplete ? (
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
              </div>
            </aside>

            <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
              {activeStep === steps.length - 1 ? null : (
                <div className="border-b border-border px-5 py-4">
                  <h1 className="text-xl font-black">
                    {mode === "edit" ? "Edit listing" : "Create listing"}
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">
                    {mode === "edit"
                      ? "Update listing details while keeping the current listing status."
                      : "Build a structured property listing that can be linked to reels and tracked in agent performance."}
                  </p>
                </div>
              )}

              <div className="min-h-[32rem] min-w-0 p-4 sm:p-6">
                {activeStep === 0 ? (
                  <ListingTypeStep
                    availablePropertyTypes={availablePropertyTypes}
                    draft={draft}
                    setDraft={setDraft}
                  />
                ) : null}
                {activeStep === 1 ? (
                  <LocationStep
                    draft={draft}
                    isLocked={isPublishedEdit}
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
                    onOpenFilePicker={() => mediaInputRef.current?.click()}
                    onRemove={removeMedia}
                    onReorder={reorderMedia}
                    setCoverIndex={setCoverIndex}
                  />
                ) : null}
                {activeStep === 5 ? (
                  <MandateStep draft={draft} setDraft={setDraft} />
                ) : null}
                {activeStep === 6 ? (
                  <PreviewStep
                    activeListingType={activeListingType?.label || "Listing"}
                    activePropertyType={activePropertyType?.label || "Property"}
                    cover={previewCover}
                    draft={draft}
                    imageUrls={previewImageUrls}
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
                    type="submit"
                    name="publishIntent"
                    value={mode === "edit" ? publishIntent : "published"}
                    onClick={() => {
                      if (mode !== "edit") {
                        setPublishIntent("published");
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
  availablePropertyTypes,
  draft,
  setDraft,
}: {
  availablePropertyTypes: typeof propertyTypeOptions[number][];
  draft: ListingDraft;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-black">What are you listing?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {listingTypeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "rounded-lg border border-border p-4 text-left transition-colors hover:border-primary",
                  draft.listingType === option.value &&
                    "border-primary bg-primary/10 ring-1 ring-primary",
                )}
                onClick={() => updateDraft(setDraft, "listingType", option.value)}
              >
                <Icon className="size-5 text-primary" />
                <span className="mt-3 block text-sm font-black">{option.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-black">Property type</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {availablePropertyTypes.map((option) => {
            const Icon = option.icon;

            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-black transition-colors",
                  draft.propertyType === option.value &&
                    "border-primary bg-primary/10 text-primary",
                )}
              >
                <input
                  type="radio"
                  name="propertyType"
                  value={option.value}
                  checked={draft.propertyType === option.value}
                  onChange={() => updateDraft(setDraft, "propertyType", option.value)}
                  className="sr-only"
                />
                <Icon className="size-4" />
                {option.label}
              </label>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function LocationStep({
  draft,
  isLocked = false,
  setDraft,
}: {
  draft: ListingDraft;
  isLocked?: boolean;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const [query, setQuery] = useState(draft.location);
  const [predictions, setPredictions] = useState<GoogleAutocompletePrediction[]>([]);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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

  function updateAddressPart(key: "city" | "country" | "province" | "suburb", value: string) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      googlePlaceData: current.googlePlaceId ? current.googlePlaceData : "",
    }));
  }

  async function selectLocation(option: GoogleAutocompletePrediction) {
    let place: GooglePlaceDetails | null = null;

    try {
      await loadGooglePlaces();
      const places = (window as GoogleWindow).google?.maps?.places;

      if (places) {
        const service = new places.PlacesService(document.createElement("div"));
        const sessionToken = new places.AutocompleteSessionToken();

        place = await new Promise<GooglePlaceDetails | null>((resolve) => {
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
    } catch {
      place = null;
    }

    const formattedAddress = place?.formatted_address || option.description;
    const parts = placeLocationParts(place || {}, formattedAddress);

    setQuery(option.description);
    setPredictions([]);
    setDraft((current) => ({
      ...current,
      city: parts.city,
      country: parts.country,
      googlePlaceId: option.place_id,
      googlePlaceData: serializablePlaceData(place, option),
      location: formattedAddress,
      province: parts.province,
      suburb: parts.suburb,
    }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-black">Location</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {isLocked
            ? "Published listing locations are locked so performance matching cannot be avoided by changing the address."
            : "Search the address, suburb, city, or country. We store this structured so listings can be matched later."}
        </p>
      </div>
      <div className="block text-sm font-black">
        Property location
        <input
          name="location"
          value={draft.location}
          onChange={(event) => {
            const value = event.target.value;
            const parts = splitLocation(value);
            setQuery(value);
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
          className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          disabled={isLocked}
          required
        />
      </div>
      {placesError ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
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
                <span className="block text-sm font-black">
                  {option.structured_formatting?.main_text || option.description}
                </span>
                <span className="block text-xs font-semibold text-muted-foreground">
                  {option.structured_formatting?.secondary_text || "Google Places"}
                </span>
              </span>
            </button>
          ))}
          {isSearching ? (
            <p className="px-3 py-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
              Searching places
            </p>
          ) : null}
          <p className="px-3 pb-1 pt-2 text-right text-[9px] font-black uppercase tracking-[0.35em] text-muted-foreground">
            Powered by Google
          </p>
        </div>
      ) : null}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black">Address details</h3>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">
              If Google cannot find the exact property, enter these manually.
            </p>
          </div>
          {draft.googlePlaceId ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-primary">
              Google matched
            </span>
          ) : (
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Manual entry
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-black uppercase tracking-wide text-muted-foreground">
            Suburb
            <input
              value={draft.suburb}
              onChange={(event) => updateAddressPart("suburb", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="Denneburg"
            />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-muted-foreground">
            City
            <input
              value={draft.city}
              onChange={(event) => updateAddressPart("city", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="Paarl"
            />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-muted-foreground">
            Province
            <input
              value={draft.province}
              onChange={(event) => updateAddressPart("province", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="Western Cape"
            />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-muted-foreground">
            Country
            <input
              value={draft.country}
              onChange={(event) => updateAddressPart("country", event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold normal-case tracking-normal outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:bg-muted"
              disabled={isLocked}
              placeholder="South Africa"
            />
          </label>
        </div>
      </div>
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
        <h2 className="text-lg font-black">Listing details</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Keep it scan-friendly. Buyers and renters should understand the listing
          in seconds.
        </p>
      </div>
      <div className="block text-sm font-black">
        <span className="flex items-center justify-between gap-3">
          <span>Listing title</span>
          <span className="text-xs font-black text-muted-foreground">
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
          className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary"
          required
        />
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            className={cn(
              "ai-action-button h-10 rounded-md px-3 text-xs font-black disabled:opacity-45",
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
      <div className="block text-sm font-black">
        <span className="flex items-center justify-between gap-3">
          <span>Description</span>
          <span className="text-xs font-black text-muted-foreground">
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
              "ai-action-button h-10 rounded-md px-3 text-xs font-black disabled:opacity-45",
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
      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
          ["bedrooms", "Bedrooms", "1"],
          ["bathrooms", "Bathrooms", "0.01"],
          ["garages", "Garages", "1"],
          ["parking", "Parking", "1"],
          ] satisfies Array<
            [
              "bedrooms" | "bathrooms" | "garages" | "parking",
              string,
              string,
            ]
          >
        ).map(([key, label, step]) => (
          <label key={key} className="block text-sm font-black">
            {label}
            <input
              name={key}
              value={draft[key]}
              type="number"
              min="0"
              step={step}
              onChange={(event) =>
                updateDraft(
                  setDraft,
                  key,
                  (key === "bathrooms"
                    ? decimalInputValue(event.target.value)
                    : integerInputValue(event.target.value)),
                )
              }
              className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none transition-colors focus:border-primary"
            />
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-black">
          Floor size m²
          <input
            name="floorSize"
            value={draft.floorSize}
            type="number"
            min="0"
            step="0.01"
            onChange={(event) =>
              updateDraft(setDraft, "floorSize", decimalInputValue(event.target.value))
            }
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="block text-sm font-black">
          Erf / land size m²
          <input
            name="erfSize"
            value={draft.erfSize}
            type="number"
            min="0"
            step="0.01"
            onChange={(event) =>
              updateDraft(setDraft, "erfSize", decimalInputValue(event.target.value))
            }
            className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none transition-colors focus:border-primary"
          />
        </label>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-black">Features</p>
          <p className="text-xs font-black text-muted-foreground">
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
                  "cursor-pointer rounded-full border border-border px-3 py-2 text-xs font-black transition-colors",
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
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none transition-colors focus:border-primary"
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
        <p className="mt-1 text-xs font-bold text-muted-foreground">
          {customFeature.length}/{maxFeatureLength} characters per feature
        </p>
        {draft.features.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {draft.features.map((feature) => (
              <button
                key={feature}
                type="button"
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-black text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => toggleFeature(feature)}
              >
                {featureHashtag(feature)}
              </button>
            ))}
          </div>
        ) : null}
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
  const askingPriceValue = formatEditableCurrencyValue(
    draft.askingPrice,
    convertFromZarAmount,
  );
  const previousAskingPriceValue = formatEditableCurrencyValue(
    draft.previousAskingPrice,
    convertFromZarAmount,
  );
  const reservationAmountValue = formatEditableCurrencyValue(
    draft.reservationAmount,
    convertFromZarAmount,
  );
  const askingPricePlaceholder = formatEditableCurrencyValue(
    draft.listingType === "rental" ? "25000" : "4500000",
    convertFromZarAmount,
  );
  const reservationDisabled = draft.listingType === "rental";

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-black">Pricing</h2>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Enter the base price in ZAR. Preview and listing display follow the
            selected currency.
          </p>
        </div>
        <CurrencySelector className="shrink-0 self-start" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-black">
          Asking price ({currency})
          <input
            value={askingPriceValue}
            type="number"
            min="0"
            step="1000"
            onChange={(event) =>
              updateDraft(
                setDraft,
                "askingPrice",
                editableCurrencyToZarValue(
                  event.target.value,
                  convertToZarAmount,
                ),
              )
            }
            placeholder={askingPricePlaceholder}
            className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="block text-sm font-black">
          <span className="inline-flex items-center gap-1.5">
            Previous price ({currency})
            <AnalyticsInfoPopover
              title="Previous price"
              description="Use this when the listing has been reduced. It only appears as Reduced from when it is higher than the asking price."
            />
          </span>
          <input
            value={previousAskingPriceValue}
            type="number"
            min="0"
            step="1000"
            onChange={(event) =>
              updateDraft(
                setDraft,
                "previousAskingPrice",
                editableCurrencyToZarValue(
                  event.target.value,
                  convertToZarAmount,
                ),
              )
            }
            placeholder="Optional"
            className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="block text-sm font-black">
          <span className="inline-flex items-center gap-1.5">
            Price label
            <AnalyticsInfoPopover
              title="Price label"
              description="Optional text shown before the price, such as From, Offers from, or Guide price."
            />
          </span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="mt-2 flex h-12 w-full items-center justify-between rounded-md border border-border bg-background px-4 text-left text-sm font-semibold outline-none transition-colors hover:border-primary/45 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <span>
                  {priceQualifierOptions.find(
                    (option) => option.value === draft.priceQualifier,
                  )?.label || "No label"}
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={8}
                className="z-[80] w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl shadow-black/20 outline-none"
              >
                {priceQualifierOptions.map((option) => {
                  const isActive = option.value === draft.priceQualifier;

                  return (
                    <DropdownMenu.Item
                      key={option.label}
                      className={cn(
                        "flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-bold outline-none transition-colors focus:bg-accent focus:text-accent-foreground",
                        isActive &&
                          "bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                      )}
                      onSelect={() =>
                        updateDraft(setDraft, "priceQualifier", option.value)
                      }
                    >
                      <span className="grid size-4 place-items-center">
                        {isActive ? <Check className="size-3.5" /> : null}
                      </span>
                      {option.label}
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </label>
        <label className="block text-sm font-black sm:col-span-2">
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
            className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary"
          />
        </label>
        <div className="sm:col-span-2 rounded-lg border border-border bg-card p-4">
          <label className="flex min-w-0 items-center gap-4">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black">
                Enable reservations
              </span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-muted-foreground">
                Buyers can pay a reservation amount through Stripe. The listing
                is marked reserved after payment, and can be reopened if the
                deal falls through.
              </span>
            </span>
            <input
              type="checkbox"
              checked={draft.reservationEnabled && !reservationDisabled}
              disabled={reservationDisabled}
              onChange={(event) =>
                updateDraft(setDraft, "reservationEnabled", event.target.checked)
              }
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5 peer-disabled:opacity-50"
            />
          </label>

          <label className="mt-4 block text-sm font-black">
            Reservation amount ({currency})
            <input
              value={reservationAmountValue}
              type="number"
              min="0"
              step="100"
              disabled={reservationDisabled}
              onChange={(event) =>
                updateDraft(
                  setDraft,
                  "reservationAmount",
                  editableCurrencyToZarValue(
                    event.target.value,
                    convertToZarAmount,
                  ),
                )
              }
              placeholder={formatEditableCurrencyValue("10000", convertFromZarAmount)}
              className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
            Reservation checkout adds Homzie and payment-processing fees on top,
            so the agency&apos;s reservation amount is protected.
          </p>
          {reservationDisabled ? (
            <p className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-300">
              Reservations are only available for sale listings.
            </p>
          ) : null}
        </div>
      </div>
      {draft.listingType === "rental" ? (
        <label className="block text-sm font-black">
          Available from
          <DateInput
            name="availableFrom"
            value={draft.availableFrom}
            onChange={(value) => updateDraft(setDraft, "availableFrom", value)}
          />
        </label>
      ) : null}
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h3 className="text-sm font-black">Ownership costs</h3>
        <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
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
            placeholder="Rates, council or property tax"
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
            placeholder="Levies, HOA or strata"
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
          <label className="block text-sm font-black">
            <span className="inline-flex items-center gap-1.5">
              Rental yield estimate (%)
              <AnalyticsInfoPopover
                title="Rental yield estimate"
                description="Estimated annual rental return as a percentage of the purchase price. Useful for investment-focused buyers."
              />
            </span>
            <input
              value={draft.rentalYield}
              type="number"
              min="0"
              max="100"
              step="0.1"
              onChange={(event) =>
                updateDraft(setDraft, "rentalYield", event.target.value)
              }
              placeholder="Optional"
              className="mt-2 h-12 w-full rounded-md border border-border bg-background px-4 text-sm font-semibold outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        <h3 className="text-sm font-black">Availability and rules</h3>
        <div className="mt-4 grid gap-4">
          {draft.listingType !== "rental" ? (
            <label className="block text-sm font-black">
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
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        {draft.priceQualifier ? (
          <p className="text-xs font-black uppercase tracking-wide text-primary">
            {draft.priceQualifier}
          </p>
        ) : null}
        <p className={draft.priceQualifier ? "mt-1 text-2xl font-black" : "text-2xl font-black"}>
          {formatListingPrice(
            draft.askingPrice,
            draft.listingType,
            formatPriceCents,
          )}
        </p>
        {showReducedPrice ? (
          <p className="mt-1 text-sm font-black text-red-600">
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
  media,
  onOpenFilePicker,
  onRemove,
  onReorder,
  setCoverIndex,
}: {
  coverIndex: number;
  media: ListingFormMedia[];
  onOpenFilePicker: () => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  setCoverIndex: (index: number) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black">Media</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Upload up to {maxListingImages} photos or videos. Photos are optimized
          before saving. Videos are limited to 90 seconds and {maxListingVideoSizeMb}MB
          after optimization.
        </p>
      </div>
      <button
        type="button"
        className="flex min-h-44 w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center transition-colors hover:bg-primary/10"
        onClick={onOpenFilePicker}
      >
        <ImagePlus className="size-8 text-primary" />
        <span className="mt-3 text-sm font-black">Upload listing media</span>
        <span className="mt-1 text-xs font-semibold text-muted-foreground">
          Choose photos or video. Select a photo as the cover when possible.
        </span>
      </button>
      {media.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromIndex = Number(event.dataTransfer.getData("text/plain"));

                if (Number.isFinite(fromIndex)) {
                  onReorder(fromIndex, index);
                }

                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
            >
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
              <div className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm">
                <Grip className="size-3.5" aria-hidden="true" />
              </div>
              {coverIndex === index ? (
                <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground shadow-sm">
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
                aria-label="Remove image"
                title="Remove image"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
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
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black">Mandate and status</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Mandate history feeds the performance system, so we store it clearly
          from the start.
        </p>
      </div>
      <div>
        <p className="text-sm font-black">Mandate type</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {mandateTypeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 text-sm font-black transition-colors",
                  draft.mandateType === option.value &&
                    "border-primary bg-primary/10 text-primary",
                )}
              >
                <input
                  type="radio"
                  name="mandateType"
                  value={option.value}
                  checked={draft.mandateType === option.value}
                  onChange={() => updateDraft(setDraft, "mandateType", option.value)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground",
                    draft.mandateType === option.value &&
                      "border-primary/30 bg-background text-primary",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">{option.label}</span>
                <AnalyticsInfoPopover
                  title={option.label}
                  description={option.description}
                  className="shrink-0"
                />
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-black">
          Mandate start
          <DateInput
            name="mandateStartDate"
            value={draft.mandateStartDate}
            onChange={(value) => updateDraft(setDraft, "mandateStartDate", value)}
          />
        </label>
        <label className="block text-sm font-black">
          Mandate end
          <DateInput
            name="mandateEndDate"
            value={draft.mandateEndDate}
            onChange={(value) => updateDraft(setDraft, "mandateEndDate", value)}
          />
        </label>
      </div>
      <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 text-sm font-semibold leading-6 text-muted-foreground">
        Listings cannot simply disappear from performance history after outcomes
        are recorded. Drafts stay private; published listings can be linked to
        reels and future sale outcomes.
      </div>
    </div>
  );
}

function PreviewStep(props: {
  activeListingType: string;
  activePropertyType: string;
  cover?: string;
  draft: ListingDraft;
  imageUrls?: string[];
  videoUrls?: string[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black">Preview and publish</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Check the public-facing basics before publishing.
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
              <Dialog.Title className="text-lg font-black">
                Listing preview
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs font-semibold text-muted-foreground">
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
    imageUrls,
    listingType: draft.listingType,
    listingTypeLabel: activeListingType,
    location: draft.location,
    mandateEndDate: draft.mandateEndDate,
    mandateStartDate: draft.mandateStartDate,
    mandateType: draft.mandateType,
    parking: draft.parking,
    previousPriceCents:
      Number.isFinite(previousPriceAmount) && previousPriceAmount > 0
        ? Math.round(previousPriceAmount * 100)
        : null,
    priceCents:
      Number.isFinite(priceAmount) && priceAmount > 0
        ? Math.round(priceAmount * 100)
        : null,
    pricePrefix: draft.priceQualifier,
    propertyTypeLabel: activePropertyType,
    title: draft.title,
    videoUrls,
  };

  return <ListingCard listing={listing} />;
}
