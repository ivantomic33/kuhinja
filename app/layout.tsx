import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "@/lib/config/app";
import icons from "@/lib/config/pwa-icons.json";
import { SITE_TITLE_TEMPLATE, socialMetadata } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/seo/site";
import manifest from "@/public/manifest.json";
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
    template: SITE_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  ...socialMetadata(APP_NAME, APP_DESCRIPTION, "/"),
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
  themeColor: manifest.theme_color,
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
    <html lang="sr" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  );
}
