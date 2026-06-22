"use client";

import { useEffect, useState, useTransition } from "react";
import { AtSign, CheckCircle2, LockKeyhole, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkUsernameAvailability,
  completeUsername,
  type UsernameAvailability,
} from "../actions";
import { normalizeUsername } from "../username";

export function UsernameOnboardingForm({
  callbackUrl,
  suggestedUsername,
  usernameLabel = "Username",
}: {
  callbackUrl?: string;
  suggestedUsername: string;
  usernameLabel?: string;
}) {
  const [username, setUsername] = useState(suggestedUsername);
  const [pendingUsername, setPendingUsername] = useState<string | null>(
    suggestedUsername ? suggestedUsername : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<UsernameAvailability>({
    status: "empty",
    username: "",
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!username) {
      return;
    }

    let isCurrent = true;

    const timeout = window.setTimeout(() => {
      checkUsernameAvailability(username)
        .then((result) => {
          if (isCurrent) {
            setAvailability(result);
            setPendingUsername(null);
          }
        })
        .catch(() => {
          if (isCurrent) {
            setAvailability({
              status: "invalid",
              username,
              message: "Could not check username right now.",
            });
            setPendingUsername(null);
          }
        });
    }, 350);

    return () => {
      isCurrent = false;
      window.clearTimeout(timeout);
    };
  }, [username]);

  const onUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextUsername = normalizeUsername(event.target.value);
    setError(null);
    setUsername(nextUsername);
    setPendingUsername(nextUsername || null);
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await completeUsername({ username });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      window.location.assign(callbackUrl || `/users/${result.username}`);
    });
  };

  const canSubmit = availability.status === "available" && !pendingUsername;

  return (
    <form className="mt-8 space-y-6" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="username">{usernameLabel}</Label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="username"
            name="username"
            placeholder="jessicavdm"
            autoComplete="username"
            className="h-12 rounded-md pl-12 text-base"
            value={username}
            onChange={onUsernameChange}
            required
          />
        </div>
        <div className="min-h-6 text-sm font-medium">
          {pendingUsername ? (
            <p className="text-muted-foreground">Checking username...</p>
          ) : availability.status === "available" ? (
            <p className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="size-4" />
              {availability.message}
            </p>
          ) : availability.status === "taken" || availability.status === "invalid" ? (
            <p className="flex items-start gap-2 text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              {availability.message}
            </p>
          ) : null}
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
        disabled={!canSubmit || isPending}
      >
        <LockKeyhole className="size-4" />
        {isPending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
