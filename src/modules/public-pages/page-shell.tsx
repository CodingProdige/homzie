import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";

import { GlobalFooter } from "@/components/global-footer";
import { GlobalHeader } from "@/components/global-header";
import { authOptions } from "@/modules/auth/config";
import { getViewerChrome } from "@/modules/auth/viewer";

export const publicHeroImage =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85";

export const teamImage =
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=85";

export const missionImage =
  "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=85";

async function getViewer() {
  const session = await getServerSession(authOptions);
  return getViewerChrome(session?.user?.id);
}

export async function PublicPageShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <GlobalHeader
        viewerAvatarUrl={viewer.avatarUrl}
        viewerHasAgencyWorkspace={viewer.hasAgencyWorkspace}
        viewerName={viewer.name}
        viewerRole={viewer.role}
        viewerUsername={viewer.username}
      />
      <main className="pt-20 lg:pt-24">{children}</main>
      <GlobalFooter viewerRole={viewer.role} viewerUsername={viewer.username} />
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-primary">
      {children}
    </p>
  );
}

export function GradientWord({ children }: { children: React.ReactNode }) {
  return <span className="homzie-gradient-text">{children}</span>;
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-md bg-[image:var(--homzie-gradient)] px-6 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(123,92,255,0.28)] transition hover:scale-[1.01]"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-semibold text-card-foreground transition hover:border-primary/40 hover:text-primary"
    >
      {children}
    </Link>
  );
}

export function RoundedImage({
  alt,
  className = "",
  src,
}: {
  alt: string;
  className?: string;
  src: string;
}) {
  return (
    <Image
      alt={alt}
      className={`rounded-lg object-cover ${className}`}
      fill
      sizes="(min-width: 1024px) 50vw, 100vw"
      src={src}
    />
  );
}
