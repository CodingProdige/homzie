"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, Pin, PinOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  markErrorLogReadAction,
  markErrorLogUnreadAction,
  pinErrorLogAction,
  unpinErrorLogAction,
} from "./actions";

export function ErrorLogRowActions({
  copyPayload,
  errorLogId,
  isPinned,
  isRead,
}: {
  copyPayload: string;
  errorLogId: string;
  isPinned: boolean;
  isRead: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyDetails() {
    await navigator.clipboard.writeText(copyPayload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <form action={isRead ? markErrorLogUnreadAction : markErrorLogReadAction}>
        <input name="errorLogId" type="hidden" value={errorLogId} />
        <Button size="sm" type="submit" variant="outline">
          {isRead ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {isRead ? "Unread" : "Read"}
        </Button>
      </form>

      <form action={isPinned ? unpinErrorLogAction : pinErrorLogAction}>
        <input name="errorLogId" type="hidden" value={errorLogId} />
        <Button size="sm" type="submit" variant="outline">
          {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          {isPinned ? "Unpin" : "Pin"}
        </Button>
      </form>

      <Button size="sm" type="button" variant="outline" onClick={() => void copyDetails()}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
