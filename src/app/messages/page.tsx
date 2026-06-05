import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { MessageSquareText } from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";

async function getViewerUsername(userId?: string) {
  if (!userId) return undefined;

  const [viewer] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return viewer?.username || undefined;
}

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  const viewerUsername = await getViewerUsername(session?.user?.id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader viewerUsername={viewerUsername} />
      <main className="page-body pb-16 pt-28">
        <section className="border-b border-border pb-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
            Messages
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">
            Inbox
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            Direct conversations with agents, buyers, sellers, and renters will
            live here.
          </p>
        </section>

        <section className="mt-8 grid min-h-80 place-items-center rounded-lg border border-dashed border-border bg-card p-8 text-center text-card-foreground">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <MessageSquareText className="size-5" />
            </span>
            <h2 className="mt-4 text-lg font-black">Messages are coming soon</h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
              We will use this space for listing enquiries, offers, agent chats,
              and buyer or renter conversations.
            </p>
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}
