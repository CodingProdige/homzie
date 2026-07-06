"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { sql } from "@/db";
import { controlRoomPathForWorkspace } from "@/modules/agencies/control-room";
import { getPrimaryAgencyWorkspace } from "@/modules/agencies/server";
import { authOptions } from "@/modules/auth/config";
import {
  getStripe,
  getStripePublishableKey,
  getStripeRuntimeConfig,
} from "@/modules/billing/stripe";

type AgencyBillingSetupResult =
  | {
      ok: true;
      clientSecret: string;
      publishableKey: string;
    }
  | { ok: false; error: string; missingEnv?: string[] };

type FinalizeAgencyBillingResult =
  | {
      ok: true;
      paymentMethodLabel: string;
    }
  | { ok: false; error: string };

type AgencyBillingCustomerRow = {
  contact_email: string | null;
  id: string;
  name: string;
  owner_email: string | null;
  provider_customer_id: string | null;
};

async function requireAgencyBillingManager() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error("Sign in before managing agency billing.");
  }

  const workspace = await getPrimaryAgencyWorkspace(session.user.id);

  if (!workspace || !workspace.membership.canManageBilling) {
    throw new Error("Only agency owners, admins, or finance users can manage billing.");
  }

  if (workspace.agency.agencyType === "network") {
    throw new Error("Network HQ workspaces do not manage agency billing.");
  }

  return { userId: session.user.id, workspace };
}

async function getAgencyBillingCustomerRow(agencyId: string) {
  const [row] = await sql<AgencyBillingCustomerRow[]>`
    SELECT
      a.id,
      a.name,
      a.contact_email,
      bp.provider_customer_id,
      owner.email AS owner_email
    FROM agencies a
    LEFT JOIN agency_billing_profiles bp ON bp.agency_id = a.id
    LEFT JOIN users owner ON owner.id = a.billing_owner_user_id
    WHERE a.id = ${agencyId}
    LIMIT 1
  `;

  if (!row) {
    throw new Error("Could not find this agency workspace.");
  }

  return row;
}

async function ensureAgencyStripeCustomer(agencyId: string) {
  const stripe = await getStripe();
  const agency = await getAgencyBillingCustomerRow(agencyId);

  if (agency.provider_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(agency.provider_customer_id);

      if (!customer.deleted) {
        return {
          billingEmail: agency.contact_email || agency.owner_email || null,
          customerId: customer.id,
        };
      }
    } catch {
      // Fall through and create a fresh customer if Stripe no longer has it.
    }
  }

  const billingEmail = agency.contact_email || agency.owner_email || undefined;
  const customer = await stripe.customers.create({
    email: billingEmail,
    name: agency.name,
    metadata: {
      agencyId: agency.id,
      billingMode: "agency_automated_billing",
    },
  });

  await sql`
    INSERT INTO agency_billing_profiles (
      agency_id,
      provider,
      status,
      provider_customer_id,
      billing_email,
      updated_at
    )
    VALUES (
      ${agency.id},
      'stripe',
      'missing',
      ${customer.id},
      ${billingEmail || null},
      now()
    )
    ON CONFLICT (agency_id) DO UPDATE SET
      provider = 'stripe',
      provider_customer_id = excluded.provider_customer_id,
      billing_email = excluded.billing_email,
      updated_at = now()
  `;

  return {
    billingEmail: billingEmail || null,
    customerId: customer.id,
  };
}

function paymentMethodLabel(value: {
  card?: {
    brand?: string | null;
    last4?: string | null;
  } | null;
  type?: string | null;
}) {
  if (value.card?.brand && value.card.last4) {
    return `${value.card.brand.toUpperCase()} **** ${value.card.last4}`;
  }

  return value.type ? `${value.type} payment method` : "Saved payment method";
}

export async function startAgencyBillingSetup(): Promise<AgencyBillingSetupResult> {
  try {
    const { workspace } = await requireAgencyBillingManager();
    const config = await getStripeRuntimeConfig();
    const missingEnv = [
      !config.secretKey ? "STRIPE_SECRET_KEY" : null,
      !config.publishableKey ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" : null,
    ].filter((value): value is string => Boolean(value));

    if (missingEnv.length) {
      return {
        ok: false,
        error: "Stripe billing setup is not configured yet.",
        missingEnv,
      };
    }

    const stripe = await getStripe();
    const publishableKey = await getStripePublishableKey();
    const { customerId } = await ensureAgencyStripeCustomer(workspace.agency.id);
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        agencyId: workspace.agency.id,
        setupMode: "agency_automated_billing",
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("Stripe did not return a payment form secret.");
    }

    return {
      ok: true,
      clientSecret: setupIntent.client_secret,
      publishableKey,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not start agency billing setup.",
    };
  }
}

export async function finalizeAgencyBillingSetup(
  paymentMethodId?: string | null,
): Promise<FinalizeAgencyBillingResult> {
  try {
    if (!paymentMethodId) {
      return {
        ok: false,
        error: "Confirm a card before saving agency billing.",
      };
    }

    const { workspace } = await requireAgencyBillingManager();
    const stripe = await getStripe();
    const { billingEmail, customerId } = await ensureAgencyStripeCustomer(
      workspace.agency.id,
    );
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const existingCustomerId =
      typeof paymentMethod.customer === "string"
        ? paymentMethod.customer
        : paymentMethod.customer?.id || null;

    if (existingCustomerId && existingCustomerId !== customerId) {
      return {
        ok: false,
        error: "This payment method belongs to another billing customer.",
      };
    }

    if (!existingCustomerId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const label = paymentMethodLabel(paymentMethod);

    await sql`
      INSERT INTO agency_billing_profiles (
        agency_id,
        provider,
        status,
        provider_customer_id,
        provider_payment_method_id,
        payment_method_label,
        billing_email,
        failure_message,
        last_verified_at,
        updated_at
      )
      VALUES (
        ${workspace.agency.id},
        'stripe',
        'ready',
        ${customerId},
        ${paymentMethodId},
        ${label},
        ${billingEmail},
        null,
        now(),
        now()
      )
      ON CONFLICT (agency_id) DO UPDATE SET
        provider = 'stripe',
        status = 'ready',
        provider_customer_id = excluded.provider_customer_id,
        provider_payment_method_id = excluded.provider_payment_method_id,
        payment_method_label = excluded.payment_method_label,
        billing_email = excluded.billing_email,
        failure_message = null,
        last_verified_at = now(),
        updated_at = now()
    `;

    const basePath = controlRoomPathForWorkspace(workspace);
    revalidatePath(`${basePath}/settings/billing`);
    revalidatePath(`${basePath}/members`);

    return {
      ok: true,
      paymentMethodLabel: label,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not save agency billing.",
    };
  }
}
