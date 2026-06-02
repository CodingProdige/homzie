import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { desc, eq } from "drizzle-orm";
import {
  BarChart3,
  Bell,
  Bookmark,
  CalendarDays,
  Clapperboard,
  CreditCard,
  Download,
  HelpCircle,
  Home,
  LockKeyhole,
  LogOut,
  Menu,
  Settings,
  TrendingUp,
  User,
  UsersRound,
} from "lucide-react";
import type Stripe from "stripe";

import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { authOptions } from "@/modules/auth/config";
import {
  cancelAgentSubscription,
  openBillingPortal,
} from "@/modules/billing/portal-actions";
import { agentSubscriptionPrice, getStripe } from "@/modules/billing/stripe";
import { CurrencyAmount } from "@/modules/currency/currency-amount";

type BillingInvoice = {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
  downloadUrl: string | null;
};

type BillingCard = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
} | null;

type BillingData = {
  status: string;
  planName: string;
  cycle: string;
  price: string;
  nextBillingDate: string;
  startedOn: string;
  card: BillingCard;
  invoices: BillingInvoice[];
};

const navigation = [
  { label: "Profile", icon: User },
  { label: "Reels", icon: Clapperboard },
  { label: "Listings", icon: Home },
  { label: "Leads", icon: UsersRound },
  { label: "Saved", icon: Bookmark },
  { label: "Analytics", icon: BarChart3 },
];

const accountNavigation = [
  { label: "Settings", icon: Settings },
  { label: "Notifications", icon: Bell },
  { label: "Billing", icon: CreditCard, active: true },
  { label: "Connected accounts", icon: UsersRound },
  { label: "Log out", icon: LogOut },
];

function formatDate(value: Date | number | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = typeof value === "number" ? new Date(value * 1000) : value;

  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMoney(cents: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function getSubscriptionPeriod(subscription: Stripe.Subscription | null) {
  const typedSubscription = subscription as
    | (Stripe.Subscription & {
        current_period_start?: number;
        current_period_end?: number;
      })
    | null;

  return {
    start: typedSubscription?.current_period_start,
    end: typedSubscription?.current_period_end,
  };
}

async function getBillingData(userId: string): Promise<BillingData | null> {
  const [localSubscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!localSubscription?.providerReference || !localSubscription.providerCustomerId) {
    return null;
  }

  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(
    localSubscription.providerReference,
    {
      expand: ["default_payment_method"],
    },
  );
  const period = getSubscriptionPeriod(stripeSubscription);
  const firstItem = stripeSubscription.items.data[0];
  const recurringInterval = firstItem?.price.recurring?.interval || localSubscription.interval;
  const amountCents = firstItem?.price.unit_amount || localSubscription.amountCents;
  const currency = (firstItem?.price.currency || localSubscription.currency).toUpperCase();
  const defaultPaymentMethod = stripeSubscription.default_payment_method;
  let card: BillingCard = null;

  if (
    defaultPaymentMethod &&
    typeof defaultPaymentMethod !== "string" &&
    defaultPaymentMethod.card
  ) {
    card = {
      brand: defaultPaymentMethod.card.brand,
      last4: defaultPaymentMethod.card.last4,
      expMonth: defaultPaymentMethod.card.exp_month,
      expYear: defaultPaymentMethod.card.exp_year,
    };
  } else {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: localSubscription.providerCustomerId,
      type: "card",
      limit: 1,
    });
    const paymentMethod = paymentMethods.data[0];

    if (paymentMethod?.card) {
      card = {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        expMonth: paymentMethod.card.exp_month,
        expYear: paymentMethod.card.exp_year,
      };
    }
  }

  const invoices = await stripe.invoices.list({
    customer: localSubscription.providerCustomerId,
    limit: 5,
  });

  return {
    status: localSubscription.status,
    planName: "Homzie Agent Pro",
    cycle: recurringInterval === "year" ? "Yearly" : "Monthly",
    price: `${formatMoney(amountCents, currency)} / ${
      recurringInterval === "year" ? "year" : "month"
    }`,
    nextBillingDate: formatDate(period.end || localSubscription.currentPeriodEnd),
    startedOn: formatDate(period.start || localSubscription.currentPeriodStart),
    card,
    invoices: invoices.data.map((invoice) => ({
      id: invoice.id,
      date: formatDate(invoice.created),
      description: invoice.description || "Homzie Agent Pro",
      amount: formatMoney(invoice.amount_paid || invoice.total || 0, invoice.currency),
      status: invoice.status || "open",
      downloadUrl: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
    })),
  };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold capitalize text-primary">
      {status}
    </span>
  );
}

