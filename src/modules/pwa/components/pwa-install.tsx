"use client";

import { useEffect, useState } from "react";
import { ChevronRight, MonitorDown } from "lucide-react";

type BeforeInstallPromptOutcome = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptOutcome>;
};

const installPromptEventName = "homzie-install-prompt-change";

declare global {
  interface Window {
    __homzieInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function notifyInstallPromptChange() {
  window.dispatchEvent(new Event(installPromptEventName));
}

export function PwaInstallBootstrap() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__homzieInstallPrompt = event as BeforeInstallPromptEvent;
      notifyInstallPromptChange();
    };

    const handleAppInstalled = () => {
      window.__homzieInstallPrompt = null;
      notifyInstallPromptChange();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}

export function InstallHomzieSettingsRow() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const updateInstallAvailability = () => {
      setCanInstall(Boolean(window.__homzieInstallPrompt) && !isStandaloneDisplay());
    };

    updateInstallAvailability();
    window.addEventListener(installPromptEventName, updateInstallAvailability);

    return () => {
      window.removeEventListener(installPromptEventName, updateInstallAvailability);
    };
  }, []);

  if (!canInstall) return null;

  return (
    <button
      type="button"
      className="flex h-[54px] min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-4 text-left shadow-[0_8px_24px_rgba(13,13,20,0.035)] transition-colors hover:border-primary/35"
      onClick={async () => {
        const installPrompt = window.__homzieInstallPrompt;
        if (!installPrompt) return;

        window.__homzieInstallPrompt = null;
        setCanInstall(false);
        await installPrompt.prompt();
        await installPrompt.userChoice;
        notifyInstallPromptChange();
      }}
    >
      <MonitorDown className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-black">
        Install Homzie
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
