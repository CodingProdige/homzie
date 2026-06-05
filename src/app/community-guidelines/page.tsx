import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Community Guidelines",
  "The standards for participating on Homzie.",
);

export default function CommunityGuidelinesPage() {
  return (
    <LegalPage
      title="Community Guidelines"
      description="These guidelines help keep Homzie useful, trusted, and respectful for buyers, sellers, agents, and property teams."
      sections={[
        {
          title: "Be accurate",
          body: [
            "Listings, media, reels, prices, availability, areas, features, and agent information should be truthful and kept up to date.",
          ],
        },
        {
          title: "Be respectful",
          body: [
            "Do not harass, threaten, discriminate, impersonate others, spam users, or abuse messaging and enquiry tools.",
          ],
        },
        {
          title: "Protect trust",
          body: [
            "Do not upload misleading content, fake listings, unauthorised property media, deceptive claims, or content that infringes someone else's rights.",
          ],
        },
        {
          title: "Enforcement",
          body: [
            "Homzie may remove content, limit features, suspend accounts, or take other steps where conduct harms users, agents, or the platform.",
          ],
        },
      ]}
    />
  );
}
