"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

import { getMessageSocketUrl } from "@/modules/messages/socket-url";

export function MessageRealtimePresence({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;

    const socket = io(getMessageSocketUrl(), {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true,
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled]);

  return null;
}
