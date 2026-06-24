"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { agencyActivityEvents } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import {
  controlRoomPathForWorkspace,
} from "@/modules/agencies/control-room";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";

async function requireAgencyWorkspace() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Sign in before managing control room activity.");
  }

  const workspace = await getPrimaryAgencyWorkspace(userId);

  if (!workspace) {
    throw new Error("Create or join an agency workspace first.");
  }

  return workspace;
}

function revalidateActivity(workspace: Awaited<ReturnType<typeof requireAgencyWorkspace>>) {
  const basePath = controlRoomPathForWorkspace(workspace);

  revalidatePath(basePath);
  revalidatePath(`${basePath}/activity`);
  revalidatePath(`${basePath}/branches`);
  revalidatePath(`${basePath}/network`);
}

export async function markAgencyActivityReadAction(formData: FormData) {
  const workspace = await requireAgencyWorkspace();
  const eventId = String(formData.get("eventId") || "").trim();

  if (!eventId) return;

  await db
    .update(agencyActivityEvents)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(agencyActivityEvents.id, eventId),
        eq(agencyActivityEvents.agencyId, workspace.agency.id),
      ),
    );

  revalidateActivity(workspace);
}

export async function markAllAgencyActivityReadAction() {
  const workspace = await requireAgencyWorkspace();

  await db
    .update(agencyActivityEvents)
    .set({ readAt: new Date() })
    .where(eq(agencyActivityEvents.agencyId, workspace.agency.id));

  revalidateActivity(workspace);
}

export async function archiveAgencyActivityAction(formData: FormData) {
  const workspace = await requireAgencyWorkspace();
  const eventId = String(formData.get("eventId") || "").trim();

  if (!eventId) return;

  await db
    .update(agencyActivityEvents)
    .set({ archivedAt: new Date(), readAt: new Date() })
    .where(
      and(
        eq(agencyActivityEvents.id, eventId),
        eq(agencyActivityEvents.agencyId, workspace.agency.id),
      ),
    );

  revalidateActivity(workspace);
}
