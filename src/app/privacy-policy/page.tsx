import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Privacy Policy",
  "How Homzie collects, uses, and protects personal information.",
);

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains how Homzie handles personal information when you use our website, listings, reels, agent profiles, messaging, and related services."
      sections={[
        {
          title: "Information we collect",
          body: [
            "We collect account details, profile information, contact details, listing content, messages, support requests, usage data, device data, and payment-related information where applicable.",
            "Agents and sellers may provide property, mandate, media, and performance information. Buyers may provide search preferences, saved items, enquiries, and communication history.",
          ],
        },
        {
          title: "How we use information",
          body: [
            "We use information to operate Homzie, verify accounts, publish listings, personalize discovery, improve search and recommendations, enable messaging, process subscriptions, provide support, and protect the platform.",
            "We may also use aggregated or de-identified information to understand platform performance and improve our products.",
          ],
        },
        {
          title: "Sharing and disclosure",
          body: [
            "We share information with service providers that help us run hosting, analytics, payments, communications, security, and customer support.",
            "We may disclose information if required by law, to enforce our terms, prevent harm, or protect the rights and safety of Homzie, users, agents, and the public.",
          ],
        },
        {
          title: "Your choices",
          body: [
            "You may update your profile information, adjust public contact visibility, manage notification preferences, and request help with access, correction, or deletion of personal information.",
            "Some information may need to be retained for legal, security, billing, fraud prevention, or legitimate business reasons.",
          ],
        },
        {
          title: "Security and retention",
          body: [
            "We use reasonable technical and organisational safeguards to protect information. No internet service can be guaranteed to be completely secure.",
            "We retain information for as long as needed to provide Homzie, comply with obligations, resolve disputes, and enforce agreements.",
          ],
        },
        {
          title: "Contact",
          body: [
            "Questions about privacy can be sent to hello@homzie.co.za or through the contact page.",
          ],
        },
      ]}
    />
  );
}
