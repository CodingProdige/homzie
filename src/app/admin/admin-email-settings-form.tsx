"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, Save, Server, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { EmailSettings } from "@/modules/platform-settings/email-settings";
import {
  checkAdminSmtpConnection,
  updateAdminEmailSettings,
  type AdminEmailSettingsState,
} from "./settings/email/actions";

export type AdminEmailSettingsView = {
  settings: EmailSettings;
  sendgridConfigured: boolean;
  smtpConfigured: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
};

const initialState: AdminEmailSettingsState = { ok: false, message: "" };

function ActionMessage({ state }: { state: AdminEmailSettingsState }) {
  return (
    <div aria-live="polite" aria-atomic="true">
      {state.message ? (
        <p
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-sm leading-6",
            state.ok
              ? "border-primary/25 bg-primary/10 text-primary"
              : "border-destructive/25 bg-destructive/10 text-destructive",
          )}
        >
          {state.ok ? (
            <CheckCircle2 className="mt-1 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="mt-1 size-4 shrink-0" aria-hidden="true" />
          )}
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function AdminEmailSettingsForm({ view }: { view: AdminEmailSettingsView }) {
  const [values, setValues] = useState(view.settings);
  const [saveState, saveAction, saving] = useActionState(updateAdminEmailSettings, initialState);
  const [checkState, checkAction, checking] = useActionState(checkAdminSmtpConnection, initialState);
  const providerConfigured = values.provider === "smtp"
    ? view.smtpConfigured
    : view.sendgridConfigured;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <Mail className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">Provider and sender</h2>
        </div>

        <form action={saveAction} className="space-y-5">
          <fieldset disabled={saving} className="space-y-5 disabled:opacity-70">
            <div className="grid gap-2">
              <Label htmlFor="email-provider">Email provider</Label>
              <select
                id="email-provider"
                name="provider"
                value={values.provider}
                onChange={(event) => {
                  const provider = event.target.value;
                  if (provider === "smtp" || provider === "sendgrid") {
                    setValues((current) => ({ ...current, provider }));
                  }
                }}
                aria-describedby="email-provider-status"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-sm"
              >
                <option value="sendgrid">SendGrid</option>
                <option value="smtp">SMTP</option>
              </select>
              <p id="email-provider-status" className="text-sm leading-6 text-muted-foreground">
                {providerConfigured
                  ? "Server credentials are configured for this provider."
                  : "Server credentials are missing. Add them before selecting this provider for delivery."}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="email-from-name">Sender name</Label>
                <Input
                  id="email-from-name"
                  name="fromName"
                  value={values.fromName}
                  onChange={(event) => setValues((current) => ({ ...current, fromName: event.target.value }))}
                  maxLength={100}
                  placeholder="Homzie"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email-from-address">Sender email</Label>
                <Input
                  id="email-from-address"
                  name="fromEmail"
                  type="email"
                  value={values.fromEmail}
                  onChange={(event) => setValues((current) => ({ ...current, fromEmail: event.target.value }))}
                  maxLength={254}
                  placeholder="no-reply@homzie.co.za"
                  aria-describedby="email-from-hint"
                  required
                />
                <p id="email-from-hint" className="text-xs leading-5 text-muted-foreground">
                  Use an address your email provider allows you to send from.
                </p>
              </div>
              <div className="grid gap-2 sm:col-span-2 sm:max-w-sm">
                <Label htmlFor="email-reply-to">Reply-to email (optional)</Label>
                <Input
                  id="email-reply-to"
                  name="replyToEmail"
                  type="email"
                  value={values.replyToEmail}
                  onChange={(event) => setValues((current) => ({ ...current, replyToEmail: event.target.value }))}
                  maxLength={254}
                  placeholder="support@homzie.co.za"
                  aria-describedby="email-reply-to-hint"
                />
                <p id="email-reply-to-hint" className="text-xs leading-5 text-muted-foreground">
                  Leave empty to receive replies at the sender address.
                </p>
              </div>
            </div>
          </fieldset>

          <ActionMessage state={saveState} />
          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:items-start">
            <Button type="submit" disabled={saving || !providerConfigured} className="w-full sm:w-auto">
              <Save className="size-4" aria-hidden="true" />
              {saving ? "Saving..." : "Save email delivery settings"}
            </Button>
            <p className="text-xs leading-5 text-muted-foreground">
              Saving changes the provider used for future emails. Credentials are managed on the server.
            </p>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Server className="size-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">SMTP connection</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Check the server connection and sign-in before switching delivery to SMTP.
        </p>

        <dl className="mt-5 grid gap-4 rounded-md border border-border bg-background p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Credentials</dt>
            <dd className="mt-1 font-medium">{view.smtpConfigured ? "Configured" : "Missing"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Relay host</dt>
            <dd className="mt-1 break-all font-medium">{view.smtpHost || "Not configured"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Port</dt>
            <dd className="mt-1 font-medium">{view.smtpPort || "Not configured"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Username</dt>
            <dd className="mt-1 break-all font-medium">{view.smtpUser || "Not configured"}</dd>
          </div>
        </dl>

        <form action={checkAction} className="mt-5 space-y-3">
          <Button type="submit" variant="outline" disabled={checking || !view.smtpConfigured} className="w-full sm:w-auto">
            <Server className="size-4" aria-hidden="true" />
            {checking ? "Checking connection..." : "Check SMTP connection"}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">This check does not send an email.</p>
          <ActionMessage state={checkState} />
        </form>
      </section>

      <div className="flex flex-col gap-3 rounded-lg border border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Check a complete email</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Open Email Templates to preview a message and send a test to an address you choose.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/admin/email-templates">Open Email Templates</Link>
        </Button>
      </div>
    </div>
  );
}
