import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Cookie Policy",
  "How Homzie uses cookies and similar technologies.",
);

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description="This policy explains how Homzie uses cookies, local storage, and similar technologies to keep the platform secure, useful, and personalized."
      sections={[
        {
          title: "What cookies do",
          body: [
            "Cookies and similar technologies help remember preferences, keep users signed in, secure sessions, understand usage, and improve the experience.",
          ],
        },
        {
          title: "Types we use",
          body: [
            "We may use essential cookies, preference cookies, analytics cookies, and security-related storage.",
            "Essential cookies are required for core functionality such as authentication, country preferences, currency preferences, and fraud prevention.",
          ],
        },
        {
          title: "Managing cookies",
          body: [
            "You can control cookies through your browser settings. Blocking some cookies may affect sign-in, preferences, messaging, or other platform features.",
          ],
        },
      ]}
    />
  );
}
