import { AuthShell } from "@/modules/auth/components/auth-shell";

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const callbackUrl =
    query.callbackUrl?.startsWith("/") && !query.callbackUrl.startsWith("//")
      ? query.callbackUrl
      : undefined;

  return <AuthShell callbackUrl={callbackUrl} mode="sign-in" />;
}
