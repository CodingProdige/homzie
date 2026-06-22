import type { AgencyWorkspace } from "@/modules/agencies/server";

export type ControlRoomKind = "agency" | "networkhq";

export function controlRoomKindForWorkspace(
  workspace: AgencyWorkspace | null | undefined,
): ControlRoomKind {
  return workspace?.agency.agencyType === "network" ? "networkhq" : "agency";
}

export function controlRoomPathForWorkspace(
  workspace: AgencyWorkspace | null | undefined,
) {
  return `/controlroom/${controlRoomKindForWorkspace(workspace)}`;
}

export function controlRoomLabel(kind: ControlRoomKind) {
  return kind === "networkhq" ? "Network HQ control room" : "Agency control room";
}

export function parseControlRoomKind(value: string): ControlRoomKind | null {
  if (value === "agency" || value === "networkhq") return value;

  return null;
}
