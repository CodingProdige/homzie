"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  type AuthActionResult,
} from "../actions";

const initialState: AuthActionResult = { ok: false, error: "" };

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState(
    requestPasswordReset,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="mt-10 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-950">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <p className="mt-4 font-bold">Check your email</p>
        <p className="mt-2 text-sm leading-6">
          If an active Homzie account exists for that address, a reset link is on
          the way.
        </p>
      </div>
    );
  }

  return (
    <form className="mt-10 space-y-6" action={action}>
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

      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-12 w-full [background:var(--homzie-gradient)] text-base text-white shadow-xl shadow-primary/20 hover:opacity-95"
        disabled={isPending}
      >
        <Mail className="size-4" />
        {isPending ? "Sending..." : "Email reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, isPending] = useActionState(
    resetPasswordWithToken,
    initialState,
  );

  if (state.ok) {
    return (
      <div className="mt-10 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-950">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
        <p className="mt-4 font-bold">Password updated</p>
        <p className="mt-2 text-sm leading-6">
          Your Homzie password has been changed. You can sign in with the new
          password now.
        </p>
        <Button asChild className="mt-5 w-full">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="mt-10 space-y-6" action={action}>
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Create a new password"
            autoComplete="new-password"
            className="h-12 rounded-md pl-12 text-base"
            minLength={8}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Repeat your new password"
            autoComplete="new-password"
            className="h-12 rounded-md pl-12 text-base"
            minLength={8}
            required
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-12 w-full [background:var(--homzie-gradient)] text-base text-white shadow-xl shadow-primary/20 hover:opacity-95"
        disabled={isPending}
      >
        <KeyRound className="size-4" />
        {isPending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
