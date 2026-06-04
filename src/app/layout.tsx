import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { CountryPreferenceBootstrap } from "@/components/country-preference-bootstrap";
import { CurrencyProvider } from "@/modules/currency/currency-provider";
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

export const metadata: Metadata = {
  title: "Homzie",
  description: "Find it. Love it. Live it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CurrencyProvider>
          <CountryPreferenceBootstrap />
          {children}
        </CurrencyProvider>
      </body>
    </html>
  );
}
