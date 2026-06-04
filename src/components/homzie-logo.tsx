import Image from "next/image";

import { cn } from "@/lib/utils";

export function HomzieLogo({
  className,
  priority,
  variant = "full",
}: {
  className?: string;
  priority?: boolean;
  variant?: "full" | "mark" | "tight";
}) {
  if (variant === "mark") {
    return (
      <span className={cn("block overflow-hidden", className)}>
        <Image
          src="/logo/homzie-logo-dark-tight.png"
          alt="Homzie"
          width={1099}
          height={310}
          className="homzie-logo-image h-full w-auto max-w-none object-contain"
          priority={priority}
        />
      </span>
    );
  }

  return (
    <Image
      src={
        variant === "tight"
          ? "/logo/homzie-logo-dark-tight.png"
          : "/logo/homzie-logo-dark.png"
      }
      alt="Homzie"
      width={variant === "tight" ? 1099 : 160}
      height={variant === "tight" ? 310 : 58}
      className={cn("homzie-logo-image w-auto object-contain", className)}
      priority={priority}
    />
  );
}
