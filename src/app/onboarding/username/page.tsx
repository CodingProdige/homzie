import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { HomzieLogo } from "@/components/homzie-logo";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { UsernameOnboardingForm } from "@/modules/auth/components/username-onboarding-form";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";
import { usernameFromName } from "@/modules/auth/username";
import {
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";

export default async function UsernameOnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const query = searchParams ? await searchParams : {};
  const callbackUrl =
    query.callbackUrl?.startsWith("/") && !query.callbackUrl.startsWith("//")
      ? query.callbackUrl
      : null;

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user, agencyWorkspace] = await Promise.all([
    db
      .select({
        name: users.name,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)
      .then(([row]) => row || null),
    getPrimaryAgencyWorkspace(session.user.id),
  ]);

  if (!user) {
    redirect("/sign-in");
  }

  if (user.username) {
    redirect(callbackUrl || `/users/${user.username}`);
  }

  const agencyAccountLabel = agencyWorkspace
    ? agencyTypeLabel(agencyWorkspace.agency.agencyType)
    : "";
  const suggestedUsername = usernameFromName(
    agencyWorkspace?.agency.name || user.name || "",
  );
  const title = agencyWorkspace
    ? `Choose your ${agencyAccountLabel} username`
    : "Choose your username";
  const description = agencyWorkspace
    ? `This public handle represents ${agencyWorkspace.agency.name} on Homzie. You can still use your personal profile details later.`
    : "This is how people will find and recognize your profile on Homzie.";

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col justify-center">
        <div className="mb-5 flex justify-end">
          <ThemeToggle />
        </div>

        <Card className="rounded-lg border-border/80 py-9 shadow-xl shadow-primary/5">
          <CardContent className="px-7 sm:px-10">
            <div className="text-center">
              <HomzieLogo className="mx-auto h-9" priority />
              <h1 className="mt-10 text-2xl font-bold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-muted-foreground">
                {description}
              </p>
            </div>

            <UsernameOnboardingForm
              callbackUrl={callbackUrl || undefined}
              suggestedUsername={suggestedUsername}
              usernameLabel={agencyWorkspace ? `${agencyAccountLabel} username` : "Username"}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
