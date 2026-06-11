"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export function BackButton({
  className,
  href,
  iconClassName,
  label = "Back",
  showLabel = true,
}: {
  className?: string;
  href?: string;
  iconClassName?: string;
  label?: string;
  showLabel?: boolean;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label={showLabel ? undefined : label}
      className={cn(
        "inline-flex w-fit items-center gap-3 text-sm font-medium transition-colors",
        className,
      )}
      onClick={() => (href ? router.push(href) : router.back())}
    >
      <ArrowLeft className={cn("size-4", iconClassName)} />
      {showLabel ? label : null}
    </button>
  );
}
