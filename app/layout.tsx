import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { WebVitals } from "@/components/analytics/WebVitals";
import { APP_SHORT_NAME } from "@/lib/config/app";
import icons from "@/lib/config/pwa-icons.json";
import { openGraphCard, twitterCard } from "@/lib/seo/social-card";
import {
  DEFAULT_DESCRIPTION,
  getSiteUrl,
  SITE_NAME,
} from "@/lib/seo/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const defaultTitle = "TreuPlate: kalkulator troška porcije za kuhinju";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: defaultTitle,
    template: "%s | TreuPlate",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    locale: "sr_RS",
    siteName: SITE_NAME,
    title: defaultTitle,
    description: DEFAULT_DESCRIPTION,
    images: [openGraphCard],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: DEFAULT_DESCRIPTION,
    images: [twitterCard],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_SHORT_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: icons.svg, type: "image/svg+xml" },
      { url: icons.png192, sizes: "192x192", type: "image/png" },
      { url: icons.png512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: icons.png192, sizes: "192x192", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0E",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Keep the root layout free of cookies()/headers() so public routes can stay
 * static or ISR (landing revalidate=300, /r/[token] revalidate=3600).
 * Middleware still mints a per-request CSP nonce and forwards it on the
 * request; Next applies that nonce to its own inline scripts/styles.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <WebVitals />
        {children}
      </body>
    </html>
  );
}
