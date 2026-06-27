"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Mail, Share2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type ShareTarget = {
  brand: "whatsapp" | "facebook" | "sms" | "email";
  label: string;
  getHref: (url: string, text: string) => string;
};

const shareTargets: ShareTarget[] = [
  {
    brand: "whatsapp",
    label: "WhatsApp",
    getHref: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    brand: "facebook",
    label: "Facebook",
    getHref: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    brand: "sms",
    label: "SMS",
    getHref: (url, text) => `sms:?&body=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    brand: "email",
    label: "Email",
    getHref: (url, text) =>
      `mailto:?subject=${encodeURIComponent("Homzie performance")}&body=${encodeURIComponent(`${text} ${url}`)}`,
  },
];

export function PerformanceShareDialog({
  username,
  name,
  isOwner = false,
}: {
  username: string;
  name: string;
  isOwner?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const performancePath = `/users/${username}/performance`;
  const shareText = `View ${name}'s Homzie Agent performance`;

  function getPerformanceUrl() {
    return `${window.location.origin}${performancePath}`;
  }

  async function copyPerformanceLink() {
    try {
      await navigator.clipboard.writeText(getPerformanceUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareWithDevice() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${name} performance on Homzie`,
          text: shareText,
          url: getPerformanceUrl(),
        });
        return;
      }

      await copyPerformanceLink();
    } catch {
      // Native share rejects when a user cancels the sheet.
    }
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button className="w-full min-w-0 px-2 text-xs shadow-md shadow-primary/20 sm:w-auto sm:px-4 sm:text-sm">
          <Upload className="size-4" />
          <span className="sm:hidden">Share</span>
          <span className="hidden sm:inline">
            {isOwner ? "Share my performance" : "Share this performance"}
          </span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[1.75rem] border border-border bg-background p-5 text-foreground shadow-2xl outline-none sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[min(92vw,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                Share performance
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm font-normal text-muted-foreground">
                Send @{username}&apos;s proof-backed performance page.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-foreground"
                aria-label="Close share performance"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 rounded-lg border bg-card p-3">
            <p className="truncate text-sm font-bold">{performancePath}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-brand-black text-sm font-semibold text-white transition-opacity hover:opacity-95"
              onClick={() => void shareWithDevice()}
            >
              <Share2 className="size-4" />
              Share with device
            </button>
            <button
              type="button"
              className="flex h-12 items-center justify-center gap-2 rounded-lg border bg-background text-sm font-semibold transition-colors hover:bg-accent"
              onClick={() => void copyPerformanceLink()}
            >
              {copied ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-3">
            {shareTargets.map((target) => (
              <a
                key={target.label}
                href={target.getHref(getPerformanceUrl(), shareText)}
                className="flex min-w-0 flex-col items-center gap-2 rounded-lg p-2 text-xs font-bold transition-colors hover:bg-accent"
                target={target.brand === "sms" || target.brand === "email" ? undefined : "_blank"}
                rel={target.brand === "sms" || target.brand === "email" ? undefined : "noreferrer"}
              >
                <span className="grid size-11 place-items-center rounded-full bg-secondary shadow-sm">
                  <PerformanceShareBrandIcon brand={target.brand} />
                </span>
                <span className="max-w-full truncate">{target.label}</span>
              </a>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PerformanceShareBrandIcon({ brand }: { brand: ShareTarget["brand"] }) {
  if (brand === "whatsapp") {
    return (
      <svg className="size-7" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#25D366" />
        <path
          fill="#fff"
          d="M16.1 7.1a8.7 8.7 0 0 0-7.4 13.3L7.7 25l4.8-1.2a8.7 8.7 0 1 0 3.6-15.7Zm0 1.6a7.1 7.1 0 0 1 6.1 10.8 7.1 7.1 0 0 1-8.3 2.8l-.3-.1-2.8.7.8-2.7-.2-.3a7.1 7.1 0 0 1 4.7-11.2Zm-3 3.7c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.1 0 1.3.9 2.5 1 2.7.2.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.7.5 0 1.6-.7 1.8-1.3.2-.6.2-1.1.1-1.3-.1-.1-.2-.2-.5-.4l-1.8-.9c-.3-.1-.5-.1-.7.2l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4Z"
        />
      </svg>
    );
  }

  if (brand === "facebook") {
    return (
      <svg className="size-7" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#1877F2" />
        <path
          fill="#fff"
          d="M18.3 27V17h3.1l.5-3.9h-3.6v-2.5c0-1.1.3-1.9 1.9-1.9H22V5.2c-.4-.1-1.7-.2-3.2-.2-3.2 0-5.4 2-5.4 5.5v3.1H10V17h3.4v10h4.9Z"
        />
      </svg>
    );
  }

  if (brand === "sms") {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-[#34C759] text-[9px] font-semibold text-white">
        SMS
      </span>
    );
  }

  return <Mail className="size-6 text-foreground" />;
}
