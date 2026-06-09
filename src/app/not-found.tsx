import Link from "next/link";
import { Home, Search, UserRoundX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[1180px] items-center justify-center">
        <section className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 text-center shadow-[0_20px_60px_rgba(13,13,20,0.06)] sm:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRoundX className="size-8" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-primary">
            404
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">
            We couldn&apos;t find that page
          </h1>
          <p className="mt-4 text-sm font-semibold leading-7 text-muted-foreground sm:text-base">
            The link may be outdated, the profile may no longer be available, or the page may have moved.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="h-11 px-5">
              <Link href="/">
                <Home className="size-4" />
                Go home
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href="/agents">
                <Search className="size-4" />
                Browse agents
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
