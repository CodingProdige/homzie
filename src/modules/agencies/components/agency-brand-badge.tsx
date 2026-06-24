import Image from "next/image";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { AgencyBadgeStyle } from "@/modules/agencies/brand-style";
import {
  defaultAgencyBadgeStyle,
} from "@/modules/agencies/brand-style";
import type { EffectiveAgencyBrand } from "@/modules/agencies/server";

type AgencyBrandBadgeProps = {
  brand: Pick<
    EffectiveAgencyBrand,
    "badgeLabel" | "badgeStyle" | "logoUrl" | "name"
  >;
  className?: string;
  logoClassName?: string;
  size?: "sm" | "md";
};

function badgeStyle(value?: AgencyBadgeStyle): CSSProperties {
  const style = value || defaultAgencyBadgeStyle;

  return {
    backgroundColor: style.backgroundColor,
    borderRadius: style.borderRadius,
    color: style.textColor,
    fontFamily: style.fontFamily,
    fontWeight: Number(style.fontWeight),
  };
}

export function AgencyBrandBadge({
  brand,
  className,
  logoClassName,
  size = "md",
}: AgencyBrandBadgeProps) {
  const logoWidth = size === "sm" ? 42 : 64;
  const logoHeight = size === "sm" ? 14 : 20;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 border border-border shadow-sm",
        size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs",
        className,
      )}
      style={badgeStyle(brand.badgeStyle)}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-sm bg-primary/10 text-primary",
          size === "sm"
            ? "h-4 w-12 text-[8px]"
            : "h-6 w-[4.5rem] text-[10px]",
          logoClassName,
        )}
      >
        {brand.logoUrl ? (
          <Image
            src={brand.logoUrl}
            alt=""
            width={logoWidth}
            height={logoHeight}
            className="size-full object-contain"
          />
        ) : (
          brand.name.slice(0, 2).toUpperCase()
        )}
      </span>
      <span className="truncate">{brand.badgeLabel}</span>
    </span>
  );
}
