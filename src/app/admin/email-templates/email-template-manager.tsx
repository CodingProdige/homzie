"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Check, Copy, Mail, Save, Send, ToggleLeft, ToggleRight } from "lucide-react";

import {
  resendEmailDeliveryAction,
  rollbackEmailTemplateVersionAction,
  saveEmailTemplateAction,
  sendTestEmailTemplateAction,
  type EmailTemplateActionState,
} from "./actions";

type TemplateVariable = {
  fallback?: string;
  key: string;
  label: string;
};

export type AdminEmailTemplate = {
  category: string;
  description: string | null;
  enabled: boolean;
  html: string;
  key: string;
  name: string;
  preheader: string | null;
  sampleVariables: Record<string, unknown>;
  subject: string;
  text: string;
  updatedAt: string;
  variables: TemplateVariable[];
};

type DeliveryLog = {
  createdAt: string;
  error: string | null;
  id: string;
  recipientEmail: string;
  status: string;
  subject: string | null;
  templateKey: string;
};

type TemplateVersion = {
  createdAt: string;
  id: string;
  subject: string;
  templateKey: string;
};

const initialActionState: EmailTemplateActionState = {
  message: "",
  ok: false,
};

function escapeHtml(value: string) {
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

function renderTemplateString(
  template: string,
  variables: Record<string, unknown>,
  options: { escape?: boolean } = {},
) {
  return template.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_match, key: string) => {
    const value = valueAtPath(variables, key);
    if (value === null || value === undefined) return "";
    const text = String(value);
    return options.escape === false ? text : escapeHtml(text);
  });
}

