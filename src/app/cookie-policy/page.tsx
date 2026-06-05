import { LegalPage, legalMetadata } from "@/modules/public-pages/legal-page";

export const metadata = legalMetadata(
  "Cookie Policy",
  "How Homzie uses cookies, local storage, and similar technologies.",
);

export default function CookiePolicyPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description="This policy explains how Homzie uses cookies, local storage, pixels, and similar technologies to keep the platform secure, useful, personalized, and reliable."
      sections={[
        {
          title: "What cookies and similar technologies are",
          body: [
            "Cookies are small text files placed on your device by a website. Local storage and similar browser technologies allow a website or application to store information in your browser or device.",
            "These technologies help Homzie remember information about your visit, keep features working, secure accounts, understand usage, and provide a smoother experience across pages and sessions.",
          ],
        },
        {
          title: "Why Homzie uses these technologies",
          body: [
            "We use cookies and similar technologies to keep you signed in, maintain secure sessions, remember your country, currency, language, and theme preferences, preserve interface choices, support saved items, and enable core platform functionality.",
            "We also use these technologies to understand how users interact with listings, reels, pages, search, filters, messages, and account flows so we can improve performance, usability, and reliability.",
            "Security-related cookies and storage may be used to detect suspicious activity, prevent abuse, reduce spam, protect authentication, support rate limiting, and keep the platform safe.",
          ],
        },
        {
          title: "Essential cookies and storage",
          body: [
            "Essential technologies are required for Homzie to work properly. They support sign-in, authentication, security, account settings, form submissions, payment flows, country and currency settings, and other core functions.",
            "If you block essential cookies or storage, parts of Homzie may not work. You may be unable to sign in, submit forms, manage listings, use messages, preserve preferences, or complete subscription and billing actions.",
          ],
        },
        {
          title: "Preference cookies and storage",
          body: [
            "Preference technologies help us remember choices such as theme, country, currency, layout preferences, recently used filters, and other settings that make Homzie feel consistent when you return.",
            "These preferences may be stored in cookies, local storage, or account-level settings depending on the feature and whether you are signed in.",
          ],
        },
        {
          title: "Analytics and performance technologies",
          body: [
            "We may use analytics and performance technologies to understand page views, feature usage, search behaviour, listing engagement, technical errors, device information, and general platform performance.",
            "Analytics helps us identify broken flows, improve search and listing discovery, understand which features are useful, and make better product decisions.",
            "Where possible, analytics information may be aggregated, de-identified, or limited so that we can understand trends without needing to identify individual users.",
          ],
        },
        {
          title: "Payments, security, and third-party tools",
          body: [
            "Payment providers, authentication providers, email providers, hosting providers, analytics providers, and security tools may place or use cookies and similar technologies when their services are embedded in or connected to Homzie.",
            "These third parties may use their technologies according to their own policies. For example, a payment provider may use cookies to detect fraud, process checkout, or remember payment session information.",
            "We do not control every cookie placed by third-party services, but we aim to use providers that support reliable, secure, and privacy-conscious platform operation.",
          ],
        },
        {
          title: "Managing cookies",
          body: [
            "Most browsers allow you to block, delete, or restrict cookies through browser settings. You can also clear local storage through your browser's privacy or developer tools.",
            "If you use browser controls to block cookies or storage, some Homzie features may be unavailable or may not remember your choices. You may need to sign in again or reselect preferences.",
            "Your browser settings usually apply per browser and per device, so you may need to repeat your choices if you use multiple browsers or devices.",
          ],
        },
        {
          title: "Changes to this policy",
          body: [
            "We may update this Cookie Policy when we change the technologies we use, add or remove providers, update features, or need to reflect legal or operational changes.",
            "When this policy changes, we will update the date shown on the page. Continued use of Homzie after changes means the updated policy applies.",
          ],
        },
        {
          title: "Contact us",
          body: [
            "Questions about cookies, local storage, or tracking technologies can be sent to support@homzie.co.za or submitted through the contact page.",
          ],
        },
      ]}
    />
  );
}
