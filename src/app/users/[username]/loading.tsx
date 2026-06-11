import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";

export default function UserProfileLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader />
      <main className="page-body pb-24 pt-20">
        <section className="page-container py-6">
          <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="h-40 bg-muted sm:h-56" />
            <div className="px-4 pb-6 sm:px-6">
              <div className="-mt-12 size-24 rounded-full border-4 border-card bg-muted sm:size-32" />
              <div className="mt-4 h-7 w-48 rounded-full bg-muted" />
              <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-muted" />
              <div className="mt-2 h-4 w-3/5 rounded-full bg-muted" />
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="h-20 rounded-lg bg-muted" />
                <div className="h-20 rounded-lg bg-muted" />
                <div className="h-20 rounded-lg bg-muted" />
              </div>
            </div>
          </div>
          <div className="mt-8 grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="aspect-[4/3] rounded-lg border border-border bg-card" />
            <div className="aspect-[4/3] rounded-lg border border-border bg-card" />
            <div className="aspect-[4/3] rounded-lg border border-border bg-card" />
          </div>
        </section>
      </main>
      <GlobalFooter />
    </div>
  );
}
