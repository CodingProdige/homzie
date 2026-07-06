export const profileRoleValues = [
  "home_seeker",
  "private_seller",
  "property_agent",
  "developer",
  "agency_owner",
  "independent_agency_owner",
  "branch_agency_owner",
  "network_hq_owner",
  "agency_team_member",
] as const;

export type ProfileRole = (typeof profileRoleValues)[number];

export const defaultProfileRole: ProfileRole = "home_seeker";

export const agencyProfileRoleValues = [
  "agency_owner",
  "independent_agency_owner",
  "branch_agency_owner",
  "network_hq_owner",
  "agency_team_member",
] as const satisfies readonly ProfileRole[];

export type AgencyProfileRole = (typeof agencyProfileRoleValues)[number];

export const profileRoleOptions: Array<{
  identityPhrase: string;
  label: string;
  sentenceLabel: string;
  value: ProfileRole;
}> = [
  {
    identityPhrase: "a home seeker",
    label: "Home seeker",
    sentenceLabel: "home seeker",
    value: "home_seeker",
  },
  {
    identityPhrase: "a homeowner / private seller",
    label: "Homeowner / private seller",
    sentenceLabel: "homeowner / private seller",
    value: "private_seller",
  },
  {
    identityPhrase: "a property agent",
    label: "Property agent",
    sentenceLabel: "property agent",
    value: "property_agent",
  },
  {
    identityPhrase: "a property developer",
    label: "Property developer",
    sentenceLabel: "property developer",
    value: "developer",
  },
  {
    identityPhrase: "an agency owner",
    label: "Agency owner",
    sentenceLabel: "agency owner",
    value: "agency_owner",
  },
  {
    identityPhrase: "an independent agency owner",
    label: "Independent agency owner",
    sentenceLabel: "independent agency owner",
    value: "independent_agency_owner",
  },
  {
    identityPhrase: "a branch agency owner",
    label: "Branch agency owner",
    sentenceLabel: "branch agency owner",
    value: "branch_agency_owner",
  },
  {
    identityPhrase: "a Network HQ owner",
    label: "Network HQ owner",
    sentenceLabel: "Network HQ owner",
    value: "network_hq_owner",
  },
  {
    identityPhrase: "an agency team member",
    label: "Agency team member",
    sentenceLabel: "agency team member",
    value: "agency_team_member",
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

export function profileRoleIdentityPhrase(value: unknown) {
  const role = normalizeProfileRole(value);

  return (
    profileRoleOptions.find((option) => option.value === role)?.identityPhrase ||
    "a home seeker"
  );
}

export function isAgencyProfileRole(value: unknown) {
  const role = normalizeProfileRole(value);

  return agencyProfileRoleValues.includes(role as AgencyProfileRole);
}

export function profileRoleForAgencyOwner(
  agencyType: "branch" | "independent" | "network",
): AgencyProfileRole {
  if (agencyType === "network") return "network_hq_owner";
  if (agencyType === "branch") return "branch_agency_owner";

  return "independent_agency_owner";
}
