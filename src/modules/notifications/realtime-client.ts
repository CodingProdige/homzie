export const userNotificationCreatedBrowserEvent =
  "homzie:user-notification-created";

export type UserNotificationRealtimeEvent = {
  conversationId?: string | null;
  createdAt: string;
  entityId?: string | null;
  entityType?: string | null;
  eventId?: string | null;
  eventType: string;
  listingId?: string | null;
  messageId?: string | null;
  reelId?: string | null;
  type: "user.notification.created";
  userId: string;
};

export function dispatchUserNotificationCreated(
  event: UserNotificationRealtimeEvent,
) {
  window.dispatchEvent(
    new CustomEvent<UserNotificationRealtimeEvent>(
      userNotificationCreatedBrowserEvent,
      { detail: event },
    ),
  );
}

export function addUserNotificationCreatedListener(
  listener: (event: UserNotificationRealtimeEvent) => void,
) {
  const onNotificationCreated = (event: Event) => {
    listener((event as CustomEvent<UserNotificationRealtimeEvent>).detail);
  };

  window.addEventListener(
    userNotificationCreatedBrowserEvent,
    onNotificationCreated,
  );

  return () => {
    window.removeEventListener(
      userNotificationCreatedBrowserEvent,
      onNotificationCreated,
    );
  };
}

export function isListingNotification(event: UserNotificationRealtimeEvent) {
  return event.eventType.startsWith("listing.") || Boolean(event.listingId);
}
