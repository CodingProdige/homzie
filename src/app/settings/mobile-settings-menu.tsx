"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  Bookmark,
  Clapperboard,
  CreditCard,
  Home,
  LogOut,
  Search,
  Settings,
  User,
  UsersRound,
} from "lucide-react";

import { BackButton } from "@/components/back-button";

const settingGroups = [
  {
    title: "How you use Homzie",
    items: [
      {
        label: "Edit profile",
        description: "Name, handle, bio and profile photo",
        icon: User,
        href: "#",
      },
      {
        label: "Reels",
        description: "Manage property videos",
        icon: Clapperboard,
        href: "#",
      },
      {
        label: "Listings",
        description: "Manage linked property listings",
        icon: Home,
        href: "#",
      },
      {
        label: "Saved",
        description: "Saved homes and collections",
        icon: Bookmark,
        href: "#",
      },
    ],
  },
  {
    title: "For professionals",
    items: [
      {
        label: "Professional account",
        description: "Agent profile and creator tools",
        icon: UsersRound,
        href: "/become-agent",
      },
      {
        label: "Analytics",
        description: "Audience and property performance",
        icon: BarChart3,
        href: "#",
      },
      {
        label: "Leads",
        description: "Enquiries and viewing interest",
        icon: UsersRound,
        href: "#",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        label: "Settings",
        description: "Security and account preferences",
        icon: Settings,
        href: "#",
      },
      {
        label: "Notifications",
        description: "Email and product alerts",
        icon: Bell,
        href: "#",
      },
      {
        label: "Billing",
        description: "Subscription, invoices and payment methods",
        icon: CreditCard,
        href: "/settings/billing",
      },
      {
        label: "Connected accounts",
        description: "Social sign-in and future integrations",
        icon: UsersRound,
        href: "#",
      },
      {
        label: "Log out",
        description: "Sign out of this device",
        icon: LogOut,
        href: "#",
      },
    ],
  },
];

export function MobileSettingsMenu() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedQuery) {
      return settingGroups;
    }

    return settingGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.description} ${group.title}`
            .toLowerCase()
            .includes(normalizedQuery),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [normalizedQuery]);

  return (
    <div className="min-h-screen bg-background px-6 pb-10 pt-5 text-foreground lg:hidden">
      <header className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center">
        <BackButton
          showLabel={false}
          className="flex size-10 items-center justify-center rounded-full text-foreground hover:bg-accent hover:text-accent-foreground"
          iconClassName="size-6"
        />
        <h1 className="text-center text-lg font-semibold">Settings and privacy</h1>
        <span />
      </header>

      <label className="mt-7 flex h-12 items-center gap-3 rounded-full border bg-card px-5 text-muted-foreground focus-within:border-primary/40 focus-within:bg-background">
        <Search className="size-5 shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          type="search"
        />
      </label>

      <div className="mt-7 space-y-8">
        {filteredGroups.length ? (
          filteredGroups.map((group) => (
            <section key={group.title}>
              <h2 className="px-1 text-xs font-semibold text-muted-foreground">
                {group.title}
              </h2>
              <div className="mt-3 space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex min-w-0 items-center gap-4 rounded-md px-2 py-3 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <Icon className="size-6 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">
                          {item.label}
                        </span>
                        {normalizedQuery ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            No settings found.
          </p>
        )}
      </div>
    </div>
  );
}
