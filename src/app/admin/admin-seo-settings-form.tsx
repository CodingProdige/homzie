"use client";

import { type ChangeEvent, useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageUp, Save, SearchCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAdminSeoSettings,
  type AdminSeoSettingsState,
} from "./actions";

export type AdminSeoSettingsView = {
  allowIndexing: boolean;
  bingVerification: string;
  defaultDescription: string;
  defaultOgHeadline: string;
  defaultOgImageUrl: string;
  defaultOgSubtitle: string;
  defaultUnavailableListingIndexing: string;
  googleSearchConsoleVerification: string;
  indexDemoContent: boolean;
  organizationAddress: string;
  organizationEmail: string;
  organizationName: string;
  organizationPhone: string;
  titleTemplate: string;
};

const initialState: AdminSeoSettingsState = {
  message: "",
  ok: false,
};

function SubmitButton({ label = "Save" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" />
      {pending ? "Saving..." : label}
    </Button>
  );
}

function StateMessage({ state }: { state: AdminSeoSettingsState }) {
  if (!state.message) return null;

  return (
    <p
      className={`text-sm font-bold ${state.ok ? "text-primary" : "text-destructive"}`}
    >
      {state.message}
    </p>
  );
}

function ToggleField({
  defaultChecked,
  description,
  label,
  name,
}: {
  defaultChecked: boolean;
  description: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-w-0 items-center gap-4 rounded-lg border border-border bg-background px-4 py-4">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{label}</span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:border-primary peer-checked:bg-primary peer-checked:after:translate-x-5"
      />
    </label>
  );
}

