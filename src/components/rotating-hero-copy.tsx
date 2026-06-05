"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const heroLines = [
  "The number one platform connecting agents with buyers.",
  "Build your agent portfolio and sell with proof.",
  "Discover trusted listings, reels, and agent performance in one place.",
  "Find homes faster with agents who can show their track record.",
];

export function RotatingHeroCopy({ className }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % heroLines.length);
    }, 8_000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <p
      className={cn(
        "grid min-h-[3rem] place-items-center transition-colors",
        className,
      )}
    >
      <span key={heroLines[activeIndex]} className="animate-in fade-in duration-500">
        {heroLines[activeIndex]}
      </span>
    </p>
  );
}
