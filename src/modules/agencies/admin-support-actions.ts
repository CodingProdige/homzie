"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import {
  startAdminAgencySupportAccess,
  stopAdminAgencySupportAccess,
} from "@/modules/agencies/admin-support";
import { authOptions } from "@/modules/auth/config";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getSessionUserId() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in as an admin to manage agency support access.");
  }

  return session.user.id;
}

export async function startAdminAgencySupportAction(formData: FormData) {
  const adminUserId = await getSessionUserId();
  const agencyId = formString(formData, "agencyId");
  const { controlRoomPath } = await startAdminAgencySupportAccess({
    adminUserId,
    agencyId,
  });

  revalidatePath(controlRoomPath);
  redirect(controlRoomPath);
}

export async function stopAdminAgencySupportAction(_formData?: FormData) {
  const session = await getServerSession(authOptions);

  await stopAdminAgencySupportAccess(session?.user?.id);

  revalidatePath("/admin");
  revalidatePath("/controlroom/agency");
  revalidatePath("/controlroom/networkhq");
  redirect("/admin");
}
