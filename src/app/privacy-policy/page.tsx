import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Privacy Policy",
  "How Homzie collects, uses, stores, shares, and protects personal information.",
);

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains how Homzie handles personal information when you use our website, property listings, property reels, agent profiles, messaging, subscriptions, support channels, and related services."
      sections={[
        {
          title: "Who we are and when this policy applies",
          body: [
            "Homzie is a property discovery platform that connects buyers, sellers, agents, and property professionals through listings, agent profiles, property reels, messages, saved items, enquiries, and related tools.",
            "This policy applies whenever you access or use Homzie, create an account, view or publish listings, communicate with users, subscribe to agent tools, submit a support request, interact with our emails, or otherwise provide information to us.",
            "For the purposes of this policy, personal information means information that identifies you or can reasonably be linked to you, including information protected under South African privacy laws such as the Protection of Personal Information Act, 2013.",
          ],
        },
        {
          title: "Information you provide to us",
          body: [
            "We collect information you choose to provide, including your name, email address, username, password or sign-in credentials, profile photo, biography, role, agency or business details, contact number, WhatsApp number, public contact preferences, and account settings.",
            "If you are an agent, seller, or property professional, we may collect information about your listings, mandates, property descriptions, property features, prices, locations, images, videos, reels, performance data, seller instructions, availability, and supporting information you upload or submit.",
            "If you contact us, submit a form, send an enquiry, report content, request support, or communicate through messages, we collect the contents of those communications and the information needed to respond.",
            "If you use paid features, we collect billing-related information such as your subscription status, selected plan, invoices, payment status, and billing identifiers. Payment card details are handled by our payment provider and are not stored directly by Homzie.",
          ],
        },
        {
          title: "Information collected automatically",
          body: [
            "When you use Homzie, we may automatically collect technical and usage information such as your IP address, device type, browser type, operating system, referring pages, pages viewed, search activity, listing views, saved items, clicks, reels watched, session activity, approximate location inferred from technical data, and timestamps.",
            "We use cookies, local storage, and similar technologies to keep you signed in, remember preferences such as country, currency and theme, protect accounts, measure usage, improve search, and understand platform performance.",
            "We may collect logs and security data to detect misuse, spam, fraud, scraping, unauthorised access, service abuse, and technical errors.",
          ],
        },
        {
          title: "How we use personal information",
          body: [
            "We use personal information to operate Homzie, create and manage accounts, publish listings and reels, display agent profiles, enable search and discovery, process enquiries, support messaging, provide saved items, and maintain the core platform experience.",
            "We use information to verify and administer agent tools, manage subscriptions, process payments, issue billing records, provide support, send service messages, respond to requests, and communicate important account or platform updates.",
            "We use information to personalize the platform, including showing relevant listings, remembering preferences, improving recommendations, and helping agents understand the performance of their content.",
            "We use information to monitor, protect, and improve Homzie, including debugging, analytics, abuse prevention, fraud detection, enforcing our terms, preventing harmful conduct, and keeping the platform reliable.",
            "Where permitted, we may use contact information to send product updates, feature announcements, or other communications about Homzie. You can opt out of non-essential marketing communications where an unsubscribe option is available.",
          ],
        },
        {
          title: "Legal bases and legitimate interests",
          body: [
            "We process personal information where it is necessary to provide the services you requested, perform our agreement with you, comply with legal obligations, protect users and the platform, pursue legitimate business interests, or where you have given consent.",
            "Our legitimate interests include operating a trusted property marketplace, preventing fraud and abuse, supporting customer service, improving platform functionality, understanding performance, and enabling safe communication between users.",
            "Where we rely on consent, you may withdraw that consent where applicable. Withdrawal does not affect processing that occurred before the withdrawal or processing that is required for another lawful reason.",
          ],
        },
        {
          title: "Public information and user-generated content",
          body: [
            "Certain information is intended to be public, including published listings, listing media, property reels, agent names, public agent profiles, public contact details you choose to show, agency information, performance-related displays, and other content submitted for publication.",
            "Public content may be viewed, saved, shared, indexed by search engines, cached, or copied by other users or third parties. You should not publish information that you do not want to be publicly available.",
            "If you remove public content, copies may remain in backups, logs, search engine caches, user messages, or records needed for legal, safety, moderation, billing, or legitimate business reasons.",
          ],
        },
        {
          title: "How we share information",
          body: [
            "We share information with service providers that help us provide Homzie, including hosting, databases, storage, analytics, payments, email delivery, security, authentication, customer support, and infrastructure providers.",
            "We may share relevant information between users where needed for the platform to function, such as sending your enquiry to an agent, showing message participants, displaying agent details, or allowing a listing owner to manage their listing.",
            "We may disclose information if required by law, legal process, regulators, courts, law enforcement, or government authorities, or where disclosure is necessary to protect rights, safety, security, property, users, Homzie, or the public.",
            "If Homzie is involved in a merger, acquisition, financing, restructuring, sale of assets, or similar transaction, information may be transferred as part of that transaction, subject to appropriate safeguards where required.",
          ],
        },
        {
          title: "Payments and third-party services",
          body: [
            "Homzie uses third-party providers to process payments and subscriptions. Those providers may collect and process payment information according to their own terms and privacy policies.",
            "We receive payment-related records needed to manage your subscription, such as payment status, plan information, customer identifiers, invoice information, and cancellation or renewal status.",
            "Homzie may link to third-party websites, payment pages, social platforms, maps, email providers, or external services. We are not responsible for the privacy practices of third parties, and you should review their policies before using them.",
          ],
        },
        {
          title: "Data storage, security, and retention",
          body: [
            "We use reasonable technical and organisational safeguards designed to protect personal information against unauthorised access, loss, misuse, alteration, or disclosure.",
            "No online service can be guaranteed to be completely secure. You are responsible for keeping your login details safe, using strong passwords, and telling us promptly if you suspect unauthorised access to your account.",
            "We retain information for as long as reasonably needed to provide Homzie, maintain records, comply with legal obligations, resolve disputes, enforce agreements, prevent abuse, support billing, and protect the platform.",
            "Retention periods vary depending on the type of information, the purpose for which it is used, legal requirements, and operational needs. We may retain aggregated or de-identified information for longer periods.",
          ],
        },
        {
          title: "International transfers",
          body: [
            "Some of our service providers, systems, or infrastructure may be located outside South Africa. This means personal information may be processed in countries with data protection laws that differ from those in your country.",
            "Where required, we take reasonable steps to ensure that personal information transferred internationally receives appropriate protection, including through contractual safeguards or by using providers with suitable security and privacy commitments.",
          ],
        },
        {
          title: "Your privacy rights",
          body: [
            "Subject to applicable law, you may request access to personal information we hold about you, ask us to correct inaccurate information, request deletion, object to certain processing, withdraw consent where applicable, or ask questions about our privacy practices.",
            "You can update many account and profile details directly through your Homzie settings. Some changes, deletion requests, or restrictions may affect your ability to use certain features.",
            "We may need to verify your identity before responding to a privacy request. We may refuse or limit a request where permitted by law, including where information is needed for legal, security, fraud prevention, billing, dispute resolution, or legitimate business reasons.",
          ],
        },
        {
          title: "Children and minors",
          body: [
            "Homzie is not intended for children under the age of 18. Users should not create accounts, submit listings, send enquiries, or provide personal information if they are under 18 without appropriate legal authority or guardian involvement.",
            "If we become aware that we have collected personal information from a child in a way that is not permitted, we will take reasonable steps to delete or restrict that information.",
          ],
        },
        {
          title: "Changes to this policy",
          body: [
            "We may update this Privacy Policy from time to time to reflect changes in our services, legal requirements, business practices, or privacy approach.",
            "When changes are material, we may provide additional notice through the platform, by email, or by updating the date on this page. Continued use of Homzie after an update means the updated policy applies.",
          ],
        },
        {
          title: "Contact us",
          body: [
            "Privacy questions, access requests, correction requests, or complaints can be sent to support@homzie.co.za or submitted through the contact page.",
            "Our support location is 6 Christelle Str, Denneburg, Paarl, Western Cape, South Africa, 7646.",
          ],
        },
      ]}
    />
  );
}
