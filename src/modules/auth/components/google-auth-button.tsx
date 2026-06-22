"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.15v2.84C3.96 20.53 7.67 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.15C1.41 8.53 1 10.22 1 12s.41 3.47 1.15 4.94l3.69-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.67 1 3.96 3.47 2.15 7.06l3.69 2.84C6.71 7.3 9.14 5.37 12 5.37z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  callbackUrl,
  label,
}: {
  callbackUrl?: string;
  label: string;
}) {
  const onboardingUrl = callbackUrl
    ? `/onboarding/username?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/onboarding/username";

  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full text-base"
      onClick={() => signIn("google", { callbackUrl: onboardingUrl })}
    >
      <GoogleIcon />
      {label}
    </Button>
  );
}
