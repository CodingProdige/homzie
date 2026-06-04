"use client";

import Link from "next/link";
import { Camera, Heart, Home, Mail, Send } from "lucide-react";

import { HomzieLogo } from "@/components/homzie-logo";

const footerSections = [
  {
    title: "Explore",
    links: [
      { href: "/agents", label: "Agents" },
      { href: "/listings", label: "Listings" },
      { href: "/reels", label: "Reels" },
      { href: "/become-agent", label: "Become an agent" },
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
];

export function GlobalFooter({ viewerUsername }: { viewerUsername?: string }) {
  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <Link href="/" aria-label="Homzie home" className="inline-flex">
            <HomzieLogo variant="tight" className="h-10" />
          </Link>
          <p className="mt-4 max-w-sm text-sm font-semibold leading-6 text-muted-foreground">
            Property discovery built around agents, listings, and reels that move buyers from interest to action.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Link
              href="/reels"
              aria-label="Homzie reels"
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-primary"
            >
              <Send className="size-4" />
            </Link>
            <Link
              href={viewerUsername ? `/users/${viewerUsername}?tab=saved` : "/sign-in"}
              aria-label="Saved homes"
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-primary"
            >
              <Heart className="size-4" />
            </Link>
            <Link
              href="/agents"
              aria-label="Agents"
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-primary"
            >
              <Home className="size-4" />
            </Link>
            <Link
              href="mailto:hello@homzie.app"
              aria-label="Email Homzie"
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-primary"
            >
              <Mail className="size-4" />
            </Link>
            <Link
              href="#"
              aria-label="Homzie social"
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition hover:text-primary"
            >
              <Camera className="size-4" />
            </Link>
          </div>
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
            </nav>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs font-bold text-muted-foreground">
        &copy; {new Date().getFullYear()} Homzie. Find it. Love it. Live it.
      </div>
    </footer>
  );
}
