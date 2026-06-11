import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { HomzieLogo } from "@/components/homzie-logo";
import { ThemeToggle } from "./theme-toggle";

export function PasswordResetShell({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:h-screen lg:grid-cols-[minmax(0,1.45fr)_minmax(480px,0.95fr)] lg:overflow-hidden">
      <section className="relative hidden min-h-[620px] overflow-hidden bg-brand-black text-white lg:block lg:min-h-screen">
        <video
          className="absolute inset-0 size-full object-cover"
          src="/video/sign-in-video.mp4"
          autoPlay
          muted
          playsInline
          preload="metadata"
        />
        <div className="relative z-10 flex min-h-[620px] flex-col px-7 py-10 sm:px-12 lg:min-h-screen">
          <Link href="/" className="flex items-center gap-3" aria-label="Homzie home">
            <HomzieLogo className="h-9 brightness-0 invert" priority />
          </Link>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-y-auto bg-background px-7 py-12 sm:px-10 lg:h-screen lg:items-start">
        <div className="absolute right-5 top-5 hidden lg:block">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[430px]">
          <div className="mb-10 text-center">
            <HomzieLogo
              variant="tight"
              className="mx-auto h-14 sm:h-16"
              priority
            />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-muted-foreground">
              {description}
            </p>
          </div>

          {children}

          <p className="mt-7 text-center text-sm text-muted-foreground">
            Remembered your password?{" "}
            <Link href="/sign-in" className="font-bold text-foreground">
              Sign in
            </Link>
          </p>

          <div className="mt-14 text-center">
            <ShieldCheck className="mx-auto size-10 text-primary" />
            <p className="mt-5 font-bold">Secure account recovery</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Reset links are single-use and expire after 30 minutes.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
