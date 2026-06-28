import "server-only";

import { escapeHtml, renderHomzieEmail } from "@/modules/email/render";

import type { BroadcastBlock } from "./types";

function appBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL;

  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

function absoluteUrl(href?: string | null) {
  if (!href) return appBaseUrl();
  if (/^https?:\/\//i.test(href)) return href;

  return `${appBaseUrl()}${href.startsWith("/") ? href : `/${href}`}`;
}

function paragraphHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`)
    .join("");
}

function textValue(value?: string | null) {
  return value?.trim() || "";
}

function renderBlockHtml(block: BroadcastBlock) {
  if (block.type === "hero") {
    const eyebrow = textValue(block.eyebrow);
    const body = textValue(block.body);

    return `
      ${eyebrow ? `<p class="muted" style="margin-bottom:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#6f42ff;">${escapeHtml(eyebrow)}</p>` : ""}
      <h1>${escapeHtml(block.title)}</h1>
      ${body ? paragraphHtml(body) : ""}
    `;
  }

  if (block.type === "text") {
    return paragraphHtml(block.body);
  }

  if (block.type === "image") {
    return `
      <div style="margin:20px 0;">
        <img src="${escapeHtml(absoluteUrl(block.url))}" alt="${escapeHtml(block.alt || "")}" style="display:block;width:100%;max-width:100%;border-radius:16px;border:1px solid #eeeeF4;" />
      </div>
    `;
  }

  if (block.type === "video") {
    const href = absoluteUrl(block.url);
    const thumbnail = textValue(block.thumbnailUrl);
    const label = textValue(block.label) || "Watch video";
    const body = textValue(block.body);

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e8e8ef;border-radius:16px;overflow:hidden;background:#fbfbfd;">
        ${
          thumbnail
            ? `<tr><td><a href="${escapeHtml(href)}"><img src="${escapeHtml(absoluteUrl(thumbnail))}" alt="${escapeHtml(block.thumbnailAlt || block.title)}" style="display:block;width:100%;max-height:300px;object-fit:cover;" /></a></td></tr>`
            : ""
        }
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 8px;font-size:18px;font-weight:900;color:#121218;">${escapeHtml(block.title)}</p>
            ${body ? paragraphHtml(body) : ""}
            <a class="button" href="${escapeHtml(href)}">${escapeHtml(label)}</a>
          </td>
        </tr>
      </table>
    `;
  }

  if (block.type === "button") {
    return `
      <p style="margin:22px 0;">
        <a class="button" href="${escapeHtml(absoluteUrl(block.href))}">${escapeHtml(block.label)}</a>
      </p>
    `;
  }

  if (block.type === "listing") {
    const image = textValue(block.imageUrl);
    const href = absoluteUrl(block.href || "/listings");

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e8e8ef;border-radius:16px;overflow:hidden;background:#fbfbfd;">
        ${
          image
            ? `<tr><td><img src="${escapeHtml(absoluteUrl(image))}" alt="${escapeHtml(block.title)}" style="display:block;width:100%;max-height:250px;object-fit:cover;" /></td></tr>`
            : ""
        }
        <tr>
          <td style="padding:18px;">
            <p style="margin:0 0 6px;font-size:18px;font-weight:900;color:#121218;">${escapeHtml(block.title)}</p>
            ${block.location ? `<p class="muted" style="margin:0 0 8px;">${escapeHtml(block.location)}</p>` : ""}
            ${block.price ? `<p style="margin:0 0 14px;font-weight:900;color:#6f42ff;">${escapeHtml(block.price)}</p>` : ""}
            <a href="${escapeHtml(href)}" style="font-weight:900;color:#6f42ff;text-decoration:none;">View listing</a>
          </td>
        </tr>
      </table>
    `;
  }

  if (block.type === "agent") {
    const avatar = textValue(block.avatarUrl);
    const href = absoluteUrl(block.href || "/agents");

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e8e8ef;border-radius:16px;background:#fbfbfd;">
        <tr>
          <td style="padding:18px;width:58px;vertical-align:top;">
            ${
              avatar
                ? `<img src="${escapeHtml(absoluteUrl(avatar))}" alt="${escapeHtml(block.name)}" width="52" height="52" style="display:block;border-radius:999px;object-fit:cover;" />`
                : `<div style="width:52px;height:52px;border-radius:999px;background:#eee8ff;color:#6f42ff;line-height:52px;text-align:center;font-weight:900;">${escapeHtml(block.name.charAt(0).toUpperCase())}</div>`
            }
          </td>
          <td style="padding:18px 18px 18px 0;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:18px;font-weight:900;color:#121218;">${escapeHtml(block.name)}</p>
            ${block.headline ? `<p class="muted" style="margin:0 0 10px;">${escapeHtml(block.headline)}</p>` : ""}
            <a href="${escapeHtml(href)}" style="font-weight:900;color:#6f42ff;text-decoration:none;">View profile</a>
          </td>
        </tr>
      </table>
    `;
  }

  if (block.type === "divider") {
    return `<hr style="border:0;border-top:1px solid #eeeeF4;margin:24px 0;" />`;
  }

  return `<div class="muted" style="margin-top:24px;">${paragraphHtml(block.body)}</div>`;
}

export function renderBroadcastEmail({
  blocks,
  preheader,
}: {
  blocks: BroadcastBlock[];
  preheader?: string | null;
}) {
  const bodyHtml = blocks.map(renderBlockHtml).join("\n");

  return renderHomzieEmail({ bodyHtml, preheader });
}

export function renderBroadcastText(blocks: BroadcastBlock[]) {
  return blocks
    .map((block) => {
      if (block.type === "hero") {
        return [block.eyebrow, block.title, block.body].filter(Boolean).join("\n\n");
      }

      if (block.type === "button") {
        return `${block.label}: ${absoluteUrl(block.href)}`;
      }

      if (block.type === "image") {
        return block.alt ? `[Image: ${block.alt}]` : "[Image]";
      }

      if (block.type === "video") {
        return [
          block.title,
          block.body,
          `${block.label || "Watch video"}: ${absoluteUrl(block.url)}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      if (block.type === "listing") {
        return [
          block.title,
          block.location,
          block.price,
          `View listing: ${absoluteUrl(block.href || "/listings")}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      if (block.type === "agent") {
        return [
          block.name,
          block.headline,
          `View profile: ${absoluteUrl(block.href || "/agents")}`,
        ]
          .filter(Boolean)
          .join("\n");
      }

      if (block.type === "divider") return "----------";

      return block.body;
    })
    .filter(Boolean)
    .join("\n\n");
}
