import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Terms of Service",
  "The terms that govern your use of Homzie.",
);

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms govern access to and use of Homzie, including property listings, reels, agent profiles, messaging, subscriptions, and related services."
      sections={[
        {
          title: "Using Homzie",
          body: [
            "You must use Homzie lawfully, honestly, and in a way that does not harm the platform or other users.",
            "You are responsible for the information you submit and for keeping your account credentials secure.",
          ],
        },
        {
          title: "Listings and agent content",
          body: [
            "Listings, reels, profile details, prices, availability, and property information must be accurate, current, and authorised for publication.",
            "Homzie may moderate, remove, restrict, or refuse content that appears inaccurate, unlawful, misleading, unsafe, or inconsistent with our standards.",
          ],
        },
        {
          title: "Subscriptions and payments",
          body: [
            "Paid features, subscriptions, and billing terms are shown during checkout or account management. You are responsible for applicable fees, taxes, and payment details.",
            "Access to paid features may be suspended or cancelled if payment fails or if these terms are breached.",
          ],
        },
        {
          title: "Messaging and conduct",
          body: [
            "Users must not send spam, harassment, unlawful content, misleading offers, or content that infringes the rights of others.",
            "Homzie may investigate reports and restrict accounts where necessary to protect users and the platform.",
          ],
        },
        {
          title: "Disclaimers",
          body: [
            "Homzie provides a platform for discovery and communication. We do not guarantee property availability, transaction outcomes, agent performance, or third-party representations.",
            "Users should perform their own checks and seek professional advice where appropriate.",
          ],
        },
        {
          title: "Changes",
          body: [
            "We may update these terms from time to time. Continued use of Homzie after changes means you accept the updated terms.",
          ],
        },
      ]}
    />
  );
}
