import Image from "next/image";

import { cn } from "@/lib/utils";
import { toPublicMediaUrl } from "@/media/paths";

type AgentProfileAvatarProps = {
  avatarUrl?: string | null;
  className?: string;
  name?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  lg: {
    frame: "size-24 p-1 sm:size-36 lg:size-40",
    image: 160,
    inner: "border-4 text-3xl sm:text-5xl",
  },
  md: {
    frame: "size-10 p-[2px]",
    image: 40,
    inner: "border-2 text-xs",
  },
  sm: {
    frame: "size-8 p-[2px]",
    image: 32,
    inner: "border-2 text-[10px]",
  },
} satisfies Record<string, { frame: string; image: number; inner: string }>;

function initialsFromName(value: string | null | undefined) {
  return (
    (value || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "H"
  );
}

export function AgentProfileAvatar({
  avatarUrl,
  className,
  name,
  size = "md",
}: AgentProfileAvatarProps) {
  const safeAvatarUrl = toPublicMediaUrl(avatarUrl);
  const sizing = sizeClasses[size];
  const label = name || "Agent";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_150deg,#ff4db8,#7b5cff,#ff9f1c,#ff4db8)] shadow-[0_10px_22px_rgba(123,92,255,0.16)]",
        sizing.frame,
        className,
      )}
    >
      <span
        className={cn(
          "flex size-full items-center justify-center overflow-hidden rounded-full border-background bg-brand-midnight font-bold text-white",
          sizing.inner,
        )}
      >
        {safeAvatarUrl ? (
          <Image
            src={safeAvatarUrl}
            alt={label}
            width={sizing.image}
            height={sizing.image}
            className="size-full object-cover"
          />
        ) : (
          initialsFromName(name)
        )}
      </span>
    </span>
  );
}
