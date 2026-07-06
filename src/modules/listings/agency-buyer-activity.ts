import "server-only";

import {
  getPrimaryAgencyWorkspace,
  type AgencyWorkspace,
} from "@/modules/agencies/server";

export type AgencyBuyerActivityAccess = {
  agencyId: string;
  agencyName: string;
  basePath: string;
  workspace: AgencyWorkspace & {
    agency: { agencyType: "branch" | "independent" };
  };
};

export function agencyBuyerActivityAccessFromWorkspace(
  workspace: AgencyWorkspace | null,
): AgencyBuyerActivityAccess | null {
  if (
    !workspace ||
    workspace.agency.status !== "active" ||
    workspace.agency.agencyType === "network" ||
    workspace.membership.status !== "active" ||
    !workspace.membership.canViewBuyerActivity
  ) {
    return null;
  }

  const safeWorkspace = workspace as AgencyWorkspace & {
    agency: { agencyType: "branch" | "independent" };
  };

  return {
    agencyId: safeWorkspace.agency.id,
    agencyName: safeWorkspace.agency.name,
    basePath: "/controlroom/agency",
    workspace: safeWorkspace,
  };
}

export async function getAgencyBuyerActivityAccessForUser(userId: string) {
  return agencyBuyerActivityAccessFromWorkspace(
    await getPrimaryAgencyWorkspace(userId),
  );
}
