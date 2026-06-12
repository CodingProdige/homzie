import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import Script from "next/script";
import { CountryPreferenceBootstrap } from "@/components/country-preference-bootstrap";
import { CurrencyProvider } from "@/modules/currency/currency-provider";
import { PushNotificationBootstrap } from "@/modules/push/components/push-notification-bootstrap";
import { PwaInstallBootstrap } from "@/modules/pwa/components/pwa-install";
import { getStoredSeoSettings } from "@/modules/seo/settings";
import { absoluteUrl, getSiteUrl } from "@/modules/site/url";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getStoredSeoSettings();
  const image = seo.defaultOgImageUrl || "/opengraph-image";

  return {
    applicationName: "Homzie",
    metadataBase: new URL(getSiteUrl()),
    title: "Homzie",
    description: seo.defaultDescription,
    appleWebApp: {
      capable: true,
      title: "Homzie",
    },
    openGraph: {
      description: seo.defaultDescription,
      images: [{ url: image }],
      siteName: seo.organizationName,
      title: seo.organizationName,
      type: "website",
      url: "/",
    },
    other: {
      ...(seo.bingVerification ? { "msvalidate.01": seo.bingVerification } : {}),
      ...(seo.googleSearchConsoleVerification
        ? { "google-site-verification": seo.googleSearchConsoleVerification }
        : {}),
    },
    robots: {
      follow: seo.allowIndexing,
      index: seo.allowIndexing,
    },
    twitter: {
      card: "summary_large_image",
      description: seo.defaultDescription,
      images: [image],
      title: seo.organizationName,
    },
    icons: {
      apple: "/favicon/apple-touch-icon.png",
      icon: [
        { url: "/favicon/favicon.ico", sizes: "32x32", type: "image/x-icon" },
        { url: "/favicon/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      ],
    },
  };
}

const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seoPromise = getStoredSeoSettings();
  const siteUrl = getSiteUrl();

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {googleAnalyticsId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
              `}
            </Script>
          </>
        ) : null}
        <CurrencyProvider>
          <CountryPreferenceBootstrap />
          <PushNotificationBootstrap />
          <PwaInstallBootstrap />
          <SiteStructuredData settingsPromise={seoPromise} siteUrl={siteUrl} />
          {children}
        </CurrencyProvider>
      </body>
    </html>
  );
}

async function SiteStructuredData({
  settingsPromise,
  siteUrl,
}: {
  settingsPromise: ReturnType<typeof getStoredSeoSettings>;
  siteUrl: string;
}) {
  const seo = await settingsPromise;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@id": `${siteUrl}#organization`,
        "@type": "Organization",
        address: seo.organizationAddress || undefined,
        email: seo.organizationEmail || undefined,
        logo: absoluteUrl("/logo/homzie-logo-dark-tight.png"),
        name: seo.organizationName,
        telephone: seo.organizationPhone || undefined,
        url: siteUrl,
      },
      {
        "@id": `${siteUrl}#website`,
        "@type": "WebSite",
        name: seo.organizationName,
        potentialAction: {
          "@type": "SearchAction",
          queryInput: "required name=search_term_string",
          target: `${absoluteUrl("/listings")}?area={search_term_string}`,
        },
        publisher: {
          "@id": `${siteUrl}#organization`,
        },
        url: siteUrl,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
