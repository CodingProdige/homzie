import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { Bell, Heart, MessageCircle } from "lucide-react";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { getUserEvents, markUserEventsSeen } from "@/modules/events/server";
import { EnableNotificationsButton } from "@/modules/push/components/enable-notifications-button";

async function getViewerUsername(userId?: string) {
  if (!userId) return undefined;

  const [viewer] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return viewer?.username || undefined;
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EventsPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const [viewerUsername, events] = await Promise.all([
    getViewerUsername(userId),
    getUserEvents(userId),
  ]);

  await markUserEventsSeen(userId);

  const groups = events.reduce<Record<string, typeof events>>((acc, event) => {
    const label = dayLabel(event.createdAt);
    acc[label] = acc[label] || [];
    acc[label].push(event);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader viewerUsername={viewerUsername} />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-24 sm:px-6 lg:pt-28">
        <div className="border-b border-border pb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
            Events
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
            Activity
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold text-muted-foreground sm:text-base">
            Messages, offers, calls, follows, listing and reel activity will collect here
            as Homzie events.
          </p>
          <EnableNotificationsButton />
        </div>

        {events.length ? (
          <div className="mt-8 space-y-8">
            {Object.entries(groups).map(([label, group]) => (
              <section key={label}>
                <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </h2>
                <div className="divide-y divide-border rounded-lg border border-border bg-card text-card-foreground">
                  {group.map((event) => {
                    const href = event.conversationId
                      ? `/messages?conversation=${event.conversationId}`
                      : event.listingId
                        ? `/listings/${event.listingId}`
                        : null;
                    const Icon =
                      event.eventType === "message.created" ||
                      event.eventType === "offer.created"
                        ? MessageCircle
                        : event.eventType.startsWith("call.")
                          ? Bell
                          : Heart;

                    const content = (
                      <div className="flex items-center gap-4 p-4 text-left transition-colors hover:bg-muted/60">
                        <span className="relative grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          {event.actor.avatarUrl ? (
                            <Image
                              src={event.actor.avatarUrl}
                              alt={event.actor.name}
                              width={44}
                              height={44}
                              className="size-11 rounded-full object-cover"
                            />
                          ) : (
                            <Icon className="size-5" />
                          )}
                          {!event.seen ? (
                            <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary ring-2 ring-card" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">{event.message}</span>
                          <span className="mt-1 block text-xs font-semibold text-muted-foreground">
                            {timeLabel(event.createdAt)}
                          </span>
                        </span>
                      </div>
                    );

                    return href ? (
                      <Link key={event.id} href={href} className="block">
                        {content}
                      </Link>
                    ) : (
                      <div key={event.id}>{content}</div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="mt-10 grid min-h-[24rem] place-items-center rounded-lg border border-dashed border-border p-8 text-center">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Heart className="size-7" />
              </span>
              <h2 className="mt-5 text-xl font-black">No events yet</h2>
              <p className="mt-2 max-w-md text-sm font-semibold text-muted-foreground">
                Once people message you, make offers, interact with your reels, or view
                important listing updates, they will appear here.
              </p>
              <Button asChild className="mt-5">
                <Link href="/messages">Open messages</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
      <GlobalFooter viewerUsername={viewerUsername} />
    </div>
  );
}
