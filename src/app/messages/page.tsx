import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { GlobalHeader } from "@/components/global-header";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";
import { MessagesPage } from "@/modules/messages/components/messages-page";
import { getMessagesPageData } from "@/modules/messages/server";

type MessagesRouteProps = {
  searchParams?: Promise<{
    conversation?: string;
  }>;
};

export default async function MessagesRoute({ searchParams }: MessagesRouteProps) {
  const session = await getServerSession(authOptions);
  const viewerUserId = session?.user?.id;

  if (!viewerUserId) {
    redirect("/sign-in");
  }

  const query = searchParams ? await searchParams : {};
  const [viewer, messagesData] = await Promise.all([
    getViewerChrome(viewerUserId),
    getMessagesPageData(viewerUserId, query.conversation),
  ]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <GlobalHeader viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace} viewerRole={viewer.role} viewerUsername={viewer.username} />
      <main className="min-h-0 flex-1 pt-16 lg:pt-20">
        <MessagesPage {...messagesData} />
      </main>
    </div>
  );
}
