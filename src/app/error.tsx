"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { reportClientErrorBoundary } from "@/modules/error-logs/client";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
    void reportClientErrorBoundary({ boundary: "app", error });
  }, [error]);

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[1180px] items-center justify-center">
        <section className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 text-center shadow-[0_20px_60px_rgba(13,13,20,0.06)] sm:p-10">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10 text-primary">
            <AlertTriangle className="size-8" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Something went wrong
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
            Homzie could not finish loading this page
          </h1>
          <p className="mt-4 text-sm font-normal leading-7 text-muted-foreground sm:text-base">
            The request may have timed out or the server may have returned an
            unexpected response. Try again, or head back home and reopen the page.
          </p>
          {error.digest ? (
            <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs font-normal text-muted-foreground">
              Error reference: {error.digest}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button type="button" className="h-11 px-5" onClick={() => unstable_retry()}>
              <RotateCcw className="size-4" />
              Try again
            </Button>
            <Button asChild variant="outline" className="h-11 px-5">
              <Link href="/">
                <Home className="size-4" />
                Go home
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
