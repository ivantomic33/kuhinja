import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OfflineSync } from "@/components/pwa/OfflineSync";
import { sr } from "@/lib/i18n/sr";
import { getSiteUrl } from "@/lib/seo/site";
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
    default: sr.app.name,
    template: "%s · Mise",
  },
  description: sr.marketing.metaDescription,
  applicationName: sr.app.name,
  openGraph: {
    type: "website",
    locale: "sr_Latn",
    siteName: sr.app.name,
    title: sr.marketing.metaTitle,
    description: sr.marketing.metaDescription,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: sr.marketing.metaTitle,
    description: sr.marketing.metaDescription,
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: sr.app.name,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
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
        {children}
      </body>
    </html>
  );
}
