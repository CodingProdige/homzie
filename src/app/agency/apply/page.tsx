import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, BadgeCheck, Building2, ShieldCheck, UsersRound } from "lucide-react";

import { authOptions } from "@/modules/auth/config";
import { AgencyApplicationForm } from "./agency-application-form";
import { controlRoomPathForWorkspace } from "@/modules/agencies/control-room";
import {
  getAgencyNetworkOptions,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";

export const metadata: Metadata = {
  title: "Create Agency HQ | Homzie",
  description: "Create an agency workspace for team-controlled listings and buyer activity.",
};

export default async function AgencyApplyPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/agency/apply");
  }

  const [workspace, networkOptions] = await Promise.all([
    getPrimaryAgencyWorkspace(session.user.id),
    getAgencyNetworkOptions(),
  ]);

  if (workspace) {
    redirect(controlRoomPathForWorkspace(workspace));
  }

  return (
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href="/controlroom"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Control room
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Agency onboarding
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Create your Agency HQ
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
              Set up the workspace agencies need for controlled listing quality,
              linked agents, team billing, and shared buyer activity oversight.
            </p>
            <AgencyApplicationForm networkOptions={networkOptions} />
          </section>

          <aside className="grid content-start gap-3">
            {[
              {
                icon: Building2,
                title: "Agency-owned listings",
                text: "Prepare the ownership layer before listings can be assigned, reviewed, or transferred.",
              },
              {
                icon: UsersRound,
                title: "Team controls",
                text: "Invite agents, assign roles, and decide who may publish directly or submit requests.",
              },
              {
                icon: BadgeCheck,
                title: "Brand consistency",
                text: "Show agency identity on linked agents and listings once the branding layer is active.",
              },
              {
                icon: ShieldCheck,
                title: "Central oversight",
                text: "Roll buyer activity and performance into one agency view without removing agent workflows.",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="mt-3 text-base font-black">{item.title}</h2>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              );
            })}
          </aside>
        </div>
      </main>
  );
}
