"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

import { getMessageSocketUrl } from "@/modules/messages/socket-url";
import {
  dispatchUserNotificationCreated,
  type UserNotificationRealtimeEvent,
} from "@/modules/notifications/realtime-client";

export function MessageRealtimePresence({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const socket = io(getMessageSocketUrl(), {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true,
    });

    socket.on(
      "user.notification.created",
      (event: UserNotificationRealtimeEvent) => {
        dispatchUserNotificationCreated(event);
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [enabled]);

  return null;
}
