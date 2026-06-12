import { PageTopBar } from "@/components/page-top-bar";

const pageClassName =
  "min-h-screen bg-[radial-gradient(circle_at_top,_rgba(124,92,255,0.12),_transparent_32rem),linear-gradient(180deg,_hsl(var(--background)),_hsl(var(--muted)/0.45))] text-foreground";

export default function UserPerformanceLoading() {
  return (
    <main className={pageClassName}>
      <div className="relative z-10 mx-auto w-full max-w-[1160px] px-5 pb-6 pt-20 sm:px-8 sm:pb-9">
        <PageTopBar className="fixed inset-x-0 top-0 z-50 mx-auto max-w-[1160px] px-5 sm:px-8" />

        <section className="mt-7 grid animate-pulse justify-items-center gap-y-4 text-center sm:mt-8 sm:grid-cols-[5rem_minmax(0,1fr)] sm:justify-items-start sm:gap-x-4 sm:text-left">
          <div className="size-20 rounded-full bg-muted" />
          <div className="w-full max-w-xl">
            <div className="mx-auto h-8 w-64 rounded-full bg-muted sm:mx-0" />
            <div className="mx-auto mt-3 h-4 w-40 rounded-full bg-muted sm:mx-0" />
            <div className="mx-auto mt-5 h-4 w-full rounded-full bg-muted sm:mx-0" />
          </div>
        </section>

        <section className="mt-8 grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="size-9 rounded-full bg-primary/10" />
              <div className="mt-4 h-3 w-28 rounded-full bg-muted" />
              <div className="mt-3 h-8 w-24 rounded-full bg-muted" />
            </div>
          ))}
        </section>

        <section className="mt-8 grid animate-pulse gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="h-80 rounded-lg border border-border bg-card shadow-sm" />
          <div className="h-80 rounded-lg border border-border bg-card shadow-sm" />
        </section>
      </div>
    </main>
  );
}
