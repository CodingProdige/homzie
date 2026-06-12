import Link from "next/link";

import { countryFlagFromLocation } from "@/modules/location/country-preference";

export type UserProfileCardData = {
  avatarUrl: string | null;
  displayName: string;
  headline: string | null;
  isPromoted?: boolean;
  location: string | null;
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

export function UserProfileCard({ profile }: { profile: UserProfileCardData }) {
  const locationFlag = countryFlagFromLocation(profile.location);

  return (
    <Link
      href={`/users/${profile.username}`}
      draggable={false}
      className="group flex w-52 shrink-0 flex-col items-center gap-3 overflow-hidden rounded-lg border border-border bg-card px-4 py-5 text-center text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
          <span className="grid size-14 place-items-center rounded-full border-2 border-background bg-brand-midnight text-base font-black text-white">
            {initials(profile.displayName)}
          </span>
        )}
      </div>

      <div className="min-w-0 w-full">
        <p className="truncate text-sm font-black">{profile.displayName}</p>
        <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
          @{profile.username}
        </p>
        {profile.location ? (
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
            {locationFlag ? <span className="mr-1">{locationFlag}</span> : null}
            {profile.location}
          </p>
        ) : null}
        {profile.headline ? (
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-muted-foreground">
            {profile.headline}
          </p>
        ) : null}
      </div>

      {typeof profile.soldCount === "number" ? (
        <div className="w-full rounded-md bg-muted px-3 py-2 text-xs">
          {profile.totalSoldValueLabel && profile.soldCount > 0 ? (
            <>
              <p className="font-black text-primary">{profile.totalSoldValueLabel} sold</p>
              <p className="mt-0.5 font-semibold text-muted-foreground">
                {profile.soldCount} {profile.soldCount === 1 ? "sale" : "sales"} past year
              </p>
            </>
          ) : (
            <p className="font-semibold text-muted-foreground">Building sales record</p>
          )}
        </div>
      ) : null}

      {profile.isPromoted ? (
        <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
          Promoted
        </span>
      ) : null}
    </Link>
  );
}
