"use client";

type GtagEventParams = Record<string, boolean | number | string | undefined>;

type GoogleAdsConversionAction =
  | "agentSignupStarted"
  | "agentSubscriptionStarted"
  | "agentTrialStarted"
  | "buyerMessageSent"
  | "createListingStarted"
  | "listingContactClicked"
  | "listingPublished"
  | "offerSubmitted";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const defaultGoogleAdsConversionId = "AW-18217057293";

const googleAdsConversionSendTo: Record<GoogleAdsConversionAction, string> = {
  agentSignupStarted:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_AGENT_SIGNUP_STARTED ||
    `${defaultGoogleAdsConversionId}/taY_CM0DyMccEI34y05D`,
  agentSubscriptionStarted:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_AGENT_SUBSCRIPTION_STARTED ||
    `${defaultGoogleAdsConversionId}/3XnFCLy4yMccEI34y05D`,
  agentTrialStarted:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_AGENT_TRIAL_STARTED ||
    `${defaultGoogleAdsConversionId}/0GxbCLm4yMccEI34y05D`,
  buyerMessageSent:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_BUYER_MESSAGE_SENT ||
    `${defaultGoogleAdsConversionId}/kb1QCK24yMccEI34y05D`,
  createListingStarted:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CREATE_LISTING_STARTED ||
    `${defaultGoogleAdsConversionId}/zruyCL-4yMccEI34y05D`,
  listingContactClicked:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LISTING_CONTACT_CLICKED ||
    `${defaultGoogleAdsConversionId}/IPWWCL04yMccEI34y05D`,
  listingPublished:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LISTING_PUBLISHED ||
    `${defaultGoogleAdsConversionId}/Hcl6CLa4yMccEI34y05D`,
  offerSubmitted:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_OFFER_SUBMITTED ||
    `${defaultGoogleAdsConversionId}/Ou0aCLC4yMccEI34y05D`,
};

export function trackGoogleEvent(
  eventName: string,
  params: GtagEventParams = {},
) {
  if (typeof window === "undefined") return;

  window.gtag?.("event", eventName, params);
}

export function trackGoogleAdsConversion(
  action: GoogleAdsConversionAction,
  params: GtagEventParams = {},
) {
  if (typeof window === "undefined") return;

  const sendTo = googleAdsConversionSendTo[action];
  if (!sendTo) return;

  window.gtag?.("event", "conversion", {
    currency: "ZAR",
    send_to: sendTo,
    value: 1,
    ...params,
  });
}
