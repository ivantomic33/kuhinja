import type { Metadata } from "next";
import Link from "next/link";
import { PremiumOffer } from "@/components/billing/PremiumPage";
import { LogoMark } from "@/components/brand/LogoMark";
import { APP_NAME } from "@/lib/config/app";
import { sr } from "@/lib/i18n/sr";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = publicPageMetadata(
  "Paketi i cene za restorane",
  "Uporedite TreuPlate pakete za obračun troškova, recepte, zalihe i organizaciju smena. Izaberite mesečni ili godišnji plan koji odgovara vašoj kuhinji.",
  "/premium",
);

export default function PricingPage() {
  return (
    <>
      <header className="page-gutter mx-auto flex max-w-7xl items-center justify-between gap-3 py-4">
        <Link
          href="/"
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-text"
        >
          <LogoMark className="size-9" />
          {APP_NAME}
        </Link>
        <Link
          href="/login"
          prefetch={false}
          className="focus-ring inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-text-2 hover:underline"
        >
          {sr.auth.signIn}
        </Link>
      </header>
      <main className="page-gutter mx-auto max-w-7xl">
        <PremiumOffer guest />
      </main>
    </>
  );
}
