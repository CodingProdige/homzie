const metricSkeletons = ["users", "listings", "messages", "reports"];
const panelSkeletons = ["recent-users", "recent-listings"];

export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-20 rounded-full bg-primary/20" />
          <div className="mt-4 h-11 w-full max-w-sm rounded-full bg-muted" />
          <div className="mt-4 h-4 w-full max-w-2xl rounded-full bg-muted" />
          <div className="mt-2 h-4 w-4/5 max-w-xl rounded-full bg-muted" />
        </div>
        <div className="hidden h-10 w-32 rounded-md bg-muted sm:block" />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricSkeletons.map((item) => (
          <div
            key={item}
            className="rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-24 rounded-full bg-muted" />
                <div className="mt-4 h-8 w-20 rounded-full bg-muted" />
              </div>
              <div className="size-10 rounded-full bg-primary/10" />
            </div>
            <div className="mt-5 h-3 w-full rounded-full bg-muted" />
            <div className="mt-2 h-3 w-2/3 rounded-full bg-muted" />
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {panelSkeletons.map((item) => (
          <section
            key={item}
            className="rounded-lg border border-border bg-card shadow-sm"
          >
            <div className="border-b border-border px-5 py-4">
              <div className="h-4 w-40 rounded-full bg-muted" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-2/3 rounded-full bg-muted" />
                      <div className="mt-2 h-3 w-1/2 rounded-full bg-muted" />
                    </div>
                    <div className="h-5 w-16 rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
