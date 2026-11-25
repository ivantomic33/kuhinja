import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { APP_NAME } from "@/lib/config/app";
import { getServerUser } from "@/lib/supabase/server";

export const metadata = {
  title: "Dobrodošli",
  robots: { index: false, follow: false },
};

export default async function WelcomePage() {
  const user = await getServerUser();

  return (
    <main className="page-gutter mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center gap-6 py-16 text-center">
      <LogoMark className="size-14" />
      <div className="flex flex-col gap-2">
        <p className="app-eyebrow">{APP_NAME}</p>
        <h1 className="text-ui-3xl font-bold tracking-tight text-text">
          Hvala na pretplati
        </h1>
        <p className="text-ui-base text-text-2">
          Plaćanje je primljeno. Aktivacija plana može potrajati nekoliko
          sekundi dok Paddle potvrdi pretplatu.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        {user ? (
          <Link href="/dashboard" className="w-full sm:w-auto">
            <PrimaryButton fullWidth className="min-h-[46px]">
              Idi na kontrolnu tablu
            </PrimaryButton>
          </Link>
        ) : (
          <Link href="/login" className="w-full sm:w-auto">
            <PrimaryButton fullWidth className="min-h-[46px]">
              Prijavi se
            </PrimaryButton>
          </Link>
        )}
        <Link href="/premium" className="w-full sm:w-auto">
          <PrimaryButton fullWidth variant="secondary" className="min-h-[46px]">
            Nazad na pakete
          </PrimaryButton>
        </Link>
      </div>
    </main>
  );
}
