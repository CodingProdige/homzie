import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";

function MetricSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="size-9 rounded-full bg-primary/10" />
      <div className="mt-4 h-3 w-24 rounded-full bg-muted" />
      <div className="mt-3 h-7 w-16 rounded-full bg-muted" />
    </div>
  );
}

export default function UserAnalyticsLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pb-10 lg:pt-28">
        <section className="animate-pulse">
          <div className="h-4 w-32 rounded-full bg-muted" />
          <div className="mt-5 h-12 w-full max-w-md rounded-full bg-muted" />
          <div className="mt-5 h-4 w-full max-w-2xl rounded-full bg-muted" />
          <div className="mt-2 h-4 w-4/5 max-w-xl rounded-full bg-muted" />
        </section>

        <section className="mt-8 grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </section>

        <section className="mt-8 animate-pulse rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="h-3 w-24 rounded-full bg-muted" />
              <div className="mt-3 h-6 w-52 rounded-full bg-muted" />
            </div>
            <div className="h-11 w-44 rounded-lg bg-muted" />
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <div className="h-11 bg-muted/70" />
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4 border-t border-border px-4 py-4"
              >
                <div className="h-5 rounded-full bg-muted" />
                <div className="h-5 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}
