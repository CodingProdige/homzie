import Link from "next/link";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { Button } from "@/components/ui/button";

type LockedBuyerIntentPageProps = {
  backHref?: string;
  viewerAvatarUrl?: string | null;
  viewerHasAgencyWorkspace: boolean;
  viewerName?: string;
  viewerRole?: "admin" | "user";
  viewerUsername?: string;
};

export function LockedBuyerIntentPage({
  backHref = "/listings/activity",
  viewerAvatarUrl,
  viewerHasAgencyWorkspace,
  viewerName,
  viewerRole,
  viewerUsername,
}: LockedBuyerIntentPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        viewerAvatarUrl={viewerAvatarUrl}
        viewerHasAgencyWorkspace={viewerHasAgencyWorkspace}
        viewerName={viewerName}
        viewerRole={viewerRole}
        viewerUsername={viewerUsername}
      />
      <main className="page-body">
        <section className="page-container py-16">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Buyer intent locked
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              Unlock realtime buyer activity
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Your listings and reels can stay live for free. Upgrade when you
              want to see who is interacting, view buyer intent, and act while
              interest is hot.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/go-pro">Go Pro</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={backHref}>Go back</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <GlobalFooter viewerRole={viewerRole} viewerUsername={viewerUsername} />
    </div>
  );
}
