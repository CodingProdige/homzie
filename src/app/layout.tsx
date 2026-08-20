import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import Script from "next/script";
import { CountryPreferenceBootstrap } from "@/components/country-preference-bootstrap";
import { GoogleAnalyticsPageView } from "@/components/google-analytics-page-view";
import { MetaPixelPageView } from "@/components/meta-pixel-page-view";
import { authOptions } from "@/modules/auth/config";
import { CurrencyProvider } from "@/modules/currency/currency-provider";
import { BrowserNotificationPrompt } from "@/modules/push/components/browser-notification-prompt";
import { PushNotificationBootstrap } from "@/modules/push/components/push-notification-bootstrap";
import { PwaInstallBootstrap } from "@/modules/pwa/components/pwa-install";
import { PlatformVisitorHeartbeat } from "@/modules/platform-stats/components/platform-visitor-heartbeat";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

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

const googleAnalyticsId =
  process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || "G-R76VMT2VVG";
const googleAdsId =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-18217057293";
const googleTagId = googleAnalyticsId || googleAdsId;
const rawMetaPixelId =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "1090379437274334";
const metaPixelId = /^\d+$/.test(rawMetaPixelId) ? rawMetaPixelId : null;
const themeCookieName = "homzie-theme";
const validThemeModes = new Set(["light", "dark"]);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const seoPromise = getStoredSeoSettings();
  const sessionPromise = getServerSession(authOptions);
  const siteUrl = getSiteUrl();
  const cookieStore = await cookies();
  const session = await sessionPromise;
  const themeCookie = cookieStore.get(themeCookieName)?.value;
  const themeMode = themeCookie && validThemeModes.has(themeCookie) ? themeCookie : "light";
  const serverUsesDark = themeMode === "dark";

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased${serverUsesDark ? " dark" : ""}`}
      style={{ colorScheme: serverUsesDark ? "dark" : "light" }}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {googleTagId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleTagId}`}
              strategy="afterInteractive"
            />
            <Script id="google-tag" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                ${
                  googleAnalyticsId
                    ? `gtag('config', '${googleAnalyticsId}', { send_page_view: false });`
                    : ""
                }
                ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ""}
              `}
            </Script>
            {googleAnalyticsId ? (
              <Suspense fallback={null}>
                <GoogleAnalyticsPageView measurementId={googleAnalyticsId} />
              </Suspense>
            ) : null}
          </>
        ) : null}
        {metaPixelId ? (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${metaPixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* Meta requires this literal 1×1 fallback when JavaScript is disabled. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt=""
                height="1"
                src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                width="1"
              />
            </noscript>
            <Suspense fallback={null}>
              <MetaPixelPageView pixelId={metaPixelId} />
            </Suspense>
          </>
        ) : null}
        <CurrencyProvider>
          <CountryPreferenceBootstrap />
          <PlatformVisitorHeartbeat />
          <PushNotificationBootstrap enabled={Boolean(session?.user?.id)} />
          <PwaInstallBootstrap />
          <BrowserNotificationPrompt enabled={Boolean(session?.user?.id)} />
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
