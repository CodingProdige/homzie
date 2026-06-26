import {
  mandateTypeOptions,
  propertyTypeOptions,
  type PropertyCategory,
  type PropertyType,
} from "@/modules/listings/options";

export type ListingPublishIssue = {
  message: string;
  step: number;
};

export type ListingReadinessItem = {
  description: string;
  isComplete: boolean;
  label: string;
  step: number;
};

export type ListingStrength = {
  comparison: string;
  label: "Low" | "Moderate" | "Good" | "Strong";
  percent: number;
};

export type ListingStrengthBenchmark = {
  averageDescriptionLength: number;
  averageMediaCount: number;
  listingType: string;
  propertyType: string;
  sampleSize: number;
};

export type ListingValidationDraft = {
  addressVisibility?: string | null;
  askingPrice?: number | string | null;
  bathrooms?: number | string | null;
  bedrooms?: number | string | null;
  city?: string | null;
  contactVisibility?: string | null;
  country?: string | null;
  description?: string | null;
  erfSize?: number | string | null;
  features?: string[] | null;
  floorSize?: number | string | null;
  googlePlaceId?: string | null;
  landSizeHectares?: number | string | null;
  listingType?: string | null;
  listingVisibility?: string | null;
  location?: string | null;
  mandateType?: string | null;
  postalCode?: string | null;
  propertyCategory?: string | null;
  propertyType?: string | null;
  province?: string | null;
  streetName?: string | null;
  suburb?: string | null;
  title?: string | null;
};

export const residentialPropertyTypes = new Set<PropertyType | string>([
  "apartment",
  "cluster_home",
  "duet",
  "development_unit",
  "estate_home",
  "flatlet",
  "free_standing_house",
  "golf_estate",
  "guest_house",
  "lifestyle_estate",
  "retirement_unit",
  "room",
  "sectional_title_development",
  "security_estate",
  "student_accommodation",
  "townhouse",
]);

export const landOnlyPropertyTypes = new Set<PropertyType | string>([
  "agricultural_land",
  "development_land",
  "development_project",
  "estate_development",
  "farm",
  "game_farm",
  "lifestyle_farm",
  "small_holding",
  "vacant_land",
  "wine_farm",
]);

export const commercialPropertyTypes = new Set<PropertyType | string>([
  "business_premises",
  "commercial_development",
  "commercial_property",
  "factory",
  "hospitality",
  "industrial",
  "medical_suite",
  "mixed_use",
  "office",
  "restaurant",
  "retail",
  "showroom",
  "warehouse",
]);

export function plainListingDescription(value: string | null | undefined) {
  return String(value || "")
    .replace(/<\/?(p|br|li|ul|ol)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textValue(value: string | null | undefined) {
  return String(value || "").trim();
}

function locationAreaFallback(value: string) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 4) return parts.slice(1).join(", ");
  if (parts.length >= 2) return parts.join(", ");

  return value;
}

export function publicListingLocation({
  addressVisibility,
  city,
  country,
  isOwner,
  location,
  province,
  suburb,
}: {
  addressVisibility?: string | null;
  city?: string | null;
  country?: string | null;
  isOwner?: boolean;
  location?: string | null;
  province?: string | null;
  suburb?: string | null;
}) {
  const fullLocation = textValue(location);

  if (isOwner || addressVisibility === "exact") return fullLocation;

  const areaLocation = [suburb, city, province, country]
    .map(textValue)
    .filter(Boolean)
    .join(", ");

  return areaLocation || locationAreaFallback(fullLocation) || "Location available on request";
}

function numberValue(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value || "").replace(",", ".").trim();

  if (!normalized) return null;

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function hasNumber(value: number | string | null | undefined) {
  return numberValue(value) !== null;
}

function hasPositiveNumber(value: number | string | null | undefined) {
  const parsed = numberValue(value);

  return parsed !== null && parsed > 0;
}

