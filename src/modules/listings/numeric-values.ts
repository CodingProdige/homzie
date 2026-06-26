const halfStepEpsilon = 0.000001;
const fractionEpsilon = 0.000001;

export function parseListingNumberInput(value: unknown) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) return null;

  const sign = rawValue.trim().startsWith("-") ? "-" : "";
  const numericText = rawValue
    .replace(/\s+/g, "")
    .replace(/[^\d.,+-]/g, "")
    .replace(/[+-]/g, "");

  if (!numericText || !/\d/.test(numericText)) return null;

  const lastDotIndex = numericText.lastIndexOf(".");
  const lastCommaIndex = numericText.lastIndexOf(",");
  const singleSeparator =
    lastDotIndex >= 0 ? "." : lastCommaIndex >= 0 ? "," : null;
  const decimalSeparator =
    lastDotIndex >= 0 && lastCommaIndex >= 0
      ? lastDotIndex > lastCommaIndex
        ? "."
        : ","
      : inferSingleSeparator(numericText, singleSeparator);
  const normalized = decimalSeparator
    ? normalizeWithDecimalSeparator(numericText, decimalSeparator)
    : numericText.replace(/[.,]/g, "");
  const parsed = Number(`${sign}${normalized}`);

  return Number.isFinite(parsed) ? parsed : null;
}

function inferSingleSeparator(value: string, separator: "." | "," | null) {
  if (!separator) return null;

  const parts = value.split(separator);
  const finalPart = parts[parts.length - 1] || "";

  if (parts.length === 2) {
    return finalPart.length > 0 && finalPart.length <= 2 ? separator : null;
  }

  return finalPart.length > 0 && finalPart.length <= 2 ? separator : null;
}

function normalizeWithDecimalSeparator(value: string, separator: "." | ",") {
  const decimalIndex = value.lastIndexOf(separator);
  const whole = value.slice(0, decimalIndex).replace(/[.,]/g, "");
  const decimals = value.slice(decimalIndex + 1).replace(/[.,]/g, "");

  return `${whole || "0"}.${decimals}`;
}

export function formatPlainNumber(value: number, maxFractionDigits = 2) {
  const rounded = Number(value.toFixed(maxFractionDigits));

  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(maxFractionDigits).replace(/\.?0+$/, "");
}

export function normalizeListingNumberInput(
  value: unknown,
  maxFractionDigits = 2,
) {
  const parsed = parseListingNumberInput(value);

  return parsed === null ? undefined : formatPlainNumber(parsed, maxFractionDigits);
}

export function roundBathroomCount(value: number) {
  return Math.round(value * 2) / 2;
}

export function isHalfStepNumber(value: number) {
  return Math.abs(value * 2 - Math.round(value * 2)) < halfStepEpsilon;
}

export function formatBathroomCount(value: number | string | null | undefined) {
  const parsed = parseListingNumberInput(value);

  if (parsed === null || parsed <= 0) return "0";

  return formatPlainNumber(roundBathroomCount(parsed), 1);
}

export function formatGroupedNumber(
  value: number,
  maxFractionDigits = 2,
  minimumFractionDigits = 0,
) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits,
  }).format(value);
}

export function formatGroupedMoney(value: number) {
  const rounded = Number(value.toFixed(2));
  const hasCents =
    Math.abs(rounded - Math.round(rounded)) > fractionEpsilon;

  return formatGroupedNumber(rounded, 2, hasCents ? 2 : 0);
}
