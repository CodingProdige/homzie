import { getServerSession } from "next-auth";

import { authOptions } from "@/modules/auth/config";
import { getUnreadMessageCount } from "@/modules/messages/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const count = userId ? await getUnreadMessageCount(userId) : 0;

  return Response.json(
    { count },
    { headers: { "Cache-Control": "no-store" } },
  );
}
