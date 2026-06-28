"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImageIcon,
  Link2,
  Minus,
  Plus,
  Send,
  TextCursorInput,
  Trash2,
  Upload,
  UserRound,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  defaultBroadcastBlocks,
  type BroadcastAudience,
  type BroadcastBlock,
} from "@/modules/broadcasts/types";

import {
  type BroadcastActionState,
  saveBroadcastCampaignAction,
  sendBroadcastTestAction,
} from "./actions";

type BroadcastComposerProps = {
  campaignId?: string;
  initialAudience?: BroadcastAudience;
  initialAudienceCount?: number;
  initialBlocks?: BroadcastBlock[];
  initialName?: string;
  initialPreheader?: string | null;
  initialStatus?: string;
  initialSubject?: string;
};

type BroadcastImageUploadResult = {
  error?: string;
  image?: {
    name: string;
    path: string;
    size: number;
    type: string;
    url: string;
  };
};

const roleOptions = [
  { label: "All email-enabled users", value: "all" },
  { label: "Home seekers", value: "home_seeker" },
  { label: "Private sellers", value: "private_seller" },
  { label: "Property agents", value: "property_agent" },
  { label: "Developers", value: "developer" },
];

const blockOptions = [
  { icon: TextCursorInput, label: "Hero", type: "hero" },
  { icon: TextCursorInput, label: "Text", type: "text" },
  { icon: ImageIcon, label: "Image", type: "image" },
  { icon: Video, label: "Video", type: "video" },
  { icon: Link2, label: "Button", type: "button" },
  { icon: ImageIcon, label: "Listing", type: "listing" },
  { icon: UserRound, label: "Agent", type: "agent" },
  { icon: Minus, label: "Divider", type: "divider" },
] as const;

const emptyBroadcastActionState: BroadcastActionState = {
  message: "",
  ok: false,
};

function makeId(type: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${type}-${crypto.randomUUID()}`;
  }

  return `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blockTemplate(type: (typeof blockOptions)[number]["type"]): BroadcastBlock {
  const id = makeId(type);

  if (type === "hero") {
    return {
      body: "Give readers one clear reason to care.",
      eyebrow: "Homzie update",
      id,
      title: "Your headline goes here",
      type,
    };
  }

  if (type === "text") {
    return {
      body: "Add helpful body copy. Keep the paragraph focused and direct.",
      id,
      type,
    };
  }

  if (type === "image") {
    return { alt: "", id, type, url: "" };
  }

  if (type === "video") {
    return {
      body: "Add a short reason to watch.",
      id,
      label: "Watch video",
      thumbnailAlt: "",
      thumbnailUrl: "",
      title: "Featured video",
      type,
      url: "",
    };
  }

  if (type === "button") {
    return { href: "/", id, label: "Open Homzie", type };
  }

  if (type === "listing") {
    return {
      href: "/listings",
      id,
      imageUrl: "",
      location: "",
      price: "",
      title: "Featured listing",
      type,
    };
  }

  if (type === "agent") {
    return {
      avatarUrl: "",
      headline: "Property specialist",
      href: "/agents",
      id,
      name: "Featured agent",
      type,
    };
  }

  return { id, type };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </label>
  );
}

function TextArea({
  disabled,
  onChange,
  placeholder,
  rows = 4,
  value,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  value: string;
}) {
  return (
    <textarea
      className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      value={value}
    />
  );
}

