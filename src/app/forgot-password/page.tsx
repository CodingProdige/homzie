import { ForgotPasswordForm } from "@/modules/auth/components/password-reset-forms";
import { PasswordResetShell } from "@/modules/auth/components/password-reset-shell";

export default function ForgotPasswordPage() {
  return (
    <PasswordResetShell
      title="Reset your password"
      description="Enter the email address on your Homzie account and we will send you a secure reset link."
    >
      <ForgotPasswordForm />
    </PasswordResetShell>
  );
}
