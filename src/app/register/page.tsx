import { AuthShell } from "@/modules/auth/components/auth-shell";
import { getAgencyNetworkOptions } from "@/modules/agencies/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const callbackUrl =
    query.callbackUrl?.startsWith("/") && !query.callbackUrl.startsWith("//")
      ? query.callbackUrl
      : undefined;
  const networkOptions = await getAgencyNetworkOptions();

  return (
    <AuthShell
      callbackUrl={callbackUrl}
      mode="register"
      networkOptions={networkOptions}
    />
  );
}
