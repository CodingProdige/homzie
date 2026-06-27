"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { ImagePlus, LoaderCircle, Save } from "lucide-react";

import { AnalyticsInfoPopover } from "@/components/analytics-info-popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  agencyBadgeFontOptions,
  agencyBadgeFontWeightOptions,
  agencyBadgeRadiusOptions,
  defaultAgencyBadgeStyle,
  type AgencyBadgeStyle,
} from "@/modules/agencies/brand-style";
import { AgencyBrandBadge } from "@/modules/agencies/components/agency-brand-badge";

type AgencyBrandingFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  agencyName: string;
  badgeLabel: string;
  badgeStyle: AgencyBadgeStyle;
  canManageControlRoomBrand: boolean;
  canManagePublicBrand: boolean;
  controlRoomLogoUrl: string | null;
  effectivePublicBrand: {
    badgeLabel: string;
    badgeStyle: AgencyBadgeStyle;
    logoUrl: string | null;
    name: string;
    sourceLabel: string;
  };
  isNetworkBrandLocked: boolean;
  localPublicBrand: {
    badgeLabel: string;
    badgeStyle: AgencyBadgeStyle;
    logoUrl: string | null;
    name: string;
  };
  publicLogoUrl: string | null;
};

type PreparedImage = {
  file: File;
  previewUrl: string;
};

const imageQuality = 0.86;
const controlRoomLogoSize = 512;
const publicLogoWidth = 960;
const publicLogoHeight = 300;

function FieldLabel({
  description,
  label,
}: {
  description: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      {label}
      <AnalyticsInfoPopover title={label} description={description} />
    </span>
  );
}

async function cropAndCompressImage({
  file,
  height,
  nameSuffix,
  width,
}: {
  file: File;
  height: number;
  nameSuffix: string;
  width: number;
}) {
  const bitmap = await createImageBitmap(file);
  const sourceRatio = bitmap.width / bitmap.height;
  const targetRatio = width / height;
  const sourceWidth =
    sourceRatio > targetRatio ? Math.round(bitmap.height * targetRatio) : bitmap.width;
  const sourceHeight =
    sourceRatio > targetRatio ? bitmap.height : Math.round(bitmap.width / targetRatio);
  const sourceX = Math.round((bitmap.width - sourceWidth) / 2);
  const sourceY = Math.round((bitmap.height - sourceHeight) / 2);
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

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
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", imageQuality),
  );

  bitmap.close();

  if (!blob) return file;

  return new File([blob], `${nameSuffix}.webp`, { type: "image/webp" });
}

function releasePreparedImage(image: PreparedImage | null) {
  if (image?.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(image.previewUrl);
  }
}

