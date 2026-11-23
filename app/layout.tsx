import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OfflineSync } from "@/components/pwa/OfflineSync";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "@/lib/config/app";
import icons from "@/lib/config/pwa-icons.json";
import { tokens } from "@/lib/design/tokens";
import { sr } from "@/lib/i18n/sr";
import { getSiteUrl } from "@/lib/seo/site";
import { openGraphCard, twitterCard } from "@/lib/seo/social-card";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
  weight: "variable",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: {
    type: "website",
    locale: "sr_Latn",
    siteName: APP_NAME,
    title: sr.marketing.metaTitle,
    description: APP_DESCRIPTION,
    url: "/",
    images: [openGraphCard],
  },
  twitter: {
    card: "summary_large_image",
    title: sr.marketing.metaTitle,
    description: APP_DESCRIPTION,
    images: [twitterCard],
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
  themeColor: tokens.bg,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr-Latn" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <OfflineSync />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