function PreviewBlock({ block }: { block: BroadcastBlock }) {
  if (block.type === "hero") {
    return (
      <div>
        {block.eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            {block.eyebrow}
          </p>
        ) : null}
        <h3 className="mt-2 text-2xl font-semibold tracking-tight">{block.title}</h3>
        {block.body ? (
          <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
            {block.body}
          </p>
        ) : null}
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <p className="whitespace-pre-line text-sm font-normal leading-6 text-muted-foreground">
        {block.body}
      </p>
    );
  }

  if (block.type === "button") {
    return (
      <span className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        {block.label}
      </span>
    );
  }

  if (block.type === "image") {
    return (
      <div className="grid aspect-[16/9] place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted text-xs text-muted-foreground">
        {block.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={block.alt || ""}
            className="h-full w-full object-cover"
            src={block.url}
          />
        ) : (
          "Image URL"
        )}
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="grid aspect-video place-items-center bg-muted text-xs text-muted-foreground">
          {block.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={block.thumbnailAlt || block.title}
              className="h-full w-full object-cover"
              src={block.thumbnailUrl}
            />
          ) : (
            <Video className="size-7 text-primary" />
          )}
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold">{block.title}</p>
          {block.body ? (
            <p className="mt-1 text-xs text-muted-foreground">{block.body}</p>
          ) : null}
          <span className="mt-3 inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            {block.label || "Watch video"}
          </span>
        </div>
      </div>
    );
  }

  if (block.type === "listing") {
    return (
      <div className="rounded-lg border border-border bg-background p-3">
        <p className="text-sm font-semibold">{block.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {[block.location, block.price].filter(Boolean).join(" - ") || "Listing card"}
        </p>
      </div>
    );
  }

  if (block.type === "agent") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {block.name.charAt(0).toUpperCase() || "A"}
        </span>
        <span>
          <span className="block text-sm font-semibold">{block.name}</span>
          <span className="block text-xs text-muted-foreground">
            {block.headline || "Agent card"}
          </span>
        </span>
      </div>
    );
  }

  if (block.type === "divider") {
    return <div className="h-px bg-border" />;
  }

  return (
    <p className="text-xs font-normal leading-5 text-muted-foreground">{block.body}</p>
  );
}

