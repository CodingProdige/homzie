"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Download,
  Loader2,
  MonitorDown,
  PlusSquare,
  Share,
  Smartphone,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enablePushNotifications } from "@/modules/push/components/push-notification-bootstrap";

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
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function notifyInstallPromptChange() {
  window.dispatchEvent(new Event(installPromptEventName));
}

function onIdle(callback: () => void) {
  if ("requestIdleCallback" in window) {
    const idleId = window.requestIdleCallback(callback, { timeout: 3000 });

    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 1500);

  return () => globalThis.clearTimeout(timeoutId);
}

export function PwaInstallBootstrap() {
  useEffect(() => {
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
    const cancelIdleWork = onIdle(() => {
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      }
    });

    return () => {
      cancelIdleWork();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}

function getPlatformLabel() {
  if (typeof window === "undefined") return "desktop";

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIpadOSDesktop =
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(userAgent) || isIpadOSDesktop) return "ios";
  if (/android/.test(userAgent)) return "android";

  return "desktop";
}

export function usePwaInstallState() {
  const [canPromptInstall, setCanPromptInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstallState = () => {
      setPlatform(getPlatformLabel());
      setIsInstalled(isStandaloneDisplay());
      setCanPromptInstall(Boolean(window.__homzieInstallPrompt) && !isStandaloneDisplay());
      setNotificationPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
    };

    updateInstallState();
    window.addEventListener(installPromptEventName, updateInstallState);
    displayModeQuery.addEventListener?.("change", updateInstallState);

    return () => {
      window.removeEventListener(installPromptEventName, updateInstallState);
      displayModeQuery.removeEventListener?.("change", updateInstallState);
    };
  }, []);

  return {
    canPromptInstall,
    isInstalled,
    notificationPermission,
    platform,
  };
}

export async function promptHomzieInstall() {
  const installPrompt = window.__homzieInstallPrompt;

  if (!installPrompt) return null;

  window.__homzieInstallPrompt = null;
  notifyInstallPromptChange();
  await installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  notifyInstallPromptChange();

  return choice;
}