function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-[280px] shrink-0 border-r border-border bg-background px-5 py-7 lg:flex lg:flex-col">
      <BackButton className="text-foreground hover:text-primary" />

      <nav className="mt-12 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href="#"
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-8 px-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Account
      </p>
      <nav className="mt-3 space-y-1">
        {accountNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href="#"
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold ${
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg bg-[linear-gradient(135deg,rgba(123,92,255,0.1),rgba(255,77,184,0.12))] p-5">
        <p className="font-bold">Grow your brand</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Upgrade to Homzie Agent Pro to unlock more tools.
        </p>
        <Link
          href="/become-agent"
          className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary"
        >
          Upgrade now
          <TrendingUp className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

function CurrentPlanCard({ billing }: { billing: BillingData | null }) {
  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.75fr)]">
        <div>
          <p className="text-sm font-bold text-primary">Current plan</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              {billing?.planName || "No active agent plan"}
            </h2>
            {billing ? <StatusBadge status={billing.status} /> : null}
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Everything you need to build your property brand, publish listings,
            post reels and capture leads.
          </p>
          <form action={openBillingPortal} className="mt-7">
            <Button variant="outline">
              <Settings className="size-4" />
              Manage plan
            </Button>
          </form>
        </div>

        <div className="grid gap-4 border-border lg:border-l lg:pl-8">
          <div className="flex gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary">Next billing date</p>
              <p className="mt-1 text-xl font-bold">
                {billing?.nextBillingDate || "Not available"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {billing ? `You will be charged ${billing.price}.` : "Subscribe to activate billing."}
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-lg bg-secondary p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Amount</p>
              <p className="text-xl font-bold">
                {billing?.price || (
                  <>
                    <CurrencyAmount cents={agentSubscriptionPrice.amountCents} /> / month
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentMethodCard({ billing }: { billing: BillingData | null }) {
  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-bold">Payment method</h2>
        <form action={openBillingPortal}>
          <Button variant="secondary" size="sm">
            + Add method
          </Button>
        </form>
      </div>

      <div className="mt-6 rounded-lg border p-4">
        {billing?.card ? (
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg bg-secondary text-sm font-bold uppercase text-primary">
              {billing.card.brand.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <p className="font-bold capitalize">
                {billing.card.brand} •••• {billing.card.last4}
              </p>
              <p className="text-sm text-muted-foreground">
                Expires {String(billing.card.expMonth).padStart(2, "0")}/
                {String(billing.card.expYear).slice(-2)}
              </p>
            </div>
            <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Default
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No saved payment method yet. Add one after subscribing.
          </p>
        )}
      </div>

      <p className="mt-6 flex gap-2 text-sm text-muted-foreground">
        <LockKeyhole className="mt-0.5 size-4 shrink-0" />
        Your payment information is stored securely by Stripe.
      </p>
    </section>
  );
}

function InvoiceHistory({ invoices }: { invoices: BillingInvoice[] }) {
  const visibleInvoices = invoices.length
    ? invoices
    : [
        {
          id: "empty",
          date: "No invoices yet",
          description: "Invoices will appear after your first successful payment.",
          amount: "-",
          status: "pending",
          downloadUrl: null,
        },
      ];

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm lg:p-8">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Invoice history</h2>
        <Link href="#" className="text-sm font-bold text-primary">
          View all
        </Link>
      </div>
      <div className="mt-6 divide-y">
        {visibleInvoices.map((invoice) => (
          <div
            key={invoice.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4 text-sm md:grid-cols-[140px_minmax(0,1fr)_110px_90px_40px]"
          >
            <p className="font-medium">{invoice.date}</p>
            <p className="min-w-0 text-muted-foreground">{invoice.description}</p>
            <p className="font-medium">{invoice.amount}</p>
            <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold capitalize text-emerald-700">
              {invoice.status}
            </span>
            {invoice.downloadUrl ? (
              <Link
                href={invoice.downloadUrl}
                className="inline-flex size-8 items-center justify-center rounded-md text-primary hover:bg-secondary"
                aria-label="Download invoice"
              >
                <Download className="size-4" />
              </Link>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function SubscriptionDetails({ billing }: { billing: BillingData | null }) {
  const rows = [
    { label: "Plan", value: billing?.planName || "No active plan" },
    { label: "Billing cycle", value: billing?.cycle || "Monthly" },
    {
      label: "Price",
      value: billing?.price || (
        <>
          <CurrencyAmount cents={agentSubscriptionPrice.amountCents} /> / month
        </>
      ),
    },
    { label: "Next billing date", value: billing?.nextBillingDate || "Not available" },
    {
      label: "Payment method",
      value: billing?.card ? `•••• ${billing.card.last4}` : "Not added",
    },
    { label: "Started on", value: billing?.startedOn || "Not available" },
  ];

  return (
    <section className="rounded-lg border bg-card p-6 shadow-sm lg:p-8">
      <h2 className="font-bold">Subscription details</h2>
      <div className="mt-7 space-y-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
            <span>{row.label}</span>
            <span className="text-right font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
      {billing ? (
        <form action={cancelAgentSubscription} className="mt-8">
          <Button
            type="submit"
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            Cancel subscription
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function CompactAgentUpgradeCta() {
  return (
    <section className="overflow-hidden rounded-lg border border-primary/15 bg-secondary p-5 shadow-sm sm:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Build your property brand
          </p>
          <h2 className="mt-2 max-w-xl text-2xl font-bold leading-tight tracking-tight">
            Turn your profile into a{" "}
            <span className="homzie-gradient-text">property agent</span>{" "}
            portfolio.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Subscribe to publish listings, post property reels, capture leads,
            and manage your agent billing from this page.
          </p>
        </div>
        <Button asChild className="h-11 px-6">
          <Link href="/become-agent">
            <TrendingUp className="size-4" />
            Start for <CurrencyAmount cents={agentSubscriptionPrice.amountCents} />
            /month
          </Link>
        </Button>
      </div>
    </section>
  );
}

export default async function BillingSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.username) {
    redirect("/onboarding/username");
  }

  const billing = await getBillingData(user.id);
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar />

      <main className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        <div className="flex items-center justify-between gap-4 lg:justify-end">
          <BackButton className="text-foreground hover:text-primary lg:hidden" />
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" aria-label="Help">
              <HelpCircle className="size-4" />
            </Button>
            <div className="hidden items-center gap-3 sm:flex">
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary ring-2 ring-primary">
                {initials || "H"}
              </div>
              <span className="font-semibold">{user.name}</span>
            </div>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Go to settings menu"
            >
              <Link href="/settings">
                <Menu className="size-5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Manage your subscription, payment methods and view your invoices.
          </p>
        </div>

        {!billing ? <div className="mt-8"><CompactAgentUpgradeCta /></div> : null}

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <CurrentPlanCard billing={billing} />
            <InvoiceHistory invoices={billing?.invoices || []} />
          </div>
          <div className="space-y-6">
            <PaymentMethodCard billing={billing} />
            <SubscriptionDetails billing={billing} />
            <div className="rounded-lg bg-[linear-gradient(135deg,rgba(123,92,255,0.08),rgba(255,77,184,0.1))] p-6">
              <p className="font-bold">Grow your brand</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upgrade to Homzie Agent Pro to unlock more tools.
              </p>
              <Link
                href="/become-agent"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary"
              >
                Upgrade now
                <TrendingUp className="size-4" />
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HelpCircle className="size-4" />
          </span>
          Need help? Visit our{" "}
          <Link href="#" className="font-bold text-primary">
            Help Centre
          </Link>
          or contact{" "}
          <Link href="mailto:support@homzie.co.za" className="font-bold text-primary">
            support@homzie.co.za
          </Link>
        </p>
      </main>
    </div>
  );
}
