import type { ListingDraft } from "@/modules/listings/components/create-listing-page";
import { normalizeSupportedCurrency } from "@/modules/currency/currency";
import {
  formatBathroomCount,
  formatPlainNumber,
} from "@/modules/listings/numeric-values";
import {
  listingTypeOptions,
  mandateTypeOptions,
  propertyCategoryOptions,
  propertyTypeOptions,
  type ListingType,
  type MandateType,
  type PropertyCategory,
  type PropertyType,
} from "@/modules/listings/options";
import type { ListingDetailData } from "@/modules/listings/server/listing-data";

function centsToInput(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatPlainNumber(value / 100, 2)
    : "";
}

function numberToInput(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function bathroomsToInput(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? formatBathroomCount(value)
    : "";
}

export function listingTypeValue(value: string): ListingType {
  return listingTypeOptions.some((option) => option.value === value)
    ? (value as ListingType)
    : "sale";
}

export function propertyTypeValue(value: string): PropertyType {
  return propertyTypeOptions.some((option) => option.value === value)
    ? (value as PropertyType)
    : "free_standing_house";
}

function propertyCategoryValue(
  value: string,
  propertyType: PropertyType,
): PropertyCategory {
  const inferredCategory =
    propertyTypeOptions.find((option) => option.value === propertyType)?.category ||
    "residential";

  return propertyCategoryOptions.some((option) => option.value === value)
    ? (value as PropertyCategory)
    : inferredCategory;
}

function mandateTypeValue(value: string): MandateType {
  return mandateTypeOptions.some((option) => option.value === value)
    ? (value as MandateType)
    : "open";
}

export function draftFromListing(
  listing: ListingDetailData,
): Partial<ListingDraft> {
  const propertyType = propertyTypeValue(listing.propertyType);

  return {
    addressVisibility: listing.addressVisibility,
    askingPrice: centsToInput(listing.askingPriceCents),
    availableFrom: listing.availableFrom || "",
    bathrooms: bathroomsToInput(listing.bathrooms),
    bedrooms: numberToInput(listing.bedrooms),
    buyerIncentive: listing.buyerIncentive,
    city: listing.city,
    communityFees: centsToInput(listing.communityFeesCents),
    country: listing.country,
    developerName: listing.developerName,
    description: listing.description || "",
    erfSize: numberToInput(listing.erfSize),
    estateName: listing.estateName,
    features: listing.features,
    floorSize: numberToInput(listing.floorSize),
    furnishedStatus: listing.furnishedStatus,
    garages: numberToInput(listing.garages),
    grossLettableArea: numberToInput(listing.grossLettableArea),
    googlePlaceData: listing.googlePlaceData,
    googlePlaceId: listing.googlePlaceId,
    insuranceEstimate: centsToInput(listing.insuranceEstimateCents),
    landSizeHectares: numberToInput(listing.landSizeHectares),
    leaseExpiryDate: listing.leaseExpiryDate,
    listingReference: listing.listingReference,
    listingCurrency: normalizeSupportedCurrency(listing.listingCurrency),
    listingVisibility: listing.listingVisibility,
    listingType: listingTypeValue(listing.listingType),
    location: listing.location || "",
    localTaxes: centsToInput(listing.localTaxesCents),
    loadingBays: numberToInput(listing.loadingBays),
    mandateEndDate: listing.mandateEndDate,
    mandateStartDate: listing.mandateStartDate,
    mandateType: mandateTypeValue(listing.mandateType),
    occupancyStatus: listing.occupancyStatus,
    ownershipType: listing.ownershipType,
    outbuildings: listing.outbuildings,
    parking: numberToInput(listing.parking),
    petsAllowed: listing.petsAllowed,
    powerSupply: listing.powerSupply,
    previousAskingPrice: centsToInput(listing.previousAskingPriceCents),
    priceQualifier: listing.priceQualifier,
    propertyCategory: propertyCategoryValue(listing.propertyCategory, propertyType),
    propertyType,
    province: listing.province,
    reservationAmount: centsToInput(listing.reservationAmountCents),
    reservationEnabled: listing.reservationEnabled,
    rentalYield: numberToInput(listing.rentalYield),
    servitudes: listing.servitudes,
    shortLetAllowed: listing.shortLetAllowed,
    storeys: numberToInput(listing.storeys),
    postalCode: listing.postalCode,
    streetName: listing.streetName,
    streetNumber: listing.streetNumber,
    suburb: listing.suburb,
    titleDeedStatus: listing.titleDeedStatus,
    title: listing.title,
    transferCostsEstimate: centsToInput(listing.transferCostsEstimateCents),
    unitCount: numberToInput(listing.unitCount),
    unitNumber: listing.unitNumber,
    contactVisibility: listing.contactVisibility,
    mandateVisibility: listing.mandateVisibility,
    occupancyVisibility: listing.occupancyVisibility,
    previousPriceVisibility: listing.previousPriceVisibility,
    reservationVisibility: listing.reservationVisibility,
    utilitiesEstimate: centsToInput(listing.utilitiesEstimateCents),
    waterRights: listing.waterRights,
    zoning: listing.zoning,
  };
}