export function BroadcastComposer({
  campaignId,
  initialAudience,
  initialAudienceCount = 0,
  initialBlocks,
  initialName = "",
  initialPreheader = "",
  initialStatus = "draft",
  initialSubject = "",
}: BroadcastComposerProps) {
  const router = useRouter();
  const [saveState, saveAction, saving] = useActionState(
    saveBroadcastCampaignAction,
    emptyBroadcastActionState,
  );
  const [testState, testAction, testing] = useActionState(
    sendBroadcastTestAction,
    emptyBroadcastActionState,
  );
  const [name, setName] = useState(initialName);
  const [subject, setSubject] = useState(initialSubject);
  const [preheader, setPreheader] = useState(initialPreheader || "");
  const [testRecipient, setTestRecipient] = useState("");
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadErrorByBlockId, setUploadErrorByBlockId] = useState<
    Record<string, string>
  >({});
  const [audience, setAudience] = useState<BroadcastAudience>({
    role: "all",
    ...initialAudience,
  });
  const [blocks, setBlocks] = useState<BroadcastBlock[]>(
    initialBlocks?.length ? initialBlocks : defaultBroadcastBlocks,
  );
  const effectiveCampaignId = saveState.campaignId || campaignId;
  const isLocked = initialStatus === "sending" || initialStatus === "sent";

  useEffect(() => {
    if (!campaignId && saveState.ok && saveState.campaignId) {
      router.replace(`/admin/broadcasts/${saveState.campaignId}`);
    }
  }, [campaignId, router, saveState.campaignId, saveState.ok]);

  const audienceJson = useMemo(() => JSON.stringify(audience), [audience]);
  const blocksJson = useMemo(() => JSON.stringify(blocks), [blocks]);

  function updateBlock<T extends BroadcastBlock>(
    block: T,
    patch: Partial<T>,
  ) {
    setBlocks((current) =>
      current.map((item) =>
        item.id === block.id ? ({ ...item, ...patch } as BroadcastBlock) : item,
      ),
    );
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  async function uploadBroadcastImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/admin/broadcasts/upload", {
      body: formData,
      method: "POST",
    });
    const result = (await response.json()) as BroadcastImageUploadResult;

    if (!response.ok || !result.image?.url) {
      throw new Error(result.error || "Upload failed.");
    }

    return result.image;
  }

  async function uploadImage(
    block: Extract<BroadcastBlock, { type: "image" }>,
    file: File,
  ) {
    setUploadingBlockId(block.id);
    setUploadErrorByBlockId((current) => {
      const next = { ...current };
      delete next[block.id];
      return next;
    });

    try {
      const image = await uploadBroadcastImage(file);

      updateBlock(block, {
        alt: block.alt || file.name.replace(/\.[^.]+$/, ""),
        url: image.url,
      });
    } catch (error) {
      setUploadErrorByBlockId((current) => ({
        ...current,
        [block.id]: error instanceof Error ? error.message : "Upload failed.",
      }));
    } finally {
      setUploadingBlockId(null);
    }
  }

  async function uploadVideoThumbnail(
    block: Extract<BroadcastBlock, { type: "video" }>,
    file: File,
  ) {
    setUploadingBlockId(block.id);
    setUploadErrorByBlockId((current) => {
      const next = { ...current };
      delete next[block.id];
      return next;
    });

    try {
      const image = await uploadBroadcastImage(file);

      updateBlock(block, {
        thumbnailAlt: block.thumbnailAlt || file.name.replace(/\.[^.]+$/, ""),
        thumbnailUrl: image.url,
      });
    } catch (error) {
      setUploadErrorByBlockId((current) => ({
        ...current,
        [block.id]: error instanceof Error ? error.message : "Upload failed.",
      }));
    } finally {
      setUploadingBlockId(null);
    }
  }

  return (
    <form action={saveAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      {effectiveCampaignId ? (
        <input name="campaignId" type="hidden" value={effectiveCampaignId} />
      ) : null}
      <input name="audienceJson" type="hidden" value={audienceJson} />
      <input name="blocksJson" type="hidden" value={blocksJson} />

      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Campaign
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                Email broadcast
              </h2>
              <p className="mt-2 text-sm font-normal leading-6 text-muted-foreground">
                Create branded campaign email content, choose an audience, send a
                test, then send or schedule from the campaign detail page.
              </p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
              {initialStatus}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel>Campaign name</FieldLabel>
              <Input
                disabled={isLocked}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="June product update"
                required
                value={name}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Subject</FieldLabel>
              <Input
                disabled={isLocked}
                maxLength={180}
                name="subject"
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Find homes. Chat live. List free."
                required
                value={subject}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <FieldLabel>Preheader</FieldLabel>
              <Input
                disabled={isLocked}
                maxLength={240}
                name="preheader"
                onChange={(event) => setPreheader(event.target.value)}
                placeholder="A short inbox preview line"
                value={preheader}
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Audience
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                Target email-enabled users
              </h2>
              <p className="mt-2 text-sm font-normal text-muted-foreground">
                Current saved audience count: {initialAudienceCount}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel>Role</FieldLabel>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                disabled={isLocked}
                onChange={(event) =>
                  setAudience((current) => ({
                    ...current,
                    role: event.target.value as BroadcastAudience["role"],
                  }))
                }
                value={audience.role || "all"}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <FieldLabel>Country</FieldLabel>
              <Input
                disabled={isLocked}
                onChange={(event) =>
                  setAudience((current) => ({
                    ...current,
                    country: event.target.value,
                  }))
                }
                placeholder="South Africa"
                value={audience.country || ""}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Province</FieldLabel>
              <Input
                disabled={isLocked}
                onChange={(event) =>
                  setAudience((current) => ({
                    ...current,
                    province: event.target.value,
                  }))
                }
                placeholder="Western Cape"
                value={audience.province || ""}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Signed up after</FieldLabel>
              <Input
                disabled={isLocked}
                onChange={(event) =>
                  setAudience((current) => ({
                    ...current,
                    createdAfter: event.target.value,
                  }))
                }
                type="date"
                value={audience.createdAfter || ""}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Signed up before</FieldLabel>
              <Input
                disabled={isLocked}
                onChange={(event) =>
                  setAudience((current) => ({
                    ...current,
                    createdBefore: event.target.value,
                  }))
                }
                type="date"
                value={audience.createdBefore || ""}
              />
            </div>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold">
                <input
                  checked={Boolean(audience.hasListings)}
                  disabled={isLocked}
                  onChange={(event) =>
                    setAudience((current) => ({
                      ...current,
                      hasListings: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Has listings
              </label>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold">
                <input
                  checked={Boolean(audience.hasReels)}
                  disabled={isLocked}
                  onChange={(event) =>
                    setAudience((current) => ({
                      ...current,
                      hasReels: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Has reels
              </label>
              <label className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold">
                <input
                  checked={Boolean(audience.requireMarketingOptIn)}
                  disabled={isLocked}
                  onChange={(event) =>
                    setAudience((current) => ({
                      ...current,
                      requireMarketingOptIn: event.target.checked,
                    }))
                  }
                  type="checkbox"
                />
                Product updates only
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Builder
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                Content blocks
              </h2>
            </div>
            {!isLocked ? (
              <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <Button type="button">
                    <Plus className="size-4" />
                    Add block
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    className="z-[120] w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
                    sideOffset={8}
                  >
                    {blockOptions.map((option) => {
                      const Icon = option.icon;

                      return (
                        <DropdownMenu.Item
                          className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold outline-none transition-colors focus:bg-accent focus:text-accent-foreground"
                          key={option.type}
                          onSelect={() =>
                            setBlocks((current) => [
                              ...current,
                              blockTemplate(option.type),
                            ])
                          }
                        >
                          <Icon className="size-4 text-primary" />
                          <span>{option.label}</span>
                        </DropdownMenu.Item>
                      );
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {blocks.map((block, index) => (
              <div
                className="rounded-lg border border-border bg-background p-4"
                key={block.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold capitalize">{block.type}</p>
                  {!isLocked ? (
                    <div className="flex items-center gap-1">
                      <Button
                        aria-label="Move block up"
                        disabled={index === 0}
                        onClick={() => moveBlock(index, -1)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        aria-label="Move block down"
                        disabled={index === blocks.length - 1}
                        onClick={() => moveBlock(index, 1)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        aria-label="Remove block"
                        onClick={() => removeBlock(block.id)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3">
                  {block.type === "hero" ? (
                    <>
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { eyebrow: event.target.value })
                        }
                        placeholder="Eyebrow"
                        value={block.eyebrow || ""}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { title: event.target.value })
                        }
                        placeholder="Hero title"
                        value={block.title}
                      />
                      <TextArea
                        disabled={isLocked}
                        onChange={(value) => updateBlock(block, { body: value })}
                        placeholder="Hero body"
                        value={block.body || ""}
                      />
                    </>
                  ) : null}

                  {block.type === "text" || block.type === "footer" ? (
                    <TextArea
                      disabled={isLocked}
                      onChange={(value) => updateBlock(block, { body: value })}
                      value={block.body}
                    />
                  ) : null}

                  {block.type === "image" ? (
                    <>
                      {block.url ? (
                        <div className="overflow-hidden rounded-lg border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={block.alt || ""}
                            className="max-h-64 w-full object-cover"
                            src={block.url}
                          />
                        </div>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Input
                          disabled={isLocked}
                          onChange={(event) =>
                            updateBlock(block, { url: event.target.value })
                          }
                          placeholder="Image URL"
                          value={block.url}
                        />
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                          {uploadingBlockId === block.id ? (
                            <span className="size-4 rounded-full border-2 border-primary/25 border-t-primary motion-safe:animate-spin" />
                          ) : block.url ? (
                            <Check className="size-4" />
                          ) : (
                            <Upload className="size-4" />
                          )}
                          <span>
                            {uploadingBlockId === block.id
                              ? "Uploading"
                              : block.url
                                ? "Replace"
                                : "Upload"}
                          </span>
                          <input
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={isLocked || uploadingBlockId === block.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) void uploadImage(block, file);
                            }}
                            type="file"
                          />
                        </label>
                      </div>
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { alt: event.target.value })
                        }
                        placeholder="Alt text"
                        value={block.alt || ""}
                      />
                      {uploadErrorByBlockId[block.id] ? (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                          {uploadErrorByBlockId[block.id]}
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {block.type === "video" ? (
                    <>
                      {block.thumbnailUrl ? (
                        <div className="overflow-hidden rounded-lg border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={block.thumbnailAlt || block.title}
                            className="max-h-64 w-full object-cover"
                            src={block.thumbnailUrl}
                          />
                        </div>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          disabled={isLocked}
                          onChange={(event) =>
                            updateBlock(block, { title: event.target.value })
                          }
                          placeholder="Video title"
                          value={block.title}
                        />
                        <Input
                          disabled={isLocked}
                          onChange={(event) =>
                            updateBlock(block, { label: event.target.value })
                          }
                          placeholder="CTA label"
                          value={block.label || ""}
                        />
                        <Input
                          className="md:col-span-2"
                          disabled={isLocked}
                          onChange={(event) =>
                            updateBlock(block, { url: event.target.value })
                          }
                          placeholder="Video URL"
                          value={block.url}
                        />
                      </div>
                      <TextArea
                        disabled={isLocked}
                        onChange={(value) => updateBlock(block, { body: value })}
                        placeholder="Short supporting copy"
                        rows={3}
                        value={block.body || ""}
                      />
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <Input
                          disabled={isLocked}
                          onChange={(event) =>
                            updateBlock(block, {
                              thumbnailUrl: event.target.value,
                            })
                          }
                          placeholder="Thumbnail image URL"
                          value={block.thumbnailUrl || ""}
                        />
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-semibold shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                          {uploadingBlockId === block.id ? (
                            <span className="size-4 rounded-full border-2 border-primary/25 border-t-primary motion-safe:animate-spin" />
                          ) : block.thumbnailUrl ? (
                            <Check className="size-4" />
                          ) : (
                            <Upload className="size-4" />
                          )}
                          <span>
                            {uploadingBlockId === block.id
                              ? "Uploading"
                              : block.thumbnailUrl
                                ? "Replace"
                                : "Upload"}
                          </span>
                          <input
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={isLocked || uploadingBlockId === block.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) void uploadVideoThumbnail(block, file);
                            }}
                            type="file"
                          />
                        </label>
                      </div>
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { thumbnailAlt: event.target.value })
                        }
                        placeholder="Thumbnail alt text"
                        value={block.thumbnailAlt || ""}
                      />
                      {uploadErrorByBlockId[block.id] ? (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                          {uploadErrorByBlockId[block.id]}
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {block.type === "button" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { label: event.target.value })
                        }
                        placeholder="Button label"
                        value={block.label}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { href: event.target.value })
                        }
                        placeholder="/listings"
                        value={block.href}
                      />
                    </div>
                  ) : null}

                  {block.type === "listing" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { title: event.target.value })
                        }
                        placeholder="Listing title"
                        value={block.title}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { price: event.target.value })
                        }
                        placeholder="R 2 500 000"
                        value={block.price || ""}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { location: event.target.value })
                        }
                        placeholder="Location"
                        value={block.location || ""}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { href: event.target.value })
                        }
                        placeholder="/listings/..."
                        value={block.href || ""}
                      />
                      <Input
                        className="md:col-span-2"
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { imageUrl: event.target.value })
                        }
                        placeholder="Image URL"
                        value={block.imageUrl || ""}
                      />
                    </div>
                  ) : null}

                  {block.type === "agent" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { name: event.target.value })
                        }
                        placeholder="Agent name"
                        value={block.name}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { headline: event.target.value })
                        }
                        placeholder="Headline"
                        value={block.headline || ""}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { href: event.target.value })
                        }
                        placeholder="/users/..."
                        value={block.href || ""}
                      />
                      <Input
                        disabled={isLocked}
                        onChange={(event) =>
                          updateBlock(block, { avatarUrl: event.target.value })
                        }
                        placeholder="Avatar URL"
                        value={block.avatarUrl || ""}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {!isLocked ? (
          <div className="sticky bottom-4 z-10 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-[30rem]">
                <Input
                  name="recipientEmail"
                  onChange={(event) => setTestRecipient(event.target.value)}
                  placeholder="Test recipient email"
                  type="email"
                  value={testRecipient}
                />
                <Button
                  disabled={testing || !testRecipient}
                  formAction={testAction}
                  type="submit"
                  variant="outline"
                >
                  <Send className="size-4" />
                  {testing ? "Sending" : "Send test"}
                </Button>
              </div>
              <Button disabled={saving} type="submit">
                <Plus className="size-4" />
                {saving ? "Saving" : "Save draft"}
              </Button>
            </div>
            {[saveState, testState].map((state, index) =>
              state.message ? (
                <p
                  className={cn(
                    "mt-3 rounded-md px-3 py-2 text-sm font-semibold",
                    state.ok
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-destructive/10 text-destructive",
                  )}
                  key={`${state.message}-${index}`}
                >
                  {state.message}
                </p>
              ) : null,
            )}
          </div>
        ) : null}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Preview
          </p>
          <h2 className="mt-2 text-lg font-semibold">{subject || "Subject"}</h2>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            {preheader || "Preheader preview"}
          </p>
          <div className="mt-5 space-y-4 rounded-lg border border-border bg-background p-4">
            {blocks.map((block) => (
              <PreviewBlock block={block} key={block.id} />
            ))}
          </div>
        </div>
      </aside>
    </form>
  );
}
