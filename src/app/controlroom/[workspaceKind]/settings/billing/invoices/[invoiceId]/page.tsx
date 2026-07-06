import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import {
  formatAgencyBillingDate,
  formatAgencyBillingMoney,
  formatAgencyBillingPeriod,
  getAgencyBillingInvoiceDetail,
} from "@/modules/agencies/billing";
import {
  controlRoomKindForWorkspace,
  controlRoomPathForWorkspace,
  parseControlRoomKind,
} from "@/modules/agencies/control-room";
import {
  agencyTypeLabel,
  getPrimaryAgencyWorkspace,
} from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import { InvoicePrintButton } from "./invoice-print-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agency Invoice | Homzie",
  description: "Review a Homzie agency-funded seat invoice.",
};

type AgencyInvoicePageProps = {
  params: Promise<{
    invoiceId: string;
    workspaceKind: string;
  }>;
};

function invoiceStatusClassName(status: string) {
  if (status === "paid") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "past_due") {
    return "bg-destructive/10 text-destructive";
  }

  return "bg-primary/10 text-primary";
}

function invoiceStatusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default async function AgencyInvoicePage({
  params,
}: AgencyInvoicePageProps) {
  const [{ invoiceId, workspaceKind }, session] = await Promise.all([
    params,
    getServerSession(authOptions),
  ]);
  const kind = parseControlRoomKind(workspaceKind);

  if (!kind) {
    redirect("/controlroom");
  }

  if (!session?.user?.id) {
    redirect(
      `/sign-in?callbackUrl=/controlroom/${kind}/settings/billing/invoices/${invoiceId}`,
    );
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace) {
    redirect(`/controlroom/${kind}`);
  }

  if (controlRoomKindForWorkspace(workspace) !== kind) {
    redirect(
      `${controlRoomPathForWorkspace(workspace)}/settings/billing/invoices/${invoiceId}`,
    );
  }

  if (workspace.agency.agencyType === "network") {
    redirect(`${controlRoomPathForWorkspace(workspace)}/settings`);
  }

  const invoice = await getAgencyBillingInvoiceDetail({
    agencyId: workspace.agency.id,
    invoiceId,
  });

  if (!invoice) {
    notFound();
  }

  const billingPath = `/controlroom/${kind}/settings/billing`;
  const hasCredits = invoice.creditsCents > 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:py-10 print:max-w-none print:px-0 print:py-0">
      <div className="print:hidden">
        <BackButton href={billingPath} label="Billing" />
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm print:mt-0 print:border-0 print:shadow-none sm:p-7">
        <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Homzie agency invoice
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {invoice.invoiceNumber}
            </h1>
            <p className="mt-2 text-sm font-normal text-muted-foreground">
              Agency-funded member seats billed by maximum seats used in the
              30-day billing cycle.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <InvoicePrintButton />
            <Button asChild>
              <Link href={billingPath}>Back to billing</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Billed to
            </p>
            <h2 className="mt-2 text-xl font-semibold">{invoice.agencyName}</h2>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              {agencyTypeLabel(invoice.agencyType)}
              {invoice.region ? ` · ${invoice.region}` : ""}
            </p>
            <p className="mt-2 text-sm font-normal text-muted-foreground">
              {invoice.billingEmail || "No billing email saved"}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Invoice status
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                  invoiceStatusClassName(invoice.status),
                ].join(" ")}
              >
                {invoiceStatusLabel(invoice.status)}
              </span>
              {invoice.chargedAt ? (
                <span className="text-sm font-normal text-muted-foreground">
                  Paid {formatAgencyBillingDate(invoice.chargedAt)}
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
              <p>
                Issued:{" "}
                <span className="font-semibold text-foreground">
                  {invoice.issuedAt
                    ? formatAgencyBillingDate(invoice.issuedAt)
                    : "After finalization"}
                </span>
              </p>
              <p>
                Due:{" "}
                <span className="font-semibold text-foreground">
                  {invoice.dueAt
                    ? formatAgencyBillingDate(invoice.dueAt)
                    : "On receipt"}
                </span>
              </p>
              <p>
                Payment method:{" "}
                <span className="font-semibold text-foreground">
                  {invoice.paymentMethodLabel || "Saved agency card"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {invoice.failureMessage ? (
          <p className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {invoice.failureMessage}
          </p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-lg border border-border">
          <table className="w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-muted/35 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 text-right font-semibold">Qty</th>
                <th className="px-4 py-3 text-right font-semibold">Unit</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-background">
                <td className="px-4 py-4">
                  <p className="font-semibold">Agency-funded member seats</p>
                  <p className="mt-1 text-xs font-normal text-muted-foreground">
                    Cycle peak for{" "}
                    {formatAgencyBillingPeriod(
                      invoice.periodStart,
                      invoice.periodEnd,
                    )}
                  </p>
                </td>
                <td className="px-4 py-4 text-right font-semibold">
                  {invoice.maxBillableSeats}
                </td>
                <td className="px-4 py-4 text-right font-semibold">
                  {formatAgencyBillingMoney(
                    invoice.unitAmountCents,
                    invoice.currency,
                  )}
                </td>
                <td className="px-4 py-4 text-right font-semibold">
                  {formatAgencyBillingMoney(
                    invoice.subtotalCents,
                    invoice.currency,
                  )}
                </td>
              </tr>
              {hasCredits ? (
                <tr className="border-t border-border bg-background">
                  <td className="px-4 py-4 font-semibold">Credits</td>
                  <td className="px-4 py-4 text-right text-muted-foreground">-</td>
                  <td className="px-4 py-4 text-right text-muted-foreground">-</td>
                  <td className="px-4 py-4 text-right font-semibold">
                    -{formatAgencyBillingMoney(invoice.creditsCents, invoice.currency)}
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot className="bg-muted/20">
              <tr>
                <td className="px-4 py-4 text-right font-semibold" colSpan={3}>
                  Total
                </td>
                <td className="px-4 py-4 text-right text-xl font-semibold">
                  {formatAgencyBillingMoney(invoice.totalCents, invoice.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 grid gap-3 text-sm font-normal text-muted-foreground sm:grid-cols-2">
          <p>
            Stripe payment intent:{" "}
            <span className="font-semibold text-foreground">
              {invoice.providerPaymentIntentId || "Not charged yet"}
            </span>
          </p>
          <p>
            Stripe charge:{" "}
            <span className="font-semibold text-foreground">
              {invoice.providerChargeId || "Not available"}
            </span>
          </p>
        </div>
      </section>
    </main>
  );
}
