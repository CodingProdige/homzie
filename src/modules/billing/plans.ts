export type AgentPlanInterval = "month" | "year";

export const agentSubscriptionPlans: Record<
  AgentPlanInterval,
  {
    label: string;
    amountLabel: string;
    intervalLabel: string;
    amountCents: number;
    currency: string;
    priceEnvKey: "STRIPE_AGENT_MONTHLY_PRICE_ID" | "STRIPE_AGENT_YEARLY_PRICE_ID";
  }
> = {
  month: {
    label: "Monthly",
    amountLabel: "R99",
    intervalLabel: "/month",
    amountCents: 9900,
    currency: "ZAR",
    priceEnvKey: "STRIPE_AGENT_MONTHLY_PRICE_ID",
  },
  year: {
    label: "Yearly",
    amountLabel: "R999",
    intervalLabel: "/year",
    amountCents: 99900,
    currency: "ZAR",
    priceEnvKey: "STRIPE_AGENT_YEARLY_PRICE_ID",
  },
};

export const defaultAgentPlanInterval: AgentPlanInterval = "month";
export const agentSubscriptionPrice =
  agentSubscriptionPlans[defaultAgentPlanInterval];
