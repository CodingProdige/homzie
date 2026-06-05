import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Community Guidelines",
  "The standards for participating on Homzie.",
);

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      description="These guidelines help keep Homzie useful, trusted, safe, and respectful for buyers, sellers, agents, agencies, and property teams."
      sections={[
        {
          title: "Our community standard",
          body: [
            "Homzie is built around trust. Buyers and renters should be able to discover properties with confidence, and agents should be able to build credible portfolios using accurate listings, reels, and communication.",
            "These guidelines apply to all users, including buyers, sellers, agents, agencies, property professionals, support users, and anyone who uploads content, sends messages, submits enquiries, or interacts with Homzie.",
            "Using Homzie means participating honestly, respectfully, and in a way that protects the integrity of property discovery.",
          ],
        },
        {
          title: "Be accurate and transparent",
          body: [
            "Listings, reels, captions, prices, property descriptions, features, locations, availability, floor areas, images, videos, agent details, and agency information must be accurate and kept up to date.",
            "Do not exaggerate, hide material facts, use deceptive descriptions, list properties that are unavailable, or imply that you have authority to market a property if you do not.",
            "If a property is sold, rented, withdrawn, no longer mandated, or materially changed, update or remove the listing promptly.",
          ],
        },
        {
          title: "Use authentic media",
          body: [
            "Property photos, videos, reels, thumbnails, and visual content should fairly represent the property being marketed. Do not use unrelated property media, misleading edits, fake images, or images that create a false impression.",
            "You must have the rights and permissions needed to upload and publish media. This includes permission from the property owner, photographer, videographer, agency, or rights holder where required.",
            "Avoid uploading media that exposes private information, personal documents, vehicle registration numbers, children, private occupants, or sensitive areas without appropriate consent.",
          ],
        },
        {
          title: "Respect users in messages and enquiries",
          body: [
            "Messages should be relevant, respectful, and connected to legitimate property interest or platform support. Do not harass, threaten, pressure, insult, discriminate, spam, or intimidate other users.",
            "Do not send scams, phishing links, malware, abusive content, explicit content, unlawful offers, fake finance promises, or requests for sensitive information unrelated to a legitimate property enquiry.",
            "If someone asks you to stop contacting them, respect that request unless there is a lawful and necessary reason to continue communication.",
          ],
        },
        {
          title: "No discrimination or harmful conduct",
          body: [
            "Users must not discriminate, exclude, threaten, harass, or encourage harm based on race, colour, religion, gender, sex, sexual orientation, gender identity, nationality, ethnic origin, disability, age, family status, or any other protected characteristic.",
            "Property advertising and communication must comply with applicable anti-discrimination, consumer protection, housing, and advertising laws.",
            "Homzie may remove content or restrict accounts that promote hate, humiliation, intimidation, exploitation, or unsafe conduct.",
          ],
        },
        {
          title: "No fake listings, fraud, or manipulation",
          body: [
            "Do not create fake listings, fake profiles, fake engagement, fake enquiries, fake reviews, fake performance claims, or misleading agent identities.",
            "Do not use Homzie to solicit deposits, fees, documents, identity information, or payments through deceptive or unauthorised schemes.",
            "Do not manipulate metrics, scrape listings, run unauthorised automation, evade rate limits, bypass subscriptions, or create accounts to avoid enforcement.",
          ],
        },
        {
          title: "Protect privacy and confidential information",
          body: [
            "Do not publish private information about another person without permission. This includes identity numbers, private addresses unrelated to a listing, phone numbers, email addresses, financial information, private messages, or confidential documents.",
            "Do not upload mandate documents, contracts, bank details, ID documents, proof of address, or sensitive personal information unless a specific Homzie feature requires it and you have the necessary authority.",
            "Agents and agencies must handle buyer, seller, and lead information responsibly and in line with applicable privacy laws.",
          ],
        },
        {
          title: "Respect intellectual property",
          body: [
            "Only upload content that you own, created, licensed, or have permission to use. This includes photos, videos, music, logos, descriptions, floor plans, maps, graphics, and marketing copy.",
            "Do not copy another agent's listing, media, captions, branding, or property presentation without permission.",
            "If you believe your intellectual property is being used without permission, contact support with enough detail for us to review the issue.",
          ],
        },
        {
          title: "Professional standards for agents",
          body: [
            "Agents and property professionals should present themselves honestly, respond to enquiries professionally, keep listings current, and avoid conduct that damages trust in the platform or the property industry.",
            "Do not claim sales, mandates, qualifications, agency affiliations, awards, or performance results that are false or misleading.",
            "If you operate under an agency, team, or brand, make sure your use of Homzie aligns with your obligations to that organisation and applicable professional rules.",
          ],
        },
        {
          title: "Reporting problems",
          body: [
            "If you see misleading listings, abusive messages, suspected scams, unauthorised media, privacy issues, or content that breaches these guidelines, please report it or contact support.",
            "When reviewing reports, Homzie may consider the content, account history, user impact, available evidence, legal obligations, and platform risk.",
            "Submitting false, abusive, or bad-faith reports may itself be treated as a breach of these guidelines.",
          ],
        },
        {
          title: "Enforcement",
          body: [
            "Homzie may remove content, limit reach, disable listings, restrict messaging, pause agent tools, suspend accounts, cancel access, or take other action where we believe these guidelines, our terms, or applicable law have been breached.",
            "We may take urgent action without prior notice where needed to protect users, prevent harm, secure the platform, comply with law, or reduce fraud and abuse.",
            "Repeated, serious, deceptive, unlawful, or harmful conduct may lead to permanent removal from Homzie.",
          ],
        },
        {
          title: "Contact",
          body: [
            "Questions about these guidelines or reports about platform abuse can be sent to support@homzie.co.za or submitted through the contact page.",
          ],
        },
      ]}
    />
  );
}
