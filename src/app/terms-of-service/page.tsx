import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Terms of Service",
  "The terms that govern your access to and use of Homzie.",
);

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      description="These terms govern access to and use of Homzie, including property listings, property reels, agent profiles, messaging, subscriptions, payments, support, and related services."
      sections={[
        {
          title: "Acceptance of these terms",
          body: [
            "By accessing or using Homzie, creating an account, browsing listings, contacting an agent, publishing content, subscribing to agent tools, or using any related feature, you agree to these Terms of Service.",
            "If you use Homzie on behalf of an agency, company, property owner, seller, or other organisation, you confirm that you have authority to bind that person or organisation to these terms.",
            "If you do not agree with these terms, you must not use Homzie.",
          ],
        },
        {
          title: "What Homzie provides",
          body: [
            "Homzie provides a digital platform for property discovery, property listings, agent profiles, property reels, saved items, messages, enquiries, and tools that help agents and property professionals present properties to potential buyers and renters.",
            "Homzie is not an estate agency, conveyancer, financial adviser, bank, insurer, attorney, property valuer, or party to any property transaction unless expressly stated in writing.",
            "We do not guarantee that a property is available, correctly priced, suitable, financeable, transferable, defect-free, or that any transaction will proceed or complete.",
          ],
        },
        {
          title: "Accounts and eligibility",
          body: [
            "You must provide accurate account information and keep it up to date. You are responsible for maintaining the confidentiality of your login details and for all activity under your account.",
            "You must not create accounts using false information, impersonate another person, use another user's account, or create accounts to evade restrictions, moderation, suspension, or payment obligations.",
            "Homzie may refuse registration, require verification, restrict features, suspend accounts, or close accounts where we reasonably believe there is a risk of misuse, fraud, inaccurate information, unlawful activity, or breach of these terms.",
          ],
        },
        {
          title: "Agent tools, subscriptions, and listing access",
          body: [
            "Listing access and agent tools may require an active paid subscription. The current Homzie Agent subscription is displayed during checkout or account management and may vary by currency, taxes, promotions, or future plan changes.",
            "You are responsible for keeping your payment method valid and for paying all applicable subscription fees, taxes, and charges. If a payment fails, we may suspend or restrict access to paid features until payment is resolved.",
            "Subscriptions may renew automatically unless cancelled according to the cancellation flow available in your account or payment provider portal. Cancellation may stop future renewals but does not automatically refund previous charges unless required by law or expressly stated.",
            "We may change pricing, plan features, limits, billing intervals, or subscription requirements. Where required, we will provide notice or display updated terms before they apply.",
          ],
        },
        {
          title: "Listings, reels, and property content",
          body: [
            "You are responsible for all listings, reels, images, videos, descriptions, prices, locations, property features, availability, performance claims, agency details, mandate claims, and other content that you submit or publish.",
            "Property content must be accurate, current, lawful, not misleading, and authorised for publication. You must have the necessary rights, permissions, mandates, licences, and consents to upload, display, promote, and use the content on Homzie.",
            "You must promptly update or remove content that becomes inaccurate, unavailable, expired, sold, rented, withdrawn, unauthorised, or misleading.",
            "Homzie may review, moderate, edit formatting, reject, remove, demote, restrict, or disable content that we believe breaches these terms, creates risk, harms trust, infringes rights, is unlawful, or negatively affects the platform experience.",
          ],
        },
        {
          title: "Buyer, seller, and user responsibilities",
          body: [
            "Users must make their own enquiries before relying on any listing, agent statement, price, availability, property feature, media, reel, performance metric, or communication on Homzie.",
            "Buyers and renters should inspect properties, verify ownership or mandates, confirm prices and availability, check property condition, seek finance advice, and obtain professional legal, tax, inspection, or conveyancing advice where appropriate.",
            "Agents, sellers, and property professionals must comply with applicable laws, professional standards, advertising rules, consumer protection obligations, privacy laws, and any regulatory duties that apply to their services.",
          ],
        },
        {
          title: "Messaging, enquiries, and communication",
          body: [
            "Homzie may provide messaging, enquiry, notification, and contact tools so users can communicate about listings, agent services, support issues, and platform activity.",
            "You must not use communication tools to send spam, harassment, abusive content, unlawful content, scams, deceptive offers, phishing attempts, malware, unsolicited marketing, or content that infringes another person's rights.",
            "We may monitor, store, review, or restrict communications where necessary to operate messaging, investigate reports, prevent abuse, protect users, comply with law, or enforce these terms.",
          ],
        },
        {
          title: "Acceptable use",
          body: [
            "You must use Homzie only for lawful purposes and in a way that does not damage, disable, overload, scrape, reverse engineer, interfere with, or compromise the platform, its users, or its systems.",
            "You must not attempt to bypass security, rate limits, paywalls, subscription requirements, moderation, access controls, or technical protections.",
            "You must not upload malicious code, harvest personal information, use automated bots without permission, copy large volumes of data, create fake engagement, manipulate metrics, or use Homzie to conduct fraudulent or harmful activity.",
          ],
        },
        {
          title: "Intellectual property",
          body: [
            "Homzie, including its brand, design, software, interface, features, logos, graphics, and platform content, is owned by Homzie or its licensors and is protected by applicable intellectual property laws.",
            "You retain ownership of content you submit, but you grant Homzie a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, display, distribute, adapt formatting, promote, and use that content as needed to operate, market, improve, and provide Homzie.",
            "You confirm that your content does not infringe copyright, trademarks, privacy rights, image rights, publicity rights, contractual rights, or any other rights of another person.",
          ],
        },
        {
          title: "Payments, refunds, and billing disputes",
          body: [
            "Paid services are processed through third-party payment providers. By purchasing a subscription or paid feature, you may also agree to the payment provider's terms and privacy policy.",
            "Fees are generally non-refundable except where required by law or expressly stated by Homzie. If you believe a charge is incorrect, you must contact support promptly with the relevant billing information.",
            "Homzie may suspend access to paid features, listings, reels, or agent tools if payment fails, if a chargeback is raised, if fraud is suspected, or if these terms are breached.",
          ],
        },
        {
          title: "Disclaimers",
          body: [
            "Homzie is provided on an as-is and as-available basis. We aim to provide a reliable service, but we do not guarantee uninterrupted availability, error-free operation, perfect search results, message delivery, listing accuracy, or compatibility with every device or browser.",
            "We do not verify every listing, seller, buyer, agent, mandate, property condition, price, title, zoning, defect, availability, or representation. Users are responsible for their own due diligence.",
            "Any analytics, views, engagement metrics, or performance information shown on Homzie are provided for convenience and may be estimates, delayed, incomplete, or affected by technical factors.",
          ],
        },
        {
          title: "Limitation of liability",
          body: [
            "To the maximum extent permitted by law, Homzie will not be liable for indirect, incidental, special, consequential, punitive, or economic losses, including loss of profits, loss of data, lost opportunities, failed transactions, reputational harm, or reliance on listings or communications.",
            "Nothing in these terms excludes liability that cannot be excluded under applicable law. Where liability cannot be excluded, our liability will be limited to the extent permitted by law.",
          ],
        },
        {
          title: "Suspension and termination",
          body: [
            "You may stop using Homzie at any time. You may also cancel paid subscriptions through the available account or billing tools.",
            "We may suspend, restrict, or terminate your account, content, listings, messages, or access to features if we reasonably believe you breached these terms, created risk, failed to pay, misused the platform, violated law, or harmed users or Homzie.",
            "Termination does not affect rights or obligations that arose before termination, including payment obligations, licences granted for previously published content, moderation records, dispute records, and provisions intended to survive.",
          ],
        },
        {
          title: "Changes to Homzie or these terms",
          body: [
            "We may update, improve, restrict, suspend, discontinue, or change parts of Homzie at any time, including features, plans, pricing, limits, content formats, eligibility, and availability.",
            "We may update these terms from time to time. Where changes are material, we may provide notice through the platform, by email, or by updating the date on the policy page. Continued use after changes means you accept the updated terms.",
          ],
        },
        {
          title: "Governing law and contact",
          body: [
            "These terms are governed by the laws of South Africa, unless mandatory law requires otherwise.",
            "Questions about these terms, billing, subscriptions, or account access can be sent to support@homzie.co.za or submitted through the contact page.",
            "Our support location is 6 Christelle Str, Denneburg, Paarl, Western Cape, South Africa, 7646.",
          ],
        },
      ]}
    />
  );
}
