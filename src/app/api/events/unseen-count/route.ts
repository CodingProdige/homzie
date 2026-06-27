import { getServerSession } from "next-auth";

import { authOptions } from "@/modules/auth/config";
import { getUnseenEventCount } from "@/modules/events/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const count = userId ? await getUnseenEventCount(userId) : 0;

  return Response.json(
    { count },
    { headers: { "Cache-Control": "no-store" } },
  );
}
