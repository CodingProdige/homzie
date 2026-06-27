export const profileRoleValues = [
  "home_seeker",
  "private_seller",
  "property_agent",
  "developer",
] as const;

export type ProfileRole = (typeof profileRoleValues)[number];

export const defaultProfileRole: ProfileRole = "home_seeker";

export const profileRoleOptions: Array<{
  label: string;
  sentenceLabel: string;
  value: ProfileRole;
}> = [
  {
    label: "Home seeker",
    sentenceLabel: "home seeker",
    value: "home_seeker",
  },
  {
    label: "Homeowner / private seller",
    sentenceLabel: "homeowner / private seller",
    value: "private_seller",
  },
  {
    label: "Property agent",
    sentenceLabel: "property agent",
    value: "property_agent",
  },
  {
    label: "Property developer",
    sentenceLabel: "property developer",
    value: "developer",
  },
];

export function normalizeProfileRole(value: unknown): ProfileRole {
  return profileRoleValues.includes(value as ProfileRole)
    ? (value as ProfileRole)
    : defaultProfileRole;
}

export function profileRoleLabel(value: unknown) {
  const role = normalizeProfileRole(value);

  return profileRoleOptions.find((option) => option.value === role)?.label || "Home seeker";
}

export function profileRoleSentenceLabel(value: unknown) {
  const role = normalizeProfileRole(value);

  return (
    profileRoleOptions.find((option) => option.value === role)?.sentenceLabel ||
    "home seeker"
  );
}
