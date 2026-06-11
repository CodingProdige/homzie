"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "./password-input";
import {
  registerWithEmail,
  setSessionCookiePersistence,
} from "../actions";

type AuthMode = "sign-in" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const keepSignedIn = formData.get("remember") === "on";

    startTransition(async () => {
      if (isRegister) {
        const registerResult = await registerWithEmail({ name, email, password });

        if (!registerResult.ok) {
          setError(registerResult.error);
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          isRegister
            ? "Account created, but sign-in failed. Please try signing in."
            : "Invalid email or password.",
        );
        return;
      }

      await setSessionCookiePersistence(keepSignedIn);

      window.location.assign("/onboarding/username");
    });
  };

  return (
    <form className="mt-10 space-y-6" onSubmit={onSubmit}>
      {isRegister ? (
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              placeholder="Jessica van der Merwe"
              autoComplete="name"
              className="h-12 rounded-md pl-12 text-base"
              required
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="youremail@example.com"
            autoComplete="email"
            className="h-12 rounded-md pl-12 text-base"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {!isRegister ? (
            <Link href="/forgot-password" className="text-sm font-semibold text-foreground">
              Forgot password?
            </Link>
          ) : null}
        </div>
        <PasswordInput isRegister={isRegister} />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="remember"
          name="remember"
          type="checkbox"
          defaultChecked
          className="mt-1 size-4 rounded border-border"
        />
        <div>
          <Label htmlFor="remember" className="text-sm font-medium text-muted-foreground">
            {isRegister
              ? "Keep me signed in for 30 days after creating my account"
              : "Keep me signed in for 30 days"}
          </Label>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Leave unchecked to require sign-in again after this browser session.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-12 w-full [background:var(--homzie-gradient)] text-base text-white shadow-xl shadow-primary/20 hover:opacity-95"
        disabled={isPending}
      >
        <LockKeyhole className="size-4" />
        {isPending ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
