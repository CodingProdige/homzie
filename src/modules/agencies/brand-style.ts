export type AgencyBadgeStyle = {
  backgroundColor: string;
  borderRadius: string;
  fontFamily: string;
  fontWeight: string;
  textColor: string;
};

export const defaultAgencyBadgeStyle: AgencyBadgeStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "999px",
  fontFamily: "inherit",
  fontWeight: "900",
  textColor: "#11111a",
};

export const agencyBadgeFontOptions = [
  { label: "Homzie default", value: "inherit" },
  { label: "System sans", value: "Arial, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, SFMono-Regular, Menlo, monospace" },
] as const;

export const agencyBadgeFontWeightOptions = [
  { label: "Medium", value: "500" },
  { label: "Bold", value: "700" },
  { label: "Black", value: "900" },
] as const;

export const agencyBadgeRadiusOptions = [
  { label: "Sharp", value: "4px" },
  { label: "Soft", value: "8px" },
  { label: "Rounded", value: "14px" },
  { label: "Pill", value: "999px" },
] as const;

const hexColorPattern = /^#[0-9a-f]{6}$/i;

function safeColor(value: unknown, fallback: string) {
  return typeof value === "string" && hexColorPattern.test(value)
    ? value
    : fallback;
}

function optionValue(
  options: readonly { value: string }[],
  value: unknown,
  fallback: string,
) {
  return typeof value === "string" &&
    options.some((option) => option.value === value)
    ? value
    : fallback;
}

function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function agencyControlRoomLogoPathFromSettings(
  settings: unknown,
): string | null {
  const branding = objectValue(objectValue(settings).branding);
  const value = branding.controlRoomLogoPath;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function agencyBadgeStyleFromSettings(
  settings: unknown,
): AgencyBadgeStyle {
  const branding = objectValue(objectValue(settings).branding);
  const badge = objectValue(branding.badgeStyle);

  return {
    backgroundColor: safeColor(
      badge.backgroundColor,
      defaultAgencyBadgeStyle.backgroundColor,
    ),
    borderRadius: optionValue(
      agencyBadgeRadiusOptions,
      badge.borderRadius,
      defaultAgencyBadgeStyle.borderRadius,
    ),
    fontFamily: optionValue(
      agencyBadgeFontOptions,
      badge.fontFamily,
      defaultAgencyBadgeStyle.fontFamily,
    ),
    fontWeight: optionValue(
      agencyBadgeFontWeightOptions,
      badge.fontWeight,
      defaultAgencyBadgeStyle.fontWeight,
    ),
    textColor: safeColor(badge.textColor, defaultAgencyBadgeStyle.textColor),
  };
}

export function agencySettingsWithBadgeStyle(
  settings: unknown,
  badgeStyle: AgencyBadgeStyle,
  controlRoomLogoPath?: string | null,
) {
  const current = objectValue(settings);
  const branding = objectValue(current.branding);

  return {
    ...current,
    branding: {
      ...branding,
      badgeStyle,
      ...(controlRoomLogoPath === undefined ? {} : { controlRoomLogoPath }),
    },
  };
}
