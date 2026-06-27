"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Bell, Check, Copy, Save } from "lucide-react";

import {
  saveNotificationSurfaceTemplateAction,
  type EmailTemplateActionState,
} from "./actions";
import {
  renderNotificationTemplate,
  type NotificationTemplateContext,
} from "@/modules/notifications/registry";

type TemplateVariable = {
  fallback?: string;
  key: string;
  label: string;
};

type SurfaceTemplate = {
  body: string;
  category: string;
  description: string | null;
  enabled: boolean;
  eventKey: string;
  name: string;
  sampleVariables: Record<string, unknown>;
  surface: "in_app" | "push";
  title: string | null;
  variables: TemplateVariable[];
};

type Version = {
  body: string;
  createdAt: string;
  id: string;
  title: string | null;
};

const initialActionState: EmailTemplateActionState = {
  message: "",
  ok: false,
};

function surfaceLabel(surface: SurfaceTemplate["surface"]) {
  return surface === "push" ? "Push" : "In-app";
}

export function NotificationSurfaceTemplateEditor({
  template,
  versions,
}: {
  template: SurfaceTemplate;
  versions: Version[];
}) {
  const [enabled, setEnabled] = useState(template.enabled);
  const [title, setTitle] = useState(template.title || "");
  const [body, setBody] = useState(template.body);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [state, action, isPending] = useActionState(
    saveNotificationSurfaceTemplateAction,
    initialActionState,
  );
  const renderedTitle = useMemo(
    () =>
      renderNotificationTemplate(
        title,
        template.sampleVariables as unknown as NotificationTemplateContext,
      ),
    [template.sampleVariables, title],
  );
  const renderedBody = useMemo(
    () =>
      renderNotificationTemplate(
        body,
        template.sampleVariables as unknown as NotificationTemplateContext,
      ),
    [body, template.sampleVariables],
  );

  function insertVariable(variableKey: string) {
    const token = `{{${variableKey}}}`;
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;

    setBody(next);

    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-5 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {template.category} / {surfaceLabel(template.surface)}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{template.name}</h2>
          {template.description ? (
            <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
              {template.description}
            </p>
          ) : null}
        </div>

        <form action={action} className="space-y-4">
          <input name="eventKey" type="hidden" value={template.eventKey} />
          <input name="surface" type="hidden" value={template.surface} />
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3">
            <span>
              <span className="block text-sm font-semibold">Template enabled</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Disabled templates fall back to no {surfaceLabel(template.surface).toLowerCase()} notification for this event.
              </span>
            </span>
            <input
              checked={enabled}
              className="size-5 accent-primary"
              name="enabled"
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
          </label>

          {template.surface === "push" ? (
            <label className="block">
              <span className="text-xs font-normal uppercase tracking-[0.12em] text-muted-foreground">
                Push title
              </span>
              <input
                className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
                name="title"
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
          ) : (
            <input name="title" type="hidden" value="" />
          )}

          <label className="block">
            <span className="text-xs font-normal uppercase tracking-[0.12em] text-muted-foreground">
              {template.surface === "push" ? "Push body" : "In-app copy"}
            </span>
            <textarea
              ref={bodyRef}
              className="mt-2 w-full resize-y rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-6 outline-none focus:border-primary"
              name="body"
              onChange={(event) => setBody(event.target.value)}
              rows={template.surface === "push" ? 5 : 7}
              value={body}
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              <Save className="size-4" />
              {isPending ? "Saving..." : "Save template"}
            </button>
            {state.message ? (
              <span
                className={`inline-flex items-center gap-1 text-sm font-bold ${
                  state.ok ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {state.ok ? <Check className="size-4" /> : null}
                {state.message}
              </span>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Copy className="size-4" />
          Variables
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {template.variables.map((variable) => (
            <button
              key={variable.key}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-primary/45 hover:text-primary"
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
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4" />
          Preview
        </h3>
        <div className="mt-3 rounded-lg border border-border bg-background p-4">
          {template.surface === "push" ? (
            <p className="text-sm font-semibold">{renderedTitle || "Push title"}</p>
          ) : null}
          <p className="mt-1 text-sm font-normal leading-6 text-muted-foreground">
            {renderedBody || "Notification copy"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">Version history</h3>
        <div className="mt-3 space-y-2">
          {versions.length ? (
            versions.slice(0, 8).map((version) => (
              <div
                className="rounded-md border border-border bg-background p-3"
                key={version.id}
              >
                {version.title ? (
                  <p className="truncate text-xs font-semibold">{version.title}</p>
                ) : null}
                <p className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">
                  {version.body}
                </p>
                <p className="mt-2 text-[10px] font-normal text-muted-foreground">
                  {new Date(version.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm font-normal text-muted-foreground">
              No saved versions yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
