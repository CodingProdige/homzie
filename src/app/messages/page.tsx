import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { MessagesPage } from "@/modules/messages/components/messages-page";
import { getMessagesPageData } from "@/modules/messages/server";

type MessagesRouteProps = {
  searchParams?: Promise<{
    conversation?: string;
  }>;
};

async function getViewerUsername(userId?: string) {
  if (!userId) return undefined;

  const [viewer] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return viewer?.username || undefined;
}

export default async function MessagesRoute({ searchParams }: MessagesRouteProps) {
  const session = await getServerSession(authOptions);
  const viewerUserId = session?.user?.id;

  if (!viewerUserId) {
    redirect("/sign-in");
  }

  const query = searchParams ? await searchParams : {};
  const [viewerUsername, messagesData] = await Promise.all([
    getViewerUsername(viewerUserId),
    getMessagesPageData(viewerUserId, query.conversation),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader viewerUsername={viewerUsername} />
      <main className="pt-16 lg:pt-20">
        <MessagesPage {...messagesData} />
      </main>
      <GlobalFooter />
    </div>
  );
}
