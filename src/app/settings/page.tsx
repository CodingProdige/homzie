import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import {
  BarChart3,
  Bell,
  Bookmark,
  ChevronRight,
  Clapperboard,
  CreditCard,
  Home,
  LogOut,
  Settings,
  TrendingUp,
  User,
  UsersRound,
} from "lucide-react";

import { BackButton } from "@/components/back-button";
import { db } from "@/db";
import { users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import { MobileSettingsMenu } from "./mobile-settings-menu";

const mainItems = [
  {
    label: "Profile",
    description: "Name, handle, bio, photo, and public profile details.",
    icon: User,
    href: "#",
  },
  {
    label: "Reels",
    description: "Manage property videos and creator content.",
    icon: Clapperboard,
    href: "#",
  },
  {
    label: "Listings",
    description: "Create and manage linked property listings.",
    icon: Home,
    href: "#",
  },
  {
    label: "Leads",
    description: "View enquiries and viewing interest.",
    icon: UsersRound,
    href: "#",
  },
  {
    label: "Saved",
    description: "Saved homes and private browsing lists.",
    icon: Bookmark,
    href: "#",
  },
  {
    label: "Analytics",
    description: "Audience, listing, and reel performance.",
    icon: BarChart3,
    href: "#",
  },
];

const accountItems = [
  {
    label: "Account settings",
    description: "Security, preferences, and account details.",
    icon: Settings,
    href: "#",
  },
  {
    label: "Notifications",
    description: "Email, product, and booking notifications.",
    icon: Bell,
    href: "#",
  },
  {
    label: "Billing",
    description: "Subscription, invoices, and payment methods.",
    icon: CreditCard,
    href: "/settings/billing",
  },
  {
    label: "Connected accounts",
    description: "Social sign-in and future integrations.",
    icon: UsersRound,
    href: "#",
  },
  {
    label: "Log out",
    description: "Sign out of this device.",
    icon: LogOut,
    href: "#",
  },
];

function SettingsItem({
  item,
}: {
  item: {
    label: string;
    description: string;
    href: string;
    icon: typeof User;
  };
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="flex min-w-0 items-center gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{item.label}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {item.description}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function DesktopSidebar() {
  return (
    <aside className="hidden min-h-screen w-[280px] shrink-0 border-r border-border bg-background px-5 py-7 lg:flex lg:flex-col">
      <BackButton className="text-foreground hover:text-primary" />

      <nav className="mt-12 space-y-1">
        {mainItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-8 px-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Account
      </p>
      <nav className="mt-3 space-y-1">
        {accountItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg bg-[linear-gradient(135deg,rgba(123,92,255,0.1),rgba(255,77,184,0.12))] p-5">
        <p className="font-bold">Grow your brand</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Upgrade to Homzie Agent Pro to unlock more tools.
        </p>
        <Link
          href="/become-agent"
          className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary"
        >
          Upgrade now
          <TrendingUp className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

export default async function SettingsPage() {
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

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <MobileSettingsMenu />
      <DesktopSidebar />

      <main className="hidden min-w-0 flex-1 px-5 py-6 sm:px-8 lg:block lg:px-10 lg:py-8">
        <div className="flex items-center justify-between gap-4">
          <BackButton className="text-foreground hover:text-primary lg:hidden" />
          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary ring-2 ring-primary">
              {user.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || "H"}
            </div>
            <span className="font-semibold">{user.name}</span>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Choose what you want to manage.
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Profile tools
            </p>
            {mainItems.map((item) => (
              <SettingsItem key={item.label} item={item} />
            ))}
          </section>

          <section className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Account
            </p>
            {accountItems.map((item) => (
              <SettingsItem key={item.label} item={item} />
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
