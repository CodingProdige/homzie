import { GlobalHeader } from "@/components/global-header";

export default function UserReelsLoading() {
  return (
    <div className="min-h-screen bg-black text-white">
      <GlobalHeader />
      <main className="flex min-h-screen items-center justify-center px-4 pt-20">
        <section className="relative h-[calc(100vh-6rem)] max-h-[860px] w-full max-w-[420px] animate-pulse overflow-hidden rounded-lg bg-zinc-900 shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-700/50 via-zinc-900 to-black" />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <div className="size-10 rounded-full bg-white/15" />
            <div className="h-4 w-24 rounded-full bg-white/20" />
            <div className="size-10 rounded-full bg-white/15" />
          </div>
          <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="size-11 rounded-full bg-white/15" />
            ))}
          </div>
          <div className="absolute bottom-8 left-4 right-16">
            <div className="h-4 w-36 rounded-full bg-white/25" />
            <div className="mt-4 h-4 w-full rounded-full bg-white/20" />
            <div className="mt-2 h-4 w-2/3 rounded-full bg-white/20" />
            <div className="mt-5 h-2 rounded-full bg-white/25" />
          </div>
        </section>
      </main>
    </div>
  );
}
