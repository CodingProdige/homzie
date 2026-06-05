import Link from "next/link";
import { BadgeCheck, ChevronRight } from "lucide-react";

import { InstallHomzieSettingsRow } from "@/modules/pwa/components/pwa-install";
import { settingsItems } from "./settings-items";
import { SettingsPageHeader } from "./settings-page-header";

type SettingsMobileScreenProps = {
  avatarUrl: string | null;
  initials: string;
  name: string;
  username: string;
};

function MobileAvatar({
  avatarUrl,
  initials,
  name,
}: {
  avatarUrl: string | null;
  initials: string;
  name: string;
}) {
  return (
    <div className="relative mx-auto flex size-24 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-1 sm:size-32 lg:size-36">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Stored avatars may be local media paths.
        <img
          src={avatarUrl}
          alt={name}
          className="size-full rounded-full border-4 border-background object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center rounded-full border-4 border-background bg-brand-midnight text-3xl font-bold text-white sm:text-4xl">
          {initials}
        </div>
      )}
    </div>
  );
}

export function SettingsMobileScreen({
  avatarUrl,
  initials,
  name,
  username,
}: SettingsMobileScreenProps) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1180px] bg-background px-4 pb-8 text-foreground sm:px-6 lg:px-10">
      <SettingsPageHeader
        title="Profile settings"
      />

      <section className="mt-6 border-b border-border pb-8 text-center sm:mt-8 sm:pb-10">
        <MobileAvatar avatarUrl={avatarUrl} initials={initials} name={name} />
        <div className="mt-5 flex items-center justify-center gap-2">
          <p className="max-w-[280px] truncate text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            {name}
          </p>
          <span
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full [background:var(--homzie-gradient)] text-white shadow-lg shadow-primary/20 ring-2 ring-background sm:size-6"
            title="Verified Homzie agent"
          >
            <BadgeCheck className="size-3.5 sm:size-4" />
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
          @{username}
        </p>
      </section>

      <nav className="mt-8 space-y-3">
        <InstallHomzieSettingsRow />
        {settingsItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={[
                "flex h-[54px] min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-4 shadow-[0_8px_24px_rgba(13,13,20,0.035)] transition-colors hover:border-primary/35",
                item.destructive ? "text-destructive hover:border-destructive/35" : "",
              ].join(" ")}
            >
              <Icon
                className={[
                  "size-4 shrink-0",
                  item.destructive ? "text-destructive" : "text-muted-foreground",
                ].join(" ")}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-black">
                {item.label}
              </span>
              <ChevronRight
                className={[
                  "size-4 shrink-0",
                  item.destructive ? "text-destructive" : "text-muted-foreground",
                ].join(" ")}
              />
            </Link>
          );
        })}
      </nav>
    </main>
  );
}
