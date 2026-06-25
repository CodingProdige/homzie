"use client";

import Link from "next/link";
import { Mail, MapPin, MonitorDown } from "lucide-react";

import { HomzieLogo } from "@/components/homzie-logo";
import { Button } from "@/components/ui/button";

const footerSections = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact us" },
      { href: "/for-agents", label: "For agents" },
      { href: "/go-pro", label: "Go Pro" },
      { href: "/become-agent", label: "Become an agent" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/agents", label: "Agents" },
      { href: "/reels", label: "Reels" },
      { href: "/listings", label: "Listings" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/settings", label: "Settings" },
      { href: "/settings/billing", label: "Billing" },
    ],
  },
  {
    title: "Policies",
    links: [
      { href: "/privacy-policy", label: "Privacy policy" },
      { href: "/terms-of-service", label: "Terms of service" },
      { href: "/cookie-policy", label: "Cookie policy" },
      { href: "/community-guidelines", label: "Community guidelines" },
    ],
  },
];

export function GlobalFooter({
  viewerRole,
  viewerUsername,
}: {
  viewerRole?: "user" | "admin";
  viewerUsername?: string;
}) {
  const isAdmin = viewerRole === "admin";

  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="border-b border-border px-4 py-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 rounded-xl border border-border bg-background p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-sm font-black text-foreground">
              Get the full Homzie experience on your device.
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
              Install Homzie for faster access, realtime buyer alerts, messages, and app-like browsing.
            </p>
          </div>
          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link href="/install">
              <MonitorDown className="size-4" />
              Install Homzie
            </Link>
          </Button>
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.25fr_repeat(5,1fr)] lg:px-8">
        <div>
          <Link href="/" aria-label="Homzie home" className="inline-flex">
            <HomzieLogo variant="tight" className="h-10" />
          </Link>
          <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-muted-foreground">
            Property discovery built around agents, listings, and reels that move buyers from interest to action.
          </p>
        </div>

        {footerSections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-black">{section.title}</h2>
            <nav className="mt-4 grid gap-3 text-sm font-semibold text-muted-foreground">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition hover:text-primary"
                >
                  {link.label}
                </Link>
              ))}
              {section.title === "Account" && viewerUsername ? (
                <Link
                  href={`/users/${viewerUsername}`}
                  className="transition hover:text-primary"
                >
                  My profile
                </Link>
              ) : null}
              {section.title === "Account" && isAdmin ? (
                <Link
                  href="/admin"
                  className="transition hover:text-primary"
                >
                  Admin dashboard
                </Link>
              ) : null}
            </nav>
          </div>
        ))}

        <div>
          <h2 className="text-sm font-black">Support</h2>
          <div className="mt-4 grid gap-4 text-sm font-semibold text-muted-foreground">
            <Link
              href="mailto:support@homzie.co.za"
              className="flex items-start gap-2 transition hover:text-primary"
            >
              <Mail className="mt-0.5 size-4 shrink-0" />
              <span>support@homzie.co.za</span>
            </Link>
            <address className="flex items-start gap-2 not-italic leading-6">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>
                6 Christelle Str, Denneburg
                <br />
                Paarl, Western Cape
                <br />
                South Africa, 7646
              </span>
            </address>
          </div>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-center gap-3 text-center text-xs font-bold text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
          <span>&copy; {new Date().getFullYear()} Homzie. Find it. Love it. Live it.</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-black text-muted-foreground">
            Secure payments by
            <span className="text-[#635bff]">stripe</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
