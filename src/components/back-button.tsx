"use client";

import Link from "next/link";
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
  const baseClassName = cn(
    "inline-flex w-fit items-center gap-2 text-sm font-normal text-muted-foreground transition-colors hover:text-primary",
    className,
  );
  const icon = <ArrowLeft className={cn("size-4", iconClassName)} />;

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {icon}
        {showLabel ? label : null}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-label={showLabel ? undefined : label}
      className={baseClassName}
      onClick={() => router.back()}
    >
      {icon}
      {showLabel ? label : null}
    </button>
  );
}
