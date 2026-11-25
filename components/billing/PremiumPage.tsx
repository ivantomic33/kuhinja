"use client";

import Link from "next/link";
import {
  BarChart3,
  CreditCard,
  History,
  RotateCcw,
  Timer,
  Users,
} from "lucide-react";
import { PricingTiers } from "@/components/billing/PricingTiers";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import type { Tier } from "@/lib/billing/tiers";
import { APP_NAME } from "@/lib/config/app";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";

const FEATURE_STRIP = [
  {
    icon: BarChart3,
    title: "Food cost variance",
    body: "Vidite koji recepti i smene odlaze iznad cilja — pre nego što smena krene.",
  },
  {
    icon: History,
    title: "Istorija cena",
    body: "Sparkline po sastojku: kad meso ili ulje poskupe, food cost se ažurira odmah.",
  },
  {
    icon: Timer,
    title: "Tajmeri za pripremu",
    body: "Više tajmera odjednom — luk, meso i lepinje bez gubljenja vremena.",
  },
] as const;

export default function PremiumPage({
  guest = false,
  tiers,
  tiersError,
  country,
}: {
  guest?: boolean;
  tiers: Tier[] | null;
  tiersError?: string | null;
  /** ISO country from the request edge. Undefined → Paddle IP detect. */
  country?: string;
}) {
  const { isFree, isLoading } = usePlan(!guest);

  return (
    <div className="flex min-w-0 flex-col gap-10 pb-8">
      <header className="prem-hero mx-auto mt-2 max-w-[820px] text-center">
        <p className="app-eyebrow">{APP_NAME} Premium</p>
        <h1>Više prostora za vaš posao</h1>
        <p className="mt-3 text-ui-base text-text-2">
          Starter, Pro i Advanced — lokalizovane cene, mesečno ili godišnje.
          Naplata preko Paddle Checkout-a.
        </p>
      </header>

      {tiersError || !tiers ? (
        <p role="alert" className="mx-auto max-w-xl text-center text-sm text-danger">
          {tiersError ??
            "Cenovnik nije konfigurisan. Proverite Paddle price ID promenljive u okruženju."}
        </p>
      ) : (
        <PricingTiers
          tiers={tiers}
          country={country}
          guest={guest}
          // Guests must sign in first so checkout can bind the Paddle customer
          // and authorize the transaction before the webhook grants the plan.
          requireAuth={guest}
        />
      )}

      {!guest && !isLoading && !isFree ? (
        <p className="mx-auto text-center text-ui-sm text-text-2">
          Već imate plaćeni plan.{" "}
          <Link href="/premium/upravljanje" className="font-semibold text-accent underline">
            {sr.settings.manageBilling}
          </Link>
        </p>
      ) : null}

      <div className="trust mx-auto flex max-w-[960px] flex-wrap items-center justify-center gap-7 text-ui-sm text-text-2">
        <span className="inline-flex items-center gap-2">
          <CreditCard className="size-4" aria-hidden="true" />
          Sigurna naplata karticom (Paddle)
        </span>
        <span className="inline-flex items-center gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          Otkažite kad hoćete
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="size-4" aria-hidden="true" />
          Cene po zemlji posetioca
        </span>
      </div>

      <section className="mx-auto grid w-full max-w-[1200px] gap-5 sm:grid-cols-3 max-[900px]:grid-cols-1">
        {FEATURE_STRIP.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)]"
          >
            <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-accent">
              <item.icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-ui-md font-semibold text-text">{item.title}</h2>
            <p className="mt-1 text-ui-sm text-text-2">{item.body}</p>
          </article>
        ))}
      </section>

      <div className="mx-auto w-full max-w-[760px]">
        <FaqAccordion
          title="Česta pitanja"
          items={[
            {
              q: "Kako se prikazuju cene?",
              a: "Cene dolaze direktno iz Paddle Price Preview API-ja za vašu zemlju. Aplikacija ne računa ni zaokružuje iznose.",
            },
            {
              q: "Mogu li otkazati pretplatu?",
              a: "Da, u bilo kom trenutku iz Podešavanja. Plan ostaje aktivan do kraja plaćenog perioda.",
            },
            {
              q: "Šta posle uspešne naplate?",
              a: "Paddle vas vraća na /welcome. Pretplata se aktivira preko webhook-a.",
            },
            {
              q: "Radi li offline?",
              a: "Keširani recepti su dostupni i bez interneta. Izmene se sinhronizuju kada se veza vrati.",
            },
          ]}
        />
      </div>
    </div>
  );
}