function renderPreviewHtml({
  html,
  preheader,
  sampleVariables,
}: {
  html: string;
  preheader: string;
  sampleVariables: Record<string, unknown>;
}) {
  const bodyHtml = renderTemplateString(html, sampleVariables);
  const preview = renderTemplateString(preheader, sampleVariables);

  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    body{margin:0;background:#f4f4f7;color:#121218;font-family:Arial,Helvetica,sans-serif}
    .preview{display:none}.wrap{width:100%;padding:24px 10px}.card{max-width:620px;margin:0 auto;overflow:hidden;border-radius:18px;background:#fff;border:1px solid #e8e8ef}
    .header{padding:28px 30px 16px}.brand{font-size:22px;font-weight:900;letter-spacing:.08em}.content{padding:0 30px 30px;font-size:16px;line-height:1.65;color:#272733}
    h1{margin:12px 0 14px;font-size:28px;line-height:1.15;color:#101018}p{margin:0 0 16px}.button{display:inline-block;border-radius:12px;background:linear-gradient(135deg,#6f42ff,#ff3eb5);color:#fff!important;padding:13px 18px;text-decoration:none;font-weight:900}.muted{color:#707080;font-size:13px}.footer{border-top:1px solid #eeeef4;padding:20px 30px 28px;color:#777786;font-size:12px;line-height:1.55}
  </style></head><body><div class="preview">${escapeHtml(preview)}</div><div class="wrap"><div class="card"><div class="header"><div class="brand">HOMZIE</div></div><div class="content">${bodyHtml}</div><div class="footer">Homzie sends service emails about your account, listings, messages, and property activity.</div></div></div></body></html>`;
}

function Field({
  label,
  name,
  onChange,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <input
        className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  onChange,
  rows,
  value,
}: {
  label: string;
  name: string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <textarea
        className="mt-2 w-full resize-y rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-6 outline-none focus:border-primary"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}

export function EmailTemplateManager({
  deliveryLogs,
  templates,
  versions,
}: {
  deliveryLogs: DeliveryLog[];
  templates: AdminEmailTemplate[];
  versions: TemplateVersion[];
}) {
  const [selectedKey, setSelectedKey] = useState(templates[0]?.key || "");
  const selectedTemplate =
    templates.find((template) => template.key === selectedKey) || templates[0];
  const [fieldsByKey, setFieldsByKey] = useState(() =>
    Object.fromEntries(
      templates.map((template) => [
        template.key,
        {
          enabled: template.enabled,
          html: template.html,
          preheader: template.preheader || "",
          subject: template.subject,
          text: template.text,
        },
      ]),
    ),
  );
  const [testRecipient, setTestRecipient] = useState("");
  const htmlRef = useRef<HTMLTextAreaElement | null>(null);
  const [saveState, saveAction, isSaving] = useActionState(
    saveEmailTemplateAction,
    initialActionState,
  );
  const [testState, testAction, isTesting] = useActionState(
    sendTestEmailTemplateAction,
    initialActionState,
  );
  const [rollbackState, rollbackAction, isRollingBack] = useActionState(
    rollbackEmailTemplateVersionAction,
    initialActionState,
  );
  const [resendState, resendAction, isResending] = useActionState(
    resendEmailDeliveryAction,
    initialActionState,
  );
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");
  const [deliveryTemplateFilter, setDeliveryTemplateFilter] = useState("all");

  const fields = fieldsByKey[selectedTemplate?.key || ""] || {
    enabled: false,
    html: "",
    preheader: "",
    subject: "",
    text: "",
  };

  function updateField(
    key: "enabled" | "html" | "preheader" | "subject" | "text",
    value: boolean | string,
  ) {
    if (!selectedTemplate) return;

    setFieldsByKey((current) => ({
      ...current,
      [selectedTemplate.key]: {
        ...current[selectedTemplate.key],
        [key]: value,
      },
    }));
  }

  function insertVariable(variableKey: string) {
    const token = `{{${variableKey}}}`;
    const textarea = htmlRef.current;
    const start = textarea?.selectionStart ?? fields.html.length;
    const end = textarea?.selectionEnd ?? fields.html.length;
    const next = `${fields.html.slice(0, start)}${token}${fields.html.slice(end)}`;

    updateField("html", next);

    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const previewHtml = useMemo(
    () =>
      renderPreviewHtml({
        html: fields.html,
        preheader: fields.preheader,
        sampleVariables: selectedTemplate?.sampleVariables || {},
      }),
    [fields.html, fields.preheader, selectedTemplate?.sampleVariables],
  );
  const selectedVersions = versions.filter(
    (version) => version.templateKey === selectedTemplate.key,
  );
  const filteredDeliveryLogs = deliveryLogs.filter((log) => {
    const statusMatches =
      deliveryStatusFilter === "all" || log.status === deliveryStatusFilter;
    const templateMatches =
      deliveryTemplateFilter === "all" || log.templateKey === deliveryTemplateFilter;

    return statusMatches && templateMatches;
  });

  if (!selectedTemplate) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm font-semibold text-muted-foreground">
        No email templates are available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-2">
        {templates.map((template) => (
          <button
            key={template.key}
            className={`w-full rounded-lg border px-3 py-3 text-left transition ${
              template.key === selectedTemplate.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:border-primary/35"
            }`}
            onClick={() => setSelectedKey(template.key)}
            type="button"
          >
            <span className="block text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              {template.category}
            </span>
            <span className="mt-1 block text-sm font-black">{template.name}</span>
            <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">
              {template.key}
            </span>
          </button>
        ))}
      </aside>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
        <section className="space-y-5 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">
              {selectedTemplate.category}
            </p>
            <h2 className="mt-2 text-2xl font-black">{selectedTemplate.name}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
              {selectedTemplate.description}
            </p>
          </div>

          <form action={saveAction} className="space-y-4">
            <input name="key" type="hidden" value={selectedTemplate.key} />
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3">
              <span>
                <span className="block text-sm font-black">Template enabled</span>
                <span className="block text-xs font-semibold text-muted-foreground">
                  Disabled templates log as skipped and do not send.
                </span>
              </span>
              <input
                checked={fields.enabled}
                className="sr-only"
                name="enabled"
                onChange={(event) => updateField("enabled", event.target.checked)}
                type="checkbox"
              />
              {fields.enabled ? (
                <ToggleRight className="size-8 text-primary" />
              ) : (
                <ToggleLeft className="size-8 text-muted-foreground" />
              )}
            </label>

            <Field
              label="Subject"
              name="subject"
              onChange={(value) => updateField("subject", value)}
              value={fields.subject}
            />
            <Field
              label="Preheader"
              name="preheader"
              onChange={(value) => updateField("preheader", value)}
              value={fields.preheader}
            />
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                HTML body
              </span>
              <textarea
                ref={htmlRef}
                className="mt-2 w-full resize-y rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-6 outline-none focus:border-primary"
                name="html"
                onChange={(event) => updateField("html", event.target.value)}
                rows={14}
                value={fields.html}
              />
            </label>
            <TextAreaField
              label="Plain text"
              name="text"
              onChange={(value) => updateField("text", value)}
              rows={5}
              value={fields.text}
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-black text-primary-foreground disabled:opacity-60"
                disabled={isSaving}
                type="submit"
              >
                <Save className="size-4" />
                {isSaving ? "Saving..." : "Save template"}
              </button>
              {saveState.message ? (
                <span
                  className={`inline-flex items-center gap-1 text-sm font-bold ${
                    saveState.ok ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {saveState.ok ? <Check className="size-4" /> : null}
                  {saveState.message}
                </span>
              ) : null}
            </div>
          </form>

          <form action={testAction} className="rounded-lg border border-border bg-background p-3">
            <input name="key" type="hidden" value={selectedTemplate.key} />
            <input name="subject" type="hidden" value={fields.subject} />
            <input name="preheader" type="hidden" value={fields.preheader} />
            <input name="html" type="hidden" value={fields.html} />
            <input name="text" type="hidden" value={fields.text} />
            <input
              name="sampleVariables"
              type="hidden"
              value={JSON.stringify(selectedTemplate.sampleVariables)}
            />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                className="h-10 rounded-md border border-border bg-card px-3 text-sm font-bold outline-none focus:border-primary"
                name="recipientEmail"
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="test@example.com"
                type="email"
                value={testRecipient}
              />
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-black hover:border-primary/35 disabled:opacity-60"
                disabled={isTesting}
                type="submit"
              >
                <Send className="size-4" />
                {isTesting ? "Sending..." : "Send test"}
              </button>
            </div>
            {testState.message ? (
              <p
                className={`mt-2 text-sm font-bold ${
                  testState.ok ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {testState.message}
              </p>
            ) : null}
          </form>

          <section className="rounded-lg border border-border bg-background p-3">
            <h3 className="text-sm font-black">Version history</h3>
            <div className="mt-3 space-y-2">
              {selectedVersions.length ? (
                selectedVersions.slice(0, 8).map((version) => (
                  <form
                    action={rollbackAction}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2"
                    key={version.id}
                  >
                    <input name="templateKey" type="hidden" value={selectedTemplate.key} />
                    <input name="versionId" type="hidden" value={version.id} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black">
                        {version.subject}
                      </span>
                      <span className="block text-[10px] font-semibold text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </span>
                    <button
                      className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-black hover:border-primary/40 disabled:opacity-60"
                      disabled={isRollingBack}
                      type="submit"
                    >
                      Restore
                    </button>
                  </form>
                ))
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">
                  No saved versions yet.
                </p>
              )}
            </div>
            {rollbackState.message ? (
              <p
                className={`mt-2 text-sm font-bold ${
                  rollbackState.ok ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {rollbackState.message}
              </p>
            ) : null}
          </section>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black">
              <Copy className="size-4" />
              Variables
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedTemplate.variables.map((variable) => (
                <button
                  key={variable.key}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-black hover:border-primary/45 hover:text-primary"
                  onClick={() => insertVariable(variable.key)}
                  title={variable.label}
                  type="button"
                >
                  {`{{${variable.key}}}`}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-black">
              <Mail className="size-4" />
              Preview
            </h3>
            <iframe
              className="mt-3 h-[34rem] w-full rounded-md border border-border bg-white"
              sandbox=""
              srcDoc={previewHtml}
              title="Email template preview"
            />
          </section>

          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-black">Recent deliveries</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-xs font-bold"
                onChange={(event) => setDeliveryTemplateFilter(event.target.value)}
                value={deliveryTemplateFilter}
              >
                <option value="all">All templates</option>
                {templates.map((template) => (
                  <option key={template.key} value={template.key}>
                    {template.key}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-border bg-background px-2 text-xs font-bold"
                onChange={(event) => setDeliveryStatusFilter(event.target.value)}
                value={deliveryStatusFilter}
              >
                <option value="all">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
            <div className="mt-3 space-y-2">
              {filteredDeliveryLogs.length ? (
                filteredDeliveryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-md border border-border bg-background p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-black">
                        {log.templateKey}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase">
                        {log.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                      {log.recipientEmail}
                    </p>
                    {log.error ? (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        {log.error}
                      </p>
                    ) : null}
                    <form action={resendAction} className="mt-2">
                      <input name="logId" type="hidden" value={log.id} />
                      <button
                        className="rounded-md border border-border px-2 py-1 text-[10px] font-black hover:border-primary/40 disabled:opacity-60"
                        disabled={isResending}
                        type="submit"
                      >
                        Resend
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="text-sm font-semibold text-muted-foreground">
                  No email delivery logs yet.
                </p>
              )}
            </div>
            {resendState.message ? (
              <p
                className={`mt-2 text-sm font-bold ${
                  resendState.ok ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {resendState.message}
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
