import type { Metadata } from "next";
import Link from "next/link";
import PremiumPage from "@/components/billing/PremiumPage";
import { LogoMark } from "@/components/brand/LogoMark";
import { tryLoadTiers } from "@/lib/billing/tiers";
import { getVisitorCountry } from "@/lib/billing/visitor-country";
import { APP_NAME } from "@/lib/config/app";
import { sr } from "@/lib/i18n/sr";
import { AppQueryProvider } from "@/lib/query/provider";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { getServerUser } from "@/lib/supabase/server";

export const metadata: Metadata = publicPageMetadata(
  "Paketi i cene za restorane",
  "Uporedite TreuPlate pakete za obračun troškova, recepte, zalihe i organizaciju smena. Pogledajte mesečne i godišnje opcije.",
  "/premium",
);

export default async function PricingPage() {
  const [user, country, tierResult] = await Promise.all([
    getServerUser(),
    getVisitorCountry(),
    Promise.resolve(tryLoadTiers()),
  ]);

  const tiers = "tiers" in tierResult ? tierResult.tiers : null;
  const tiersError = "error" in tierResult ? tierResult.error : null;

  if (user) {
    return <PremiumPage tiers={tiers} tiersError={tiersError} country={country} />;
  }

  return (
    <AppQueryProvider>
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
          className="focus-ring inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-text-2 hover:underline"
        >
          {sr.auth.signIn}
        </Link>
      </header>
      <main className="page-gutter mx-auto max-w-7xl">
        <PremiumPage
          guest
          tiers={tiers}
          tiersError={tiersError}
          country={country}
        />
      </main>
    </AppQueryProvider>
  );
}
