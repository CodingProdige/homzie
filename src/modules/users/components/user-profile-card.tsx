import Link from "next/link";

import { countryFlagFromLocation } from "@/modules/location/country-preference";

export type UserProfileCardData = {
  avatarUrl: string | null;
  displayName: string;
  headline: string | null;
  isPromoted?: boolean;
  location: string | null;
  publicPerformanceVisible?: boolean;
  soldCount?: number;
  totalSoldValueLabel?: string;
  username: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserProfileCard({
  locked = false,
  profile,
}: {
  locked?: boolean;
  profile: UserProfileCardData;
}) {
  const locationFlag = countryFlagFromLocation(profile.location);
  const href = locked
    ? `/register?callbackUrl=${encodeURIComponent(`/users/${profile.username}`)}`
    : `/users/${profile.username}`;

  return (
    <Link
      href={href}
      draggable={false}
      className="group relative flex w-52 shrink-0 flex-col items-center gap-3 overflow-hidden rounded-lg border border-border bg-card px-4 py-5 text-center text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className={
          locked
            ? "flex w-full select-none flex-col items-center gap-3 blur-sm"
            : "flex w-full flex-col items-center gap-3"
        }
        aria-hidden={locked ? true : undefined}
      >
        <div className="rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] p-0.5 transition group-hover:scale-105">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="size-14 rounded-full border-2 border-background object-cover"
            />
          ) : (
            <span className="grid size-14 place-items-center rounded-full border-2 border-background bg-brand-midnight text-base font-semibold text-white">
              {initials(profile.displayName)}
            </span>
          )}
        </div>

        <div className="min-w-0 w-full">
          <p className="truncate text-sm font-semibold">{profile.displayName}</p>
          <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
            @{profile.username}
          </p>
          {profile.location ? (
            <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
              {locationFlag ? <span className="mr-1">{locationFlag}</span> : null}
              {profile.location}
            </p>
          ) : null}
          {profile.headline ? (
            <p className="mt-2 line-clamp-2 text-xs font-normal leading-5 text-muted-foreground">
              {profile.headline}
            </p>
          ) : null}
        </div>

        {profile.publicPerformanceVisible === false ? (
          <div className="w-full rounded-md bg-muted px-3 py-2 text-xs">
            <p className="font-normal text-muted-foreground">Performance private</p>
            <p className="mt-0.5 font-normal text-muted-foreground">
              Sales proof hidden by agent
            </p>
          </div>
        ) : typeof profile.soldCount === "number" ? (
          <div className="w-full rounded-md bg-muted px-3 py-2 text-xs">
            {profile.totalSoldValueLabel && profile.soldCount > 0 ? (
              <>
                <p className="font-semibold text-primary">{profile.totalSoldValueLabel} sold</p>
                <p className="mt-0.5 font-normal text-muted-foreground">
                  {profile.soldCount} {profile.soldCount === 1 ? "sale" : "sales"} past year
                </p>
              </>
            ) : (
              <p className="font-normal text-muted-foreground">Building sales record</p>
            )}
          </div>
        ) : null}

        {profile.isPromoted ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-normal uppercase tracking-widest text-muted-foreground/70">
            Promoted
          </span>
        ) : null}
      </div>
      {locked ? (
        <span className="absolute inset-0 grid place-items-center bg-background/55 p-4 backdrop-blur-[1px]">
          <span className="rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-lg">
            Create account to reveal
          </span>
        </span>
      ) : null}
    </Link>
  );
}
