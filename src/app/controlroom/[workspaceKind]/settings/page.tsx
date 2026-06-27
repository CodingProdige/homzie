import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  BadgeCheck,
  ChevronRight,
  Crown,
  Palette,
  Settings2,
  Share2,
} from "lucide-react";

import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Control Room Settings | Homzie",
  description: "Choose a control room settings area to manage.",
};

type ControlRoomSettingsPageProps = {
  params: Promise<{
    workspaceKind: string;
  }>;
};

const settingsItems = [
  {
    description: "Review parent network links, branch status, billing posture, and visibility.",
    href: "hierarchy",
    icon: Share2,
    label: "Hierarchy",
  },
  {
    description: "Manage logo, badge label, Network HQ branding rules, and branch brand locks.",
    href: "branding",
    icon: Palette,
    label: "Branding",
  },
  {
    description: "Transfer agency or Network HQ ownership to another verified Homzie account.",
    href: "ownership",
    icon: Crown,
    label: "Ownership",
  },
  {
    description: "Review what your current role can access inside this control room.",
    href: "permissions",
    icon: Settings2,
    label: "Permissions",
  },
];

export default async function ControlRoomSettingsPage({
  params,
}: ControlRoomSettingsPageProps) {
  const [{ workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) {
    redirect("/controlroom");
  }

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/controlroom/${kind}/settings`);
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) {
    redirect(`/controlroom/${kind}`);
  }

  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(`${controlRoomPathForWorkspace(workspace)}/settings`);
  }

  const basePath = `/controlroom/${kind}/settings`;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Control room
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-normal leading-7 text-muted-foreground">
          Choose a settings area to manage for {workspace.agency.name}.
        </p>
        <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-normal text-muted-foreground shadow-sm">
          <BadgeCheck className="size-4 text-primary" />
          {agencyTypeLabel(workspace.agency.agencyType)}
        </span>
      </div>

      <nav className="mt-8 grid gap-3" aria-label="Control room settings">
        {settingsItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={`${basePath}/${item.href}`}
              className="flex min-h-20 min-w-0 items-center gap-4 rounded-lg border border-border bg-card px-4 py-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-accent/30"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-1 block text-sm font-normal leading-6 text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
