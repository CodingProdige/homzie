import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  CreditCard,
  Mail,
  Megaphone,
  Music,
  SearchCheck,
  UserRoundCog,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Settings | Homzie",
  description: "Manage Homzie admin platform settings.",
};

const settingsItems = [
  {
    href: "/admin/settings/demo-profile",
    icon: UserRoundCog,
    label: "Demo Profile",
    description:
      "Edit the mock agent profile, login credentials, active showcase listings, and sold-history analytics data.",
  },
  {
    href: "/admin/settings/stripe",
    icon: CreditCard,
    label: "Stripe",
    description:
      "Manage sandbox/live payment keys, webhook signing secrets, and subscription price IDs.",
  },
  {
    href: "/admin/settings/ads",
    icon: Megaphone,
    label: "Ads",
    description:
      "Control platform ad pricing, channel availability, and the forecast model users see in Ads Center.",
  },
  {
    href: "/admin/settings/seo",
    icon: SearchCheck,
    label: "SEO",
    description:
      "Control search indexing, verification tags, metadata defaults, social previews, and public page health.",
  },
  {
    href: "/admin/settings/music",
    icon: Music,
    label: "Music APIs",
    description:
      "Configure Pixabay and Freesound API keys so reel creators can browse and preview royalty-free tracks.",
  },
  {
    href: "/admin/email-templates",
    icon: Mail,
    label: "Email Templates",
    description:
      "Edit transactional emails, insert backend variables, preview HTML, and send test emails.",
  },
];

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
          Settings
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-muted-foreground">
          Choose a settings area to manage platform-level configuration.
        </p>
      </div>

      <nav className="mt-8 grid gap-3" aria-label="Admin settings">
        {settingsItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-20 min-w-0 items-center gap-4 rounded-lg border border-border bg-card px-4 py-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-accent/30"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">{item.label}</span>
                <span className="mt-1 block text-sm font-semibold leading-6 text-muted-foreground">
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