export function InstallHomzieButton({
  className,
  label = "Install Homzie",
  compact = false,
  onOpen,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
  onOpen?: () => void;
}) {
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-12 w-full min-w-0 items-center justify-center gap-3 rounded-md bg-[image:var(--homzie-gradient)] px-5 text-center text-sm font-semibold text-white shadow-[0_14px_30px_rgba(123,92,255,0.28)] transition hover:scale-[1.005] hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2",
            compact && "h-9 w-auto px-3 text-xs",
            className,
          )}
        >
          <MonitorDown className={cn("size-4 shrink-0", compact && "size-3.5")} />
          <span className="min-w-0 truncate">{label}</span>
          <ChevronRight className={cn("size-4 shrink-0", compact && "size-3.5")} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-brand-midnight/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[110] w-[min(calc(100vw-1.25rem),34rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/15 bg-brand-midnight text-white shadow-2xl outline-none">
          <Dialog.Title className="sr-only">Install Homzie</Dialog.Title>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-20 size-9 rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"
              aria-label="Close install flow"
            >
              <X className="size-4" />
            </Button>
          </Dialog.Close>
          <Dialog.Description className="sr-only">
            Install Homzie as a progressive web app and enable buyer alerts.
          </Dialog.Description>
          <PwaInstallFlow />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function InstallHomzieSettingsRow() {
  return <InstallHomzieButton />;
}

function InstructionStep({
  icon: Icon,
  label,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-white/65">
          {detail}
        </span>
      </span>
    </div>
  );
}

export function PwaInstallFlow({ className }: { className?: string }) {
  const { canPromptInstall, isInstalled, notificationPermission, platform } =
    usePwaInstallState();
  const [isPromptingInstall, setIsPromptingInstall] = useState(false);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const [notice, setNotice] = useState("");
  const [installWasTried, setInstallWasTried] = useState(false);
  const notificationsEnabled = notificationPermission === "granted";
  const notificationsBlocked = notificationPermission === "denied";
  const isIos = platform === "ios";
  const needsInstall = !isInstalled;
  const needsNotifications =
    !notificationsEnabled &&
    !notificationsBlocked &&
    notificationPermission !== "unsupported";
  const ready = !needsInstall && !needsNotifications;
  const stepNumber = needsInstall ? 1 : needsNotifications ? 2 : 3;
  const headline = needsInstall
    ? "Install Homzie in one click."
    : needsNotifications
      ? "Turn on buyer alerts."
      : "You are all set.";
  const body = needsInstall
    ? "Get Homzie on this device for faster access, realtime buyer updates, messages, and listing activity without hunting through browser tabs."
    : needsNotifications
      ? "Let Homzie tell you when buyers view, save, like, offer, or message while interest is still hot."
      : "Homzie is installed and alerts are ready. Open it from your device whenever buyer activity starts moving.";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[radial-gradient(circle_at_18%_10%,rgba(123,92,255,0.44),transparent_31%),radial-gradient(circle_at_92%_18%,rgba(255,77,184,0.35),transparent_34%)] p-6 sm:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-12 size-44 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-8 size-56 rounded-full bg-[#ff4db8]/20 blur-3xl" />

      <div className="relative">
        <div className="mx-auto flex size-20 items-center justify-center rounded-[1.6rem] bg-white/10 text-white shadow-2xl shadow-primary/20 ring-1 ring-white/15 sm:size-24">
          {ready ? (
            <Check className="size-10" />
          ) : needsNotifications ? (
            <Bell className="size-10" />
          ) : (
            <Smartphone className="size-10" />
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={cn(
                "h-2 rounded-full transition-all",
                step <= stepNumber ? "w-8 bg-white" : "w-2 bg-white/25",
              )}
            />
          ))}
        </div>

        <div className="mx-auto mt-6 max-w-md text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            <Sparkles className="size-3.5" />
            Homzie app setup
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {headline}
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/72">{body}</p>
        </div>

        <div className="mx-auto mt-7 grid max-w-md gap-3">
          {needsInstall && canPromptInstall ? (
            <Button
              type="button"
              size="lg"
              disabled={isPromptingInstall}
              onClick={async () => {
                setNotice("");
                setInstallWasTried(true);
                setIsPromptingInstall(true);
                const choice = await promptHomzieInstall();
                setIsPromptingInstall(false);
                if (choice?.outcome === "dismissed") {
                  setNotice("No stress. Tap the button again when you are ready.");
                }
              }}
              className="h-14 w-full rounded-md bg-[image:var(--homzie-gradient)] text-base font-semibold text-white shadow-[0_18px_45px_rgba(123,92,255,0.4)] hover:scale-[1.01] hover:opacity-95"
            >
              {isPromptingInstall ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <MonitorDown className="size-5" />
              )}
              Click here to install
              <ChevronRight className="size-5" />
            </Button>
          ) : null}

          {needsInstall && !canPromptInstall ? (
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 text-left">
              <p className="text-sm font-semibold text-white">
                {isIos ? "Install from Safari" : "Open your browser install option"}
              </p>
              <div className="mt-4 grid gap-3">
                {isIos ? (
                  <>
                    <InstructionStep
                      icon={Share}
                      label="Tap Share"
                      detail="Open Homzie in Safari, then tap the share icon."
                    />
                    <InstructionStep
                      icon={PlusSquare}
                      label="Add to Home Screen"
                      detail="Choose Add to Home Screen and keep the name as Homzie."
                    />
                    <InstructionStep
                      icon={Check}
                      label="Tap Add"
                      detail="Homzie will appear on your Home Screen."
                    />
                  </>
                ) : (
                  <>
                    <InstructionStep
                      icon={Download}
                      label="Use Chrome or Edge"
                      detail="Open the browser menu and choose Install app when it appears."
                    />
                    <InstructionStep
                      icon={Check}
                      label="Keep the name Homzie"
                      detail="Then open Homzie from your device like an app."
                    />
                  </>
                )}
              </div>
            </div>
          ) : null}

          {!needsInstall && needsNotifications ? (
            <>
              <Button
                type="button"
                size="lg"
                disabled={isEnablingNotifications}
                onClick={async () => {
                  setNotice("");
                  setIsEnablingNotifications(true);
                  try {
                    await enablePushNotifications();
                    setNotice("Notifications are enabled.");
                  } catch (error) {
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "Could not enable notifications.",
                    );
                  } finally {
                    setIsEnablingNotifications(false);
                  }
                }}
                className="h-14 w-full rounded-md bg-[image:var(--homzie-gradient)] text-base font-semibold text-white shadow-[0_18px_45px_rgba(123,92,255,0.4)] hover:scale-[1.01] hover:opacity-95"
              >
                {isEnablingNotifications ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Bell className="size-5" />
                )}
                Click here to enable alerts
                <ChevronRight className="size-5" />
              </Button>
              <button
                type="button"
                className="text-sm font-bold text-white/60 transition hover:text-white"
                onClick={() =>
                  setNotice("You can enable alerts later from this same install button.")
                }
              >
                Maybe later
              </button>
            </>
          ) : null}

          {notificationsBlocked ? (
            <div className="rounded-lg border border-red-300/25 bg-red-500/10 p-4 text-sm font-bold leading-6 text-red-100">
              Notifications are blocked in this browser. Allow Homzie in browser settings,
              then come back here.
            </div>
          ) : null}

          {notificationPermission === "unsupported" && !needsInstall ? (
            <div className="rounded-lg border border-white/15 bg-white/10 p-4 text-sm font-semibold leading-6 text-white/70">
              This browser does not support notifications. On iPhone, open Homzie from
              the installed app and allow alerts there.
            </div>
          ) : null}

          {ready ? (
            <div className="rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">
              Done. Homzie is installed and buyer alerts are enabled.
            </div>
          ) : null}

          {notice ? (
            <p className="text-center text-xs font-bold text-white/60">{notice}</p>
          ) : null}

          {installWasTried && needsInstall && !canPromptInstall && !isIos ? (
            <p className="text-center text-xs font-semibold leading-5 text-white/50">
              If the browser prompt was dismissed, reload Homzie and tap install again.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
