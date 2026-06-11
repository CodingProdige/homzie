import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/modules/auth/components/password-reset-forms";
import { PasswordResetShell } from "@/modules/auth/components/password-reset-shell";
import { validatePasswordResetToken } from "@/modules/auth/actions";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const query = searchParams ? await searchParams : {};
  const token = query.token || "";
  const validToken = await validatePasswordResetToken(token);

  if (!validToken) {
    return (
      <PasswordResetShell
        title="Reset link unavailable"
        description="This password reset link is invalid, expired, or has already been used."
      >
        <div className="mt-10 rounded-lg border border-border bg-card p-5 text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            Request a new email link to continue resetting your password.
          </p>
          <Button asChild className="mt-5 w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </PasswordResetShell>
    );
  }

  return (
    <PasswordResetShell
      title="Choose a new password"
      description="This secure reset link is valid. Create a new password to regain access to your Homzie account."
    >
      <ResetPasswordForm token={token} />
    </PasswordResetShell>
  );
}
