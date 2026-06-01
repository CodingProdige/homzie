import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { hasActiveAgentSubscription } from "@/modules/agents/queries";
import { authOptions } from "@/modules/auth/config";
import { ReelMvpEditor } from "@/modules/reels/components/reel-mvp-editor";

export default async function NewReelPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  if (!(await hasActiveAgentSubscription(session.user.id))) {
    redirect("/become-agent");
  }

  return (
    <main className="h-dvh overflow-hidden bg-black text-foreground">
      <ReelMvpEditor profilePath={`/users/${user.username}`} />
    </main>
  );
}
