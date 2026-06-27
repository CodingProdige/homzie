"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { addUserNotificationCreatedListener } from "@/modules/notifications/realtime-client";

export function EventsRealtimeRefresh() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(
    () =>
      addUserNotificationCreatedListener(() => {
        if (document.visibilityState !== "visible") return;

        startTransition(() => {
          router.refresh();
        });
      }),
    [router],
  );

  return null;
}
