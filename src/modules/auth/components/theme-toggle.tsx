"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";

const themeCookieName = "homzie-theme";
const themeMaxAgeSeconds = 60 * 60 * 24 * 365;

const modes: Array<{ mode: ThemeMode; icon: typeof Sun; label: string }> = [
  { mode: "light", icon: Sun, label: "Light mode" },
  { mode: "dark", icon: Moon, label: "Dark mode" },
];

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light";
}

function applyTheme(mode: ThemeMode) {
  const shouldUseDark = mode === "dark";

  document.documentElement.classList.toggle("dark", shouldUseDark);
  document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
}

function persistTheme(mode: ThemeMode) {
  window.localStorage.setItem("homzie-theme", mode);
  document.cookie = `${themeCookieName}=${encodeURIComponent(mode)}; Max-Age=${themeMaxAgeSeconds}; Path=/; SameSite=Lax`;
  document.cookie = "homzie-theme-effective=; Max-Age=0; Path=/; SameSite=Lax";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const storedMode = window.localStorage.getItem(themeCookieName);
    const nextMode = document.documentElement.classList.contains("dark")
      ? "dark"
      : isThemeMode(storedMode)
      ? storedMode
      : "light";

    applyTheme(nextMode);

    const frameId = window.requestAnimationFrame(() => {
      setMode(nextMode);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const updateMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    applyTheme(nextMode);
    persistTheme(nextMode);
  };

  return (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
      {modes.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.mode}
            type="button"
            aria-label={item.label}
            aria-pressed={mode === item.mode}
            onClick={() => updateMode(item.mode)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
              mode === item.mode && "bg-secondary text-foreground",
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
