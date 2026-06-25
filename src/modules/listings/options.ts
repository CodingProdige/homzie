import {
  BadgeDollarSign,
  Building2,
  Factory,
  Handshake,
  Home,
  KeyRound,
  LandPlot,
  MapPinned,
  ShieldCheck,
  Store,
  Trees,
  Warehouse,
} from "lucide-react";

export const listingTypeOptions = [
  {
    value: "sale",
    label: "For sale",
    description: "Residential or land listings for buyers.",
    icon: BadgeDollarSign,
  },
  {
    value: "rental",
    label: "Rental",
    description: "Monthly rental homes, apartments, and commercial spaces.",
    icon: KeyRound,
  },
  {
    value: "development",
    label: "Development",
    description: "New developments, projects, and available units.",
    icon: Building2,
  },
  {
    value: "commercial",
    label: "Commercial",
    description: "Office, retail, industrial, and mixed-use opportunities.",
    icon: Store,
  },
] as const;

export const propertyTypeOptions = [
  {
    value: "free_standing_house",
    label: "Free-standing house",
    listingTypes: ["sale", "rental"],
    icon: Home,
  },
  {
    value: "apartment",
    label: "Apartment / flat",
    listingTypes: ["sale", "rental", "development"],
    icon: Building2,
  },
  {
    value: "townhouse",
    label: "Townhouse",
    listingTypes: ["sale", "rental", "development"],
    icon: Home,
  },
  {
    value: "estate_home",
    label: "Estate home",
    listingTypes: ["sale", "rental"],
    icon: Trees,
  },
  {
    value: "vacant_land",
    label: "Vacant land",
    listingTypes: ["sale"],
    icon: LandPlot,
  },
  {
    value: "development_project",
    label: "Development project",
    listingTypes: ["development"],
    icon: MapPinned,
  },
  {
    value: "development_unit",
    label: "Development unit",
    listingTypes: ["development"],
    icon: Building2,
  },
  {
    value: "office",
    label: "Office",
    listingTypes: ["commercial", "rental", "sale"],
    icon: Building2,
  },
  {
    value: "retail",
    label: "Retail",
    listingTypes: ["commercial", "rental", "sale"],
    icon: Store,
  },
  {
    value: "industrial",
    label: "Industrial",
    listingTypes: ["commercial", "rental", "sale"],
    icon: Factory,
  },
  {
    value: "warehouse",
    label: "Warehouse",
    listingTypes: ["commercial", "rental", "sale"],
    icon: Warehouse,
  },
] as const;

export const mandateTypeOptions = [
  {
    value: "open",
    label: "Open mandate",
    description:
      "Multiple agents or agencies may market the property. Commission is usually earned by the agent who concludes the transaction.",
    icon: Handshake,
  },
  {
    value: "sole",
    label: "Sole mandate",
    description:
      "One agent or agency has exclusive authority to market the property for the agreed mandate period.",
    icon: ShieldCheck,
  },
  {
    value: "dual",
    label: "Dual mandate",
    description:
      "Two appointed agents or agencies may market the property under the agreed mandate terms.",
    icon: Handshake,
  },
  {
    value: "rental",
    label: "Rental mandate",
    description:
      "Authority to market and let the property, usually tied to finding and placing a tenant.",
    icon: KeyRound,
  },
  {
    value: "development",
    label: "Development mandate",
    description:
      "Used for developer or project stock where the agent is marketing units, phases, or a development portfolio.",
    icon: Building2,
  },
] as const;

export const featureOptions = [
  "Pool",
  "Garden",
  "Solar",
  "Backup power",
  "Security",
  "Fibre",
  "Sea view",
  "Mountain view",
  "Pet friendly",
  "Furnished",
  "Air conditioning",
  "Staff quarters",
] as const;

export type ListingType = (typeof listingTypeOptions)[number]["value"];
export type PropertyType = (typeof propertyTypeOptions)[number]["value"];
export type MandateType = (typeof mandateTypeOptions)[number]["value"];
