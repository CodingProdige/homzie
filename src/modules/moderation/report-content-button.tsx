"use client";

import { useState, useTransition, type ComponentProps } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Flag, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createModerationCaseAction } from "@/modules/moderation/actions";

const reasonOptions = [
  "Fake or misleading content",
  "Wrong price, location, or details",
  "Scam or unsafe behaviour",
  "Impersonation",
  "Copyright or media issue",
  "Abusive or inappropriate content",
  "Other",
];

type ReportContentButtonProps = {
  compact?: boolean;
  label?: string;
  onTrigger?: () => void;
  targetId: string;
  targetLabel: string;
  targetType: "listing" | "profile" | "reel";
  triggerClassName?: string;
  triggerSize?: ComponentProps<typeof Button>["size"];
  triggerVariant?: ComponentProps<typeof Button>["variant"];
};

export function ReportContentButton({
  compact = false,
  label = "Report",
  onTrigger,
  targetId,
  targetLabel,
  targetType,
  triggerClassName,
  triggerSize,
  triggerVariant = "outline",
}: ReportContentButtonProps) {
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasonOptions[0]);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submitReport() {
    setError("");

    startTransition(async () => {
      try {
        await createModerationCaseAction({
          details,
          reason,
          targetId,
          targetType,
        });
        setSent(true);
        setDetails("");
      } catch (reportError) {
        setError(
          reportError instanceof Error
            ? reportError.message
            : "Could not submit this report.",
        );
      }
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError("");
          setSent(false);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize || (compact ? "icon" : "default")}
          className={triggerClassName}
          aria-label={compact ? label : undefined}
          onClick={onTrigger}
        >
          <Flag className="size-4" />
          {compact ? null : label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] max-h-[calc(100dvh-2rem)] w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-background p-5 text-foreground shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                Report {targetLabel}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
                Send this to Homzie moderation for review. False or abusive reports
                may be ignored.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close report">
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          {sent ? (
            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/10 p-4">
              <p className="text-sm font-semibold text-primary">Report received.</p>
              <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
                Thanks. Homzie will review this moderation signal.
              </p>
              <Dialog.Close asChild>
                <Button type="button" className="mt-4 w-full">
                  Done
                </Button>
              </Dialog.Close>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold">
                Reason
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="h-11 rounded-md border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
                >
                  {reasonOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Details
                <textarea
                  value={details}
                  maxLength={1200}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="Add anything Homzie should know."
                  className="min-h-28 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                />
              </label>
              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="button" disabled={pending} onClick={submitReport}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
                Submit report
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
