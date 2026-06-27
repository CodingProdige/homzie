"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  enablePushNotifications,
  getBrowserNotificationStatus,
  type BrowserNotificationStatus,
} from "@/modules/push/components/push-notification-bootstrap";

const promptDismissedKey = "homzie:browser-notification-prompt-dismissed:v1";

function hasDismissedPrompt() {
  try {
    return sessionStorage.getItem(promptDismissedKey) === "true";
  } catch {
    return true;
  }
}

function dismissPromptForSession() {
  try {
    sessionStorage.setItem(promptDismissedKey, "true");
  } catch {
    return;
  }
}

function shouldPrompt(status: BrowserNotificationStatus) {
  return status.status !== "enabled" && status.status !== "unsupported";
}

function promptText(status: BrowserNotificationStatus | null) {
  if (!status) {
    return {
      body: "Checking whether this browser can receive Homzie alerts.",
      title: "Checking browser alerts",
    };
  }

  if (status.status === "blocked") {
    return {
      body: "Chrome is blocking Homzie alerts on this browser. Allow notifications for this site, then check again.",
      title: "Browser alerts are blocked",
    };
  }

  if (status.status === "not-connected") {
    return {
      body: "Notifications are allowed, but this browser still needs an active push connection.",
      title: "Reconnect buyer alerts",
    };
  }

  return {
    body: "Turn them on so Homzie can notify you when buyers view, save, like, offer, or message.",
    title: "Buyer alerts are off",
  };
}

export function BrowserNotificationPrompt({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<BrowserNotificationStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const refreshStatus = useCallback(async () => {
    const nextStatus = await getBrowserNotificationStatus();
    setStatus(nextStatus);

    if (nextStatus.status === "enabled") {
      setIsVisible(false);
      return nextStatus;
    }

    if (shouldPrompt(nextStatus) && !hasDismissedPrompt()) {
      setIsVisible(true);
    }

    return nextStatus;
  }, []);

  useEffect(() => {
    if (!enabled || hasDismissedPrompt()) return;

    const timeoutId = window.setTimeout(() => {
      void refreshStatus();
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled, refreshStatus]);

  if (!enabled || !isVisible || !status || status.status === "unsupported") {
    return null;
  }

  const text = promptText(status);
  const isBlocked = status.status === "blocked";
  const hasPermission = status.permission === "granted";
  const primaryLabel = hasPermission ? "Connect alerts" : "Enable alerts";

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[120] sm:left-auto sm:w-[30rem]">
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-2xl shadow-primary/15 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            {isBlocked ? (
              <BellOff className="size-4" />
            ) : status.status === "not-connected" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Bell className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold leading-5">{text.title}</p>
                <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
                  {text.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  dismissPromptForSession();
                  setIsVisible(false);
                }}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Dismiss browser notification prompt"
              >
                <X className="size-4" />
              </button>
            </div>

            {error ? (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold leading-5 text-destructive">
                {error}
              </p>
            ) : null}

            {isBlocked ? (
              <div className="mt-4 rounded-lg border border-primary/15 bg-primary/5 p-3">
                <p className="text-xs font-bold text-foreground">
                  Allow alerts in Chrome
                </p>
                <ol className="mt-2 space-y-2 text-xs font-normal leading-5 text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-bold text-primary">1.</span>
                    <span>Click the site controls icon next to the address.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-primary">2.</span>
                    <span>Turn Notifications on, or open Site settings and set Notifications to Allow.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-primary">3.</span>
                    <span>Come back here and click Check again.</span>
                  </li>
                </ol>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              {isBlocked ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setError("");
                    startTransition(async () => {
                      await refreshStatus();
                    });
                  }}
                  className="h-10 w-full rounded-md px-3 text-xs font-semibold"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  I changed it, check again
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setError("");
                    startTransition(async () => {
                      try {
                        const nextStatus = await enablePushNotifications();
                        setStatus(nextStatus);

                        if (nextStatus.status === "enabled") {
                          setIsVisible(false);
                        }
                      } catch (nextError) {
                        setError(
                          nextError instanceof Error
                            ? nextError.message
                            : "Could not enable browser alerts.",
                        );
                        await refreshStatus();
                      }
                    });
                  }}
                  className="h-10 w-full rounded-md px-3 text-xs font-semibold"
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Bell className="size-3.5" />
                  )}
                  {primaryLabel}
                </Button>
              )}
              <button
                type="button"
                onClick={() => {
                  dismissPromptForSession();
                  setIsVisible(false);
                }}
                className="h-9 w-full rounded-md px-3 text-xs font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
