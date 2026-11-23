import Link from "next/link";
import AppLayout from "@/app/(app)/layout";
import PremiumPage from "@/components/billing/PremiumPage";
import { LogoMark } from "@/components/brand/LogoMark";
import { APP_NAME } from "@/lib/config/app";
import { sr } from "@/lib/i18n/sr";
import { AppQueryProvider } from "@/lib/query/provider";
import { getServerUser } from "@/lib/supabase/server";

export default async function PricingPage() {
  if (await getServerUser()) return <AppLayout><PremiumPage /></AppLayout>;

  return (
    <AppQueryProvider>
      <header className="page-gutter mx-auto flex max-w-7xl items-center justify-between gap-3 py-4">
        <Link href="/" className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md font-semibold text-text">
          <LogoMark className="size-9" />
          {APP_NAME}
        </Link>
        <Link href="/login" className="focus-ring inline-flex min-h-11 items-center rounded-md px-2 font-semibold text-text-2 hover:underline">
          {sr.auth.signIn}
        </Link>
      </header>
      <main className="page-gutter mx-auto max-w-7xl">
        <PremiumPage guest />
      </main>
    </AppQueryProvider>
  );
}
