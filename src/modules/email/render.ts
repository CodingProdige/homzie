import "server-only";

const tokenPattern = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function valueAtPath(source: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[part];
  }, source);
}

export function renderTemplateString(
  template: string,
  variables: Record<string, unknown>,
  options: { escape?: boolean } = {},
) {
  return template.replace(tokenPattern, (_match, key: string) => {
    const value = valueAtPath(variables, key);

    if (value === null || value === undefined) return "";

    const text = String(value);

    return options.escape === false ? text : escapeHtml(text);
  });
}

export function renderHomzieEmail({
  bodyHtml,
  preheader,
}: {
  bodyHtml: string;
  preheader?: string | null;
}) {
  const preview = preheader ? escapeHtml(preheader) : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Homzie</title>
    <style>
      body { margin: 0; background: #f4f4f7; color: #121218; font-family: Arial, Helvetica, sans-serif; }
      .preview { display: none; max-height: 0; overflow: hidden; opacity: 0; }
      .wrap { width: 100%; padding: 28px 12px; }
      .card { max-width: 620px; margin: 0 auto; overflow: hidden; border-radius: 18px; background: #ffffff; border: 1px solid #e8e8ef; }
      .header { padding: 28px 30px 16px; }
      .brand { font-size: 22px; font-weight: 900; letter-spacing: 0.08em; color: #15151d; }
      .content { padding: 0 30px 30px; font-size: 16px; line-height: 1.65; color: #272733; }
      h1 { margin: 12px 0 14px; font-size: 28px; line-height: 1.15; letter-spacing: -0.02em; color: #101018; }
      p { margin: 0 0 16px; }
      a { color: #6f42ff; font-weight: 800; }
      .button { display: inline-block; border-radius: 12px; background: linear-gradient(135deg,#6f42ff,#ff3eb5); color: #ffffff !important; padding: 13px 18px; text-decoration: none; font-weight: 900; }
      .muted { color: #707080; font-size: 13px; }
      .footer { border-top: 1px solid #eeeeF4; padding: 20px 30px 28px; color: #777786; font-size: 12px; line-height: 1.55; }
      @media (max-width: 520px) {
        .wrap { padding: 0; }
        .card { border-radius: 0; border-left: 0; border-right: 0; }
        .header, .content, .footer { padding-left: 20px; padding-right: 20px; }
        h1 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="preview">${preview}</div>
    <div class="wrap">
      <div class="card">
        <div class="header">
          <div class="brand">HOMZIE</div>
        </div>
        <div class="content">${bodyHtml}</div>
        <div class="footer">
          Homzie sends service emails about your account, listings, messages, and property activity. Manage notification preferences from your Homzie settings.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function renderEmailParts({
  html,
  preheader,
  subject,
  text,
  variables,
}: {
  html: string;
  preheader?: string | null;
  subject: string;
  text: string;
  variables: Record<string, unknown>;
}) {
  const renderedPreheader = preheader
    ? renderTemplateString(preheader, variables)
    : "";
  const bodyHtml = renderTemplateString(html, variables);

  return {
    html: renderHomzieEmail({
      bodyHtml,
      preheader: renderedPreheader,
    }),
    preheader: renderedPreheader,
    subject: renderTemplateString(subject, variables),
    text: renderTemplateString(text, variables, { escape: false }),
  };
}
