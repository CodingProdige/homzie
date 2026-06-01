import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";

import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { UsernameOnboardingForm } from "@/modules/auth/components/username-onboarding-form";
import { ThemeToggle } from "@/modules/auth/components/theme-toggle";
import { usernameFromName } from "@/modules/auth/username";

export default async function UsernameOnboardingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    redirect("/sign-in");
  }

  if (user.username) {
    redirect(`/users/${user.username}`);
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] flex-col justify-center">
        <div className="mb-5 flex justify-end">
          <ThemeToggle />
        </div>

        <Card className="rounded-lg border-border/80 py-9 shadow-xl shadow-primary/5">
          <CardContent className="px-7 sm:px-10">
            <div className="text-center">
              <Image
                src="/logo/homzie-logo-dark.png"
                alt="Homzie"
                width={170}
                height={62}
                className="mx-auto h-9 w-auto object-contain"
                priority
              />
              <h1 className="mt-10 text-2xl font-bold tracking-tight sm:text-3xl">
                Choose your username
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-muted-foreground">
                This is how people will find and recognize your profile on Homzie.
              </p>
            </div>

            <UsernameOnboardingForm
              suggestedUsername={usernameFromName(user.name || "")}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