function TextField({
  description,
  label,
  name,
  placeholder,
  value,
}: {
  description?: string;
  label: string;
  name: string;
  placeholder?: string;
  value?: string | number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={String(value || "")}
        placeholder={placeholder}
      />
      {description ? (
        <p className="text-xs font-semibold leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function ControlledTextField({
  description,
  label,
  name,
  onChange,
  value,
}: {
  description?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {description ? (
        <p className="text-xs font-semibold leading-5 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

async function compressOgImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const targetWidth = 1200;
  const targetHeight = 630;
  const sourceRatio = bitmap.width / bitmap.height;
  const targetRatio = targetWidth / targetHeight;
  const sourceWidth =
    sourceRatio > targetRatio ? Math.round(bitmap.height * targetRatio) : bitmap.width;
  const sourceHeight =
    sourceRatio > targetRatio ? bitmap.height : Math.round(bitmap.width / targetRatio);
  const sourceX = Math.round((bitmap.width - sourceWidth) / 2);
  const sourceY = Math.round((bitmap.height - sourceHeight) / 2);
  const canvas = document.createElement("canvas");

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");

  if (!context) return file;

  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.86),
  );

  if (!blob) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), {
    type: "image/webp",
  });
}

function OgImageControl({
  description,
  generatedVersion,
  shareDescription,
  shareTitle,
  shareUrl,
  value,
}: {
  description: string;
  generatedVersion: string;
  shareDescription: string;
  shareTitle: string;
  shareUrl: string;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(value);
  const [message, setMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const previewUrl = imageUrl || `/opengraph-image?v=${encodeURIComponent(generatedVersion)}`;
  const absolutePreviewUrl = /^https?:\/\//i.test(previewUrl)
    ? previewUrl
    : `${shareUrl}${previewUrl.startsWith("/") ? previewUrl : `/${previewUrl}`}`;
  const shareDomain = shareUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    setMessage("Compressing image...");
    setIsUploading(true);

    try {
      const compressed = await compressOgImage(file);
      const formData = new FormData();

      formData.append("image", compressed);

      const response = await fetch("/api/admin/seo/og-image", {
        body: formData,
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        imageUrl?: string;
      };

      if (!response.ok || !result.imageUrl) {
        throw new Error(result.error || "Could not upload OG image.");
      }

      setImageUrl(result.imageUrl);
      setMessage(`Uploaded ${formatFileSize(compressed.size)} WebP at 1200x630.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload OG image.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="grid gap-2">
        <Label htmlFor="defaultOgImageUrl">Default OG image URL</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="defaultOgImageUrl"
            name="defaultOgImageUrl"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="/opengraph-image"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            <ImageUp className="size-4" />
            {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <p className="text-xs font-semibold leading-5 text-muted-foreground">
          {message || description}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="border-b border-border bg-muted/35 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            Share preview
          </p>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- Admin OG preview can render local media URLs. */}
            <img
              src={previewUrl}
              alt="Open Graph image in a shared post preview"
              className="aspect-[1200/630] w-full object-cover"
            />
            <div className="grid gap-1 border-t border-border bg-muted/30 p-4">
              <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                {shareDomain}
              </p>
              <p className="line-clamp-2 text-sm font-black leading-5">
                {shareTitle || "Homzie"}
              </p>
              <p className="line-clamp-2 text-xs font-semibold leading-5 text-muted-foreground">
                {shareDescription}
              </p>
            </div>
          </div>
          <div className="grid content-start gap-3">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- Admin OG preview can render local media URLs. */}
                <img
                  src={previewUrl}
                  alt="Compact social card image preview"
                  className="aspect-square w-24 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 self-center">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
                    {shareDomain}
                  </p>
                  <p className="line-clamp-2 text-sm font-black leading-5">
                    {shareTitle || "Homzie"}
                  </p>
                  <p className="line-clamp-2 text-xs font-semibold leading-5 text-muted-foreground">
                    {shareDescription}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border bg-muted/25 p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                Meta tags
              </p>
              <dl className="mt-3 grid gap-2 text-xs font-semibold leading-5">
                <div className="grid gap-1">
                  <dt className="text-muted-foreground">og:title</dt>
                  <dd className="break-words">{shareTitle || "Homzie"}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground">og:description</dt>
                  <dd className="break-words">{shareDescription}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground">og:image</dt>
                  <dd className="break-all">{absolutePreviewUrl}</dd>
                </div>
                <div className="grid gap-1">
                  <dt className="text-muted-foreground">og:url</dt>
                  <dd className="break-all">{shareUrl}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
        <div className="border-t border-border bg-muted/20 p-4">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            Raw 1200x630 image
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- Admin OG preview can render local media URLs. */}
          <img
            src={previewUrl}
            alt="Raw default Open Graph image"
            className="aspect-[1200/630] w-full rounded-md border border-border object-cover"
          />
        </div>
      </div>
    </div>
  );
}

export function AdminSeoSettingsForm({
  settings,
}: {
  settings: AdminSeoSettingsView;
}) {
  const [state, action] = useActionState(updateAdminSeoSettings, initialState);
  const [organizationName, setOrganizationName] = useState(settings.organizationName);
  const [defaultDescription, setDefaultDescription] = useState(
    settings.defaultDescription,
  );
  const [ogHeadline, setOgHeadline] = useState(settings.defaultOgHeadline);
  const [ogSubtitle, setOgSubtitle] = useState(settings.defaultOgSubtitle);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://homzie.co.za").replace(
    /\/$/,
    "",
  );

  return (
    <form action={action} className="space-y-5 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
          <SearchCheck className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-black">Platform SEO controls</h2>
          <p className="text-sm font-semibold text-muted-foreground">
            Defaults and verification tags used across public pages.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ToggleField
          name="allowIndexing"
          label="Allow indexing"
          description="Global kill switch for public search indexing."
          defaultChecked={settings.allowIndexing}
        />
        <ToggleField
          name="indexDemoContent"
          label="Index demo content"
          description="Allow demo users/listings into SEO surfaces."
          defaultChecked={settings.indexDemoContent}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ControlledTextField
          name="organizationName"
          label="Organization name"
          value={organizationName}
          onChange={setOrganizationName}
        />
        <TextField name="titleTemplate" label="Title template" value={settings.titleTemplate} />
        <ControlledTextField
          name="defaultDescription"
          label="Default description"
          value={defaultDescription}
          onChange={setDefaultDescription}
        />
        <div className="grid gap-2">
          <Label htmlFor="defaultOgHeadline">Default OG headline</Label>
          <Input
            id="defaultOgHeadline"
            name="defaultOgHeadline"
            value={ogHeadline}
            onChange={(event) => setOgHeadline(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultOgSubtitle">Default OG subtitle</Label>
          <Input
            id="defaultOgSubtitle"
            name="defaultOgSubtitle"
            value={ogSubtitle}
            onChange={(event) => setOgSubtitle(event.target.value)}
          />
        </div>
        <OgImageControl
          generatedVersion={`${settings.organizationName}:${ogHeadline}:${ogSubtitle}`}
          shareDescription={defaultDescription}
          shareTitle={organizationName}
          shareUrl={siteUrl}
          value={settings.defaultOgImageUrl}
          description="Leave blank to use the generated preview below, or upload a compressed 1200x630 WebP social card."
        />
        <TextField
          name="googleSearchConsoleVerification"
          label="Google Search Console verification"
          value={settings.googleSearchConsoleVerification}
          placeholder="Paste the google-site-verification content value"
          description="Used to prove Homzie ownership in Google Search Console. It does not directly boost rankings, but unlocks sitemap submission, indexing inspection, and search diagnostics."
        />
        <TextField
          name="bingVerification"
          label="Bing verification"
          value={settings.bingVerification}
          placeholder="Paste the msvalidate.01 content value"
          description="Used to prove Homzie ownership in Bing Webmaster Tools. It helps with Bing indexing controls and diagnostics, but is not a direct ranking factor."
        />
        <TextField
          name="organizationAddress"
          label="Organization address"
          value={settings.organizationAddress}
        />
        <TextField
          name="organizationEmail"
          label="Organization email"
          value={settings.organizationEmail}
        />
        <TextField
          name="organizationPhone"
          label="Organization phone"
          value={settings.organizationPhone}
        />
        <div className="grid gap-2">
          <Label htmlFor="defaultUnavailableListingIndexing">
            Unavailable listing policy
          </Label>
          <select
            id="defaultUnavailableListingIndexing"
            name="defaultUnavailableListingIndexing"
            defaultValue={settings.defaultUnavailableListingIndexing}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm font-semibold outline-none focus:border-primary"
          >
            <option value="auto">Auto</option>
            <option value="force_index">Force index</option>
            <option value="noindex">Noindex</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <StateMessage state={state} />
        <SubmitButton label="Save SEO settings" />
      </div>
    </form>
  );
}
