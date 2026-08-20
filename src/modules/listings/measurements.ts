import {
  formatGroupedNumber,
  parseListingNumberInput,
} from "@/modules/listings/numeric-values";

export type ListingAreaUnit = "square-meters" | "hectares";

export type ListingAreaDisplay = {
  imperial: string;
  metric: string;
};

const SQUARE_FEET_PER_SQUARE_METER = 10.7639104167;
const ACRES_PER_HECTARE = 2.4710538147;

/**
 * Keeps the metric value that an agent entered as the source of truth, while
 * providing a clearly labelled imperial approximation for international viewers.
 */
export function formatListingArea(
  value: unknown,
  unit: ListingAreaUnit,
): ListingAreaDisplay | null {
  const parsed = parseListingNumberInput(value);

  if (parsed === null || parsed <= 0) return null;

  if (unit === "hectares") {
    return {
      imperial: `≈ ${formatGroupedNumber(parsed * ACRES_PER_HECTARE, 2)} acres`,
      metric: `${formatGroupedNumber(parsed, 2)} ha`,
    };
  }

  return {
    imperial: `≈ ${formatGroupedNumber(parsed * SQUARE_FEET_PER_SQUARE_METER, 0)} sq ft`,
    metric: `${formatGroupedNumber(parsed, 2)} m²`,
  };
}
