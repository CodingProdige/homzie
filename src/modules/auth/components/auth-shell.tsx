import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { HomzieLogo } from "@/components/homzie-logo";

import { AuthForm } from "./auth-form";
import { GoogleAuthButton } from "./google-auth-button";
import { ThemeToggle } from "./theme-toggle";

type AuthMode = "sign-in" | "register";

function AuthMediaPanel() {
  return (
    <section className="relative min-h-[620px] overflow-hidden bg-brand-black text-white lg:min-h-screen">
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
  );
}

export function AuthShell({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";
  const title = isRegister
    ? "Create your Homzie account"
    : "Sign in to your Homzie account";
  const description = isRegister
    ? "Create an account to save homes, follow profiles, and manage your property journey."
    : "Enter your credentials to access your Homzie account";
  const googleLabel = isRegister
    ? "Register with Google"
    : "Sign in with Google";

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:h-screen lg:grid-cols-[minmax(0,1.45fr)_minmax(480px,0.95fr)] lg:overflow-hidden">
      <AuthMediaPanel />

      <section className="relative flex min-h-screen items-start justify-center overflow-y-auto bg-background px-7 py-12 sm:px-10 lg:h-screen">
        <div className="absolute right-5 top-5 hidden lg:block">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[430px]">
          <div className="mb-10 text-center">
            <HomzieLogo className="mx-auto h-9" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-muted-foreground">
              {description}
            </p>
          </div>

          <AuthForm mode={mode} />

          <div className="my-8 grid grid-cols-[1fr_auto_1fr] items-center gap-5">
            <div className="h-px bg-border" />
            <span className="text-sm font-bold text-muted-foreground">OR</span>
            <div className="h-px bg-border" />
          </div>

          <GoogleAuthButton label={googleLabel} />

          <p className="mt-7 text-center text-sm text-muted-foreground">
            {isRegister ? "Already have an account?" : "New to Homzie?"}{" "}
            <Link
              href={isRegister ? "/sign-in" : "/register"}
              className="font-bold text-foreground"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>

          <div className="mt-14 text-center">
            <ShieldCheck className="mx-auto size-10 text-primary" />
            <p className="mt-5 font-bold">Secure account access</p>
            <p className="mt-3 text-sm text-muted-foreground">
              All connections are encrypted and secure
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
