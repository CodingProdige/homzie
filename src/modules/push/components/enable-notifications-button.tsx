"use client";

import { useState, useTransition } from "react";
import { Bell, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { enablePushNotifications } from "@/modules/push/components/push-notification-bootstrap";

export function EnableNotificationsButton() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    () =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (permission === "unsupported" || permission === "granted") return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              await enablePushNotifications();
              setPermission(Notification.permission);
            } catch (nextError) {
              setError(
                nextError instanceof Error
                  ? nextError.message
                  : "Could not enable notifications.",
              );
              setPermission(Notification.permission);
            }
          });
        }}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bell className="size-4" />
        )}
        Enable call notifications
      </Button>
      {error ? (
        <p className="text-xs font-semibold text-muted-foreground">{error}</p>
      ) : null}
    </div>
  );
}