function AssetPreview({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid place-items-center overflow-hidden border border-border bg-card text-sm font-semibold text-primary",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AgencyBrandingForm({
  action,
  agencyName,
  badgeLabel,
  badgeStyle,
  canManageControlRoomBrand,
  canManagePublicBrand,
  controlRoomLogoUrl,
  effectivePublicBrand,
  isNetworkBrandLocked,
  localPublicBrand,
  publicLogoUrl,
}: AgencyBrandingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [controlRoomLogo, setControlRoomLogo] =
    useState<PreparedImage | null>(null);
  const [publicLogo, setPublicLogo] = useState<PreparedImage | null>(null);
  const [label, setLabel] = useState(badgeLabel || agencyName);
  const [style, setStyle] = useState<AgencyBadgeStyle>({
    ...defaultAgencyBadgeStyle,
    ...badgeStyle,
  });
  const controlRoomPreviewUrl = controlRoomLogo?.previewUrl || controlRoomLogoUrl;
  const publicPreviewUrl = publicLogo?.previewUrl || publicLogoUrl;
  const localPreviewBrand = useMemo(
    () => ({
      badgeLabel: label || agencyName,
      badgeStyle: style,
      logoUrl: publicPreviewUrl,
      name: agencyName,
    }),
    [agencyName, label, publicPreviewUrl, style],
  );
  const effectivePreviewBrand = canManagePublicBrand
    ? localPreviewBrand
    : effectivePublicBrand;

  useEffect(() => {
    return () => {
      releasePreparedImage(controlRoomLogo);
      releasePreparedImage(publicLogo);
    };
  }, [controlRoomLogo, publicLogo]);

  function updateStyle(key: keyof AgencyBadgeStyle, value: string) {
    setStyle((current) => ({ ...current, [key]: value }));
  }

  async function prepareControlRoomLogo(file: File) {
    setMessage("Cropping and compressing control room logo...");
    const compressed = await cropAndCompressImage({
      file,
      height: controlRoomLogoSize,
      nameSuffix: "control-room-logo",
      width: controlRoomLogoSize,
    });
    const next = { file: compressed, previewUrl: URL.createObjectURL(compressed) };

    setControlRoomLogo((current) => {
      releasePreparedImage(current);

      return next;
    });
    setMessage("Control room logo ready.");
  }

  async function preparePublicLogo(file: File) {
    setMessage("Cropping and compressing public logo...");
    const compressed = await cropAndCompressImage({
      file,
      height: publicLogoHeight,
      nameSuffix: "public-agency-logo",
      width: publicLogoWidth,
    });
    const next = { file: compressed, previewUrl: URL.createObjectURL(compressed) };

    setPublicLogo((current) => {
      releasePreparedImage(current);

      return next;
    });
    setMessage("Public logo ready.");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const formData = new FormData(event.currentTarget);

    if (controlRoomLogo) {
      formData.set("controlRoomLogoFile", controlRoomLogo.file);
    }

    if (publicLogo) {
      formData.set("publicLogoFile", publicLogo.file);
    }

    startTransition(() => {
      void Promise.resolve(action(formData))
        .then(() => {
          setMessage("Brand saved.");
          router.refresh();
        })
        .catch((error) => {
          setMessage(
            error instanceof Error
              ? error.message
              : "Homzie could not save the agency brand.",
          );
        });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid gap-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="grid gap-4 rounded-lg border border-border bg-background p-4">
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <label className="grid gap-2">
              <FieldLabel
                label="Control room logo"
                description="This round image is used inside the agency control room sidebar, mobile header, and workspace identity areas."
              />
              <div
                className={cn(
                  "grid min-h-52 place-items-center rounded-lg border border-dashed border-border bg-card p-4 text-center",
                  !canManageControlRoomBrand && "opacity-60",
                )}
              >
                <div className="grid justify-items-center gap-3">
                  <AssetPreview className="size-24 rounded-full">
                    {controlRoomPreviewUrl ? (
                      controlRoomPreviewUrl.startsWith("blob:") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={controlRoomPreviewUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <Image
                          src={controlRoomPreviewUrl}
                          alt=""
                          width={96}
                          height={96}
                          className="size-full object-cover"
                        />
                      )
                    ) : (
                      agencyName.slice(0, 2).toUpperCase()
                    )}
                  </AssetPreview>
                  <label
                    className={cn(
                      "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary",
                      !canManageControlRoomBrand &&
                        "pointer-events-none cursor-not-allowed opacity-60",
                    )}
                  >
                    <ImagePlus className="size-4" />
                    Upload icon
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={!canManageControlRoomBrand || isPending}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";

                        if (!file) return;
                        void prepareControlRoomLogo(file);
                      }}
                    />
                  </label>
                  <p className="max-w-sm text-xs font-normal leading-5 text-muted-foreground">
                    Cropped to 1:1 and compressed to WebP before upload.
                  </p>
                </div>
              </div>
            </label>

            <label className="grid gap-2">
              <FieldLabel
                label="Public listing logo"
                description="This wide logo appears inside the agency badge on linked agent profiles, listing cards, and listing detail pages."
              />
              <div
                className={cn(
                  "grid min-h-52 place-items-center rounded-lg border border-dashed border-border bg-card p-4 text-center",
                  !canManagePublicBrand && "opacity-60",
                )}
              >
                <div className="grid w-full justify-items-center gap-3">
                  <AssetPreview className="aspect-[16/5] w-full max-w-sm rounded-md">
                    {publicPreviewUrl ? (
                      publicPreviewUrl.startsWith("blob:") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={publicPreviewUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <Image
                          src={publicPreviewUrl}
                          alt=""
                          width={320}
                          height={100}
                          className="size-full object-cover"
                        />
                      )
                    ) : (
                      agencyName
                    )}
                  </AssetPreview>
                  <label
                    className={cn(
                      "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:text-primary",
                      !canManagePublicBrand &&
                        "pointer-events-none cursor-not-allowed opacity-60",
                    )}
                  >
                    <ImagePlus className="size-4" />
                    Upload public logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={!canManagePublicBrand || isPending}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";

                        if (!file) return;
                        void preparePublicLogo(file);
                      }}
                    />
                  </label>
                  <p className="max-w-sm text-xs font-normal leading-5 text-muted-foreground">
                    Cropped to 16:5 and compressed to WebP before upload.
                  </p>
                </div>
              </div>
            </label>
          </div>

          <label className="grid gap-2">
            <FieldLabel
              label="Badge label"
              description="This text appears next to the public logo anywhere Homzie shows your agency identity."
            />
            <input
              name="badgeLabel"
              value={label}
              disabled={!canManagePublicBrand || isPending}
              placeholder="Century 21 Paarl"
              maxLength={40}
              onChange={(event) => setLabel(event.target.value)}
              className="h-11 min-w-0 rounded-md border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <FieldLabel
                label="Background"
                description="Controls the badge background color on profiles and listings."
              />
              <input
                name="badgeBackgroundColor"
                type="color"
                value={style.backgroundColor}
                disabled={!canManagePublicBrand || isPending}
                onChange={(event) =>
                  updateStyle("backgroundColor", event.target.value)
                }
                className="h-11 w-full rounded-md border border-border bg-card p-1 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="grid gap-2">
              <FieldLabel
                label="Text color"
                description="Controls the badge label color. Choose a high-contrast color so the badge remains readable."
              />
              <input
                name="badgeTextColor"
                type="color"
                value={style.textColor}
                disabled={!canManagePublicBrand || isPending}
                onChange={(event) => updateStyle("textColor", event.target.value)}
                className="h-11 w-full rounded-md border border-border bg-card p-1 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="grid gap-2">
              <FieldLabel
                label="Corner radius"
                description="Controls the shape of the badge container, from sharp corners to a pill shape."
              />
              <select
                name="badgeBorderRadius"
                value={style.borderRadius}
                disabled={!canManagePublicBrand || isPending}
                onChange={(event) => updateStyle("borderRadius", event.target.value)}
                className="h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {agencyBadgeRadiusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <FieldLabel
                label="Font"
                description="Controls the type style used for the badge label."
              />
              <select
                name="badgeFontFamily"
                value={style.fontFamily}
                disabled={!canManagePublicBrand || isPending}
                onChange={(event) => updateStyle("fontFamily", event.target.value)}
                className="h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {agencyBadgeFontOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 md:col-span-2">
              <FieldLabel
                label="Font weight"
                description="Controls how bold the badge label appears across Homzie."
              />
              <select
                name="badgeFontWeight"
                value={style.fontWeight}
                disabled={!canManagePublicBrand || isPending}
                onChange={(event) => updateStyle("fontWeight", event.target.value)}
                className="h-11 rounded-md border border-border bg-card px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {agencyBadgeFontWeightOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Live preview
            </p>
            <AnalyticsInfoPopover
              title="Live preview"
              description="This preview mirrors the agency identity shown in control room chrome and on public listing surfaces."
            />
          </div>
          <div className="mt-5 grid gap-4 rounded-lg border border-border bg-card p-5">
            <div>
              <p className="mb-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                Control room
              </p>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
                <AssetPreview className="size-10 rounded-full">
                  {controlRoomPreviewUrl ? (
                    controlRoomPreviewUrl.startsWith("blob:") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={controlRoomPreviewUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Image
                        src={controlRoomPreviewUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="size-full object-cover"
                      />
                    )
                  ) : (
                    agencyName.slice(0, 2).toUpperCase()
                  )}
                </AssetPreview>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{agencyName}</p>
                  <p className="text-xs font-normal text-muted-foreground">
                    Workspace identity
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                Public badge
              </p>
              <AgencyBrandBadge brand={effectivePreviewBrand} />
              <p className="mt-2 text-xs font-normal text-muted-foreground">
                {effectivePublicBrand.sourceLabel}
              </p>
            </div>
            {isNetworkBrandLocked ? (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-3">
                <p className="mb-2 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                  Your saved local public brand
                </p>
                <AgencyBrandBadge
                  brand={{
                    ...localPublicBrand,
                    badgeLabel: label || localPublicBrand.badgeLabel,
                    badgeStyle: style,
                    logoUrl: publicPreviewUrl,
                  }}
                />
                <p className="mt-2 text-xs font-normal leading-5 text-muted-foreground">
                  Saved locally for this branch, but hidden while Network HQ branding is enforced.
                </p>
              </div>
            ) : null}
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Public surfaces
            </p>
            <p className="mt-1 text-xs font-normal leading-5 text-muted-foreground">
              Agent profile header, listing cards, listing detail contact panel,
              and future agency-owned listing surfaces.
            </p>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {isNetworkBrandLocked ? (
          <p className="max-w-2xl text-xs font-normal leading-5 text-muted-foreground">
            Network HQ controls public listing and agent badges. You can still
            update this branch&apos;s local control room logo.
          </p>
        ) : (
          <p className="max-w-2xl text-xs font-normal leading-5 text-muted-foreground">
            Brand assets are cropped to fixed Homzie ratios and compressed before saving.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {message ? (
            <p className="text-xs font-normal text-muted-foreground">{message}</p>
          ) : null}
          <Button
            type="submit"
            disabled={
              (!canManageControlRoomBrand && !canManagePublicBrand) || isPending
            }
            className="h-11 whitespace-nowrap font-semibold"
          >
            {isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {isPending ? "Saving" : "Save brand"}
          </Button>
        </div>
      </div>
    </form>
  );
}
