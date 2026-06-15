"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MessageCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startConversationAction } from "@/modules/messages/actions";

type ChatNowButtonProps = {
  className?: string;
  disabled?: boolean;
  disabledLabel?: string;
  icon?: "message" | "send";
  listingId?: string;
  recipientUserId: string | null;
  showFullLabel?: boolean;
  mobileIconOnly?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  surface?: "default" | "activity-table" | "intent-high" | "intent-low";
  variant?: "default" | "outline" | "ghost";
};

export function ChatNowButton({
  className,
  disabled = false,
  disabledLabel = "Guest",
  icon = "send",
  listingId,
  mobileIconOnly = false,
  recipientUserId,
  showFullLabel = true,
  size = "sm",
  surface = "default",
  variant,
}: ChatNowButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const Icon = icon === "send" ? Send : MessageCircle;
  const resolvedVariant = variant || "default";
  const surfaceClassName =
    surface === "activity-table"
      ? "h-8 min-w-8 rounded-full px-0 text-xs font-black shadow-none"
      : surface === "intent-high" || surface === "intent-low"
        ? "h-7 rounded-full px-2.5 text-[11px] font-black shadow-none sm:h-8 sm:px-3 sm:text-xs"
        : "rounded-full font-black shadow-none";

  if (!recipientUserId) {
    return (
      <span
        className="text-xs font-semibold text-muted-foreground"
        title="Guest viewers cannot be messaged yet"
      >
        {disabledLabel}
      </span>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={resolvedVariant}
      disabled={disabled || pending}
      className={cn("gap-1.5 whitespace-nowrap font-semibold", surfaceClassName, className)}
      onClick={() => {
        startTransition(async () => {
          const result = await startConversationAction({
            listingId,
            recipientUserId,
          });

          router.push(`/messages?conversation=${result.conversationId}`);
        });
      }}
    >
      <Icon className="size-3.5" />
      {showFullLabel ? (
        <>
          <span
            className={
              mobileIconOnly || surface === "activity-table"
                ? "sr-only"
                : "hidden whitespace-nowrap sm:inline"
            }
          >
            {pending ? "Opening..." : "Chat now"}
          </span>
          {mobileIconOnly || surface === "activity-table" ? null : (
            <span className="whitespace-nowrap sm:hidden">{pending ? "..." : "Chat"}</span>
          )}
        </>
      ) : (
        <span className="whitespace-nowrap">{pending ? "..." : "Chat"}</span>
      )}
    </Button>
  );
}
