import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex w-full items-center justify-between px-3 py-6">
        <Image
          src="/logo/homzie-logo-dark.png"
          alt="Homzie"
          width={160}
          height={58}
          className="h-10 w-auto object-contain"
          priority
        />
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>

      <section className="page-body flex min-h-[calc(100vh-88px)] items-center py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
            Homzie
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-6xl">
            Agent-first property discovery.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            We are starting with auth and public user profiles. Agents can become
            creators, publish listings, upload reels, and link each reel to a
            property when one exists.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/sign-in">Open auth page</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/users/jessicavdm">View profile preview</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