function benchmarkTarget(value: number, fallback: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback;

  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

export function isPropertyTypeCompatibleWithCategory(
  category: string | null | undefined,
  propertyType: string | null | undefined,
) {
  if (!category || !propertyType) return true;

  const option = propertyTypeOptions.find((item) => item.value === propertyType);

  return !option || option.category === category;
}

export function mandateOptionsForListingType(listingType: string | null | undefined) {
  if (listingType === "rental") {
    return ["open", "sole", "rental"];
  }

  if (listingType === "sale") {
    return ["open", "sole", "dual", "development"];
  }

  return mandateTypeOptions.map((option) => option.value);
}

export function isMandateTypeCompatibleWithListingType(
  listingType: string | null | undefined,
  mandateType: string | null | undefined,
) {
  const cleanMandateType = textValue(mandateType);

  return (
    !cleanMandateType ||
    mandateOptionsForListingType(textValue(listingType)).includes(cleanMandateType)
  );
}

export function hasCompleteListingLocation(draft: ListingValidationDraft) {
  const location = textValue(draft.location);
  const city = textValue(draft.city);
  const province = textValue(draft.province);
  const country = textValue(draft.country);

  const baseComplete =
    location.length >= 2 &&
    location !== "Location not set" &&
    Boolean(city && province && country);

  if (!baseComplete) return false;

  if (!textValue(draft.googlePlaceId)) {
    return Boolean(
      textValue(draft.streetName) &&
        textValue(draft.suburb) &&
        textValue(draft.postalCode),
    );
  }

  return true;
}

export function getListingRequiredFactsComplete(draft: ListingValidationDraft) {
  const propertyType = textValue(draft.propertyType);
  const hasBedroomCount = hasNumber(draft.bedrooms);
  const hasBathroomCount = hasNumber(draft.bathrooms);
  const hasFloorSize = hasPositiveNumber(draft.floorSize);
  const hasErfSize = hasPositiveNumber(draft.erfSize);
  const isFarmType = draft.propertyCategory === "farm";
  const hasLandSizeHectares = hasPositiveNumber(draft.landSizeHectares);

  return (
    (residentialPropertyTypes.has(propertyType) &&
      hasBedroomCount &&
      hasBathroomCount &&
      hasFloorSize) ||
    (commercialPropertyTypes.has(propertyType) && hasFloorSize) ||
    (landOnlyPropertyTypes.has(propertyType) &&
      (isFarmType ? hasLandSizeHectares || hasErfSize : hasErfSize)) ||
    (!residentialPropertyTypes.has(propertyType) &&
      !commercialPropertyTypes.has(propertyType) &&
      !landOnlyPropertyTypes.has(propertyType))
  );
}

export function getListingPublishIssues(
  draft: ListingValidationDraft,
  mediaCount: number,
  options: { requiresLocationConfirmation?: boolean } = {},
): ListingPublishIssue[] {
  const issues: ListingPublishIssue[] = [];
  const propertyCategory = textValue(draft.propertyCategory);
  const propertyType = textValue(draft.propertyType);

  if (!textValue(draft.listingType)) {
    issues.push({ message: "Choose whether this listing is for sale or rent.", step: 0 });
  }

  if (!propertyCategory) {
    issues.push({ message: "Choose the property category.", step: 0 });
  }

  if (!propertyType) {
    issues.push({ message: "Choose the property type.", step: 0 });
  }

  if (
    propertyCategory &&
    propertyType &&
    !isPropertyTypeCompatibleWithCategory(propertyCategory, propertyType)
  ) {
    issues.push({
      message: "Choose a property type that matches the selected category.",
      step: 0,
    });
  }

  if (
    textValue(draft.listingType) &&
    textValue(draft.mandateType) &&
    !isMandateTypeCompatibleWithListingType(draft.listingType, draft.mandateType)
  ) {
    issues.push({
      message: "Choose a mandate type that matches the selected listing intent.",
      step: 5,
    });
  }

  const title = textValue(draft.title);

  if (title === "Untitled listing" || title.length < 4) {
    issues.push({ message: "Add a listing title.", step: 2 });
  }

  const location = textValue(draft.location);

  if (location === "Location not set" || location.length < 2) {
    issues.push({ message: "Add the property location.", step: 1 });
  }

  if (!textValue(draft.city) || !textValue(draft.province) || !textValue(draft.country)) {
    issues.push({ message: "Add city, province, and country.", step: 1 });
  }

  if (location !== "Location not set" && location.length >= 2 && !hasCompleteListingLocation(draft)) {
    issues.push({
      message: textValue(draft.googlePlaceId)
        ? "Confirm the property location."
        : "Add street name, suburb, and postal code for the property location.",
      step: 1,
    });
  }

  if (options.requiresLocationConfirmation) {
    issues.push({ message: "Confirm the imported property location.", step: 1 });
  }

  if (plainListingDescription(draft.description).length < 40) {
    issues.push({ message: "Add a fuller property description.", step: 2 });
  }

  const hasFloorSize = hasPositiveNumber(draft.floorSize);
  const hasErfSize = hasPositiveNumber(draft.erfSize);

  if (
    residentialPropertyTypes.has(propertyType) &&
    (!hasNumber(draft.bedrooms) || !hasNumber(draft.bathrooms) || !hasFloorSize)
  ) {
    issues.push({ message: "Add bedrooms, bathrooms, and floor size.", step: 2 });
  }

  if (commercialPropertyTypes.has(propertyType) && !hasFloorSize) {
    issues.push({ message: "Add the floor size.", step: 2 });
  }

  if (landOnlyPropertyTypes.has(propertyType)) {
    const hasLandSizeHectares = hasPositiveNumber(draft.landSizeHectares);
    const isFarmType = draft.propertyCategory === "farm";

    if (isFarmType ? !hasLandSizeHectares && !hasErfSize : !hasErfSize) {
      issues.push({
        message: isFarmType ? "Add the land size in hectares." : "Add the erf size.",
        step: 2,
      });
    }
  }

  if (!hasPositiveNumber(draft.askingPrice)) {
    issues.push({ message: "Set the asking price.", step: 3 });
  }

  if (mediaCount < 1) {
    issues.push({ message: "Upload at least one listing photo or video.", step: 4 });
  }

  return issues;
}

export function getListingReadinessItems(
  draft: ListingValidationDraft,
  mediaCount: number,
  options: { requiresLocationConfirmation?: boolean } = {},
): ListingReadinessItem[] {
  const askingPrice = numberValue(draft.askingPrice);

  return [
    {
      description: "Intent, category, and subtype selected.",
      isComplete: Boolean(
        textValue(draft.listingType) &&
          textValue(draft.propertyCategory) &&
          textValue(draft.propertyType) &&
          isPropertyTypeCompatibleWithCategory(
            draft.propertyCategory as PropertyCategory | undefined,
            draft.propertyType,
          ),
      ),
      label: "Listing structure",
      step: 0,
    },
    {
      description: "Address area and Google location confirmation ready.",
      isComplete:
        hasCompleteListingLocation(draft) && !options.requiresLocationConfirmation,
      label: "Location",
      step: 1,
    },
    {
      description: "Title and full description are ready.",
      isComplete:
        textValue(draft.title).length >= 4 &&
        plainListingDescription(draft.description).length >= 40,
      label: "Title and description",
      step: 2,
    },
    {
      description: "Core facts match the selected property type.",
      isComplete: getListingRequiredFactsComplete(draft),
      label: "Required property facts",
      step: 2,
    },
    {
      description: "Asking price can be shown clearly.",
      isComplete: askingPrice !== null && askingPrice > 0,
      label: "Pricing",
      step: 3,
    },
    {
      description: "At least one image or video is attached.",
      isComplete: mediaCount > 0,
      label: "Media",
      step: 4,
    },
    {
      description: "Mandate type is selected.",
      isComplete: Boolean(
        textValue(draft.mandateType) &&
          isMandateTypeCompatibleWithListingType(
            draft.listingType,
            draft.mandateType,
          ),
      ),
      label: "Mandate",
      step: 5,
    },
    {
      description: "Public visibility, address, and contact posture are set.",
      isComplete: Boolean(
        textValue(draft.listingVisibility) &&
          textValue(draft.addressVisibility) &&
          textValue(draft.contactVisibility),
      ),
      label: "Visibility",
      step: 6,
    },
  ];
}

export function getListingStrength(
  draft: ListingValidationDraft,
  mediaCount: number,
  options: {
    benchmark?: ListingStrengthBenchmark | null;
    requiresLocationConfirmation?: boolean;
  } = {},
): ListingStrength {
  const items = getListingReadinessItems(draft, mediaCount, options);
  const isComplete = (label: string) =>
    Boolean(items.find((item) => item.label === label)?.isComplete);
  const descriptionLength = plainListingDescription(draft.description).length;
  const featureCount = Array.isArray(draft.features) ? draft.features.length : 0;
  const benchmark =
    options.benchmark &&
    options.benchmark.listingType === draft.listingType &&
    options.benchmark.propertyType === draft.propertyType
      ? options.benchmark
      : null;

  let score = 0;

  if (isComplete("Listing structure")) score += 10;
  if (isComplete("Location")) score += 12;
  if (textValue(draft.title).length >= 4) score += 6;

  const descriptionTarget = benchmarkTarget(
    benchmark?.averageDescriptionLength || 0,
    250,
    160,
    700,
  );
  const mediaTarget = benchmarkTarget(benchmark?.averageMediaCount || 0, 20, 5, 35);

  if (descriptionLength >= descriptionTarget) {
    score += 12;
  } else if (descriptionLength >= Math.round(descriptionTarget * 0.6)) {
    score += 10;
  } else if (descriptionLength >= 40) {
    score += 7;
  }

  if (isComplete("Required property facts")) score += 14;
  if (isComplete("Pricing")) score += 12;

  if (mediaCount >= mediaTarget) {
    score += 16;
  } else if (mediaCount >= Math.round(mediaTarget * 0.7)) {
    score += 14;
  } else if (mediaCount >= Math.max(2, Math.round(mediaTarget * 0.35))) {
    score += 11;
  } else if (mediaCount >= 1) {
    score += 8;
  }

  if (featureCount >= 8) {
    score += 8;
  } else if (featureCount >= 4) {
    score += 6;
  } else if (featureCount >= 1) {
    score += 3;
  }

  if (isComplete("Mandate")) score += 6;
  if (isComplete("Visibility")) score += 4;

  const percent = Math.max(0, Math.min(100, Math.round(score)));
  const comparisonScope = benchmark
    ? `${benchmark.sampleSize.toLocaleString()} similar Homzie listing${
        benchmark.sampleSize === 1 ? "" : "s"
      }`
    : "similar Homzie listing structures";
  const benchmarkHint = benchmark
    ? ` Average similar listings use about ${Math.max(
        1,
        mediaTarget,
      ).toLocaleString()} media item${
        Math.max(1, mediaTarget) === 1 ? "" : "s"
      } and ${descriptionTarget.toLocaleString()} description characters.`
    : "";

  if (percent >= 90) {
    return {
      comparison:
        `Compared with ${comparisonScope}, this looks strong: rich media, clear facts, and buyer-facing details are in place.${benchmarkHint}`,
      label: "Strong",
      percent,
    };
  }

  if (percent >= 75) {
    return {
      comparison:
        `Compared with ${comparisonScope}, this is competitive, but a little more detail can help it stand out.${benchmarkHint}`,
      label: "Good",
      percent,
    };
  }

  if (percent >= 55) {
    return {
      comparison:
        `Compared with ${comparisonScope}, buyers may need more proof before they act. Add the missing facts, media, or detail next.${benchmarkHint}`,
      label: "Moderate",
      percent,
    };
  }

  return {
    comparison:
      `Compared with ${comparisonScope}, this is still light. Complete the core fields before expecting strong buyer intent.${benchmarkHint}`,
    label: "Low",
    percent,
  };
}

export function isListingStepComplete(
  stepIndex: number,
  draft: ListingValidationDraft,
  mediaCount: number,
  options: { requiresLocationConfirmation?: boolean } = {},
) {
  switch (stepIndex) {
    case 0:
      return Boolean(
        textValue(draft.listingType) &&
          textValue(draft.propertyCategory) &&
          textValue(draft.propertyType) &&
          isPropertyTypeCompatibleWithCategory(
            draft.propertyCategory,
            draft.propertyType,
          ),
      );
    case 1:
      return (
        hasCompleteListingLocation(draft) &&
        !options.requiresLocationConfirmation
      );
    case 2:
      return Boolean(
        textValue(draft.title).length >= 4 &&
          plainListingDescription(draft.description).length >= 40 &&
          getListingRequiredFactsComplete(draft),
      );
    case 3:
      return hasPositiveNumber(draft.askingPrice);
    case 4:
      return mediaCount > 0;
    case 5:
      return Boolean(
        textValue(draft.mandateType) &&
          isMandateTypeCompatibleWithListingType(
            draft.listingType,
            draft.mandateType,
          ),
      );
    case 6:
      return Boolean(
        textValue(draft.listingVisibility) &&
          textValue(draft.addressVisibility) &&
          textValue(draft.contactVisibility),
      );
    default:
      return false;
  }
}
