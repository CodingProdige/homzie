import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { controlRoomPathForWorkspace } from "@/modules/agencies/control-room";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

export const dynamic = "force-dynamic";

export default async function ControlRoomIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/controlroom");
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  redirect(controlRoomPathForWorkspace(workspace));
}
