import type { ReactNode } from "react";
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
import { tryLoadTiers, type Tier } from "@/lib/billing/tiers";
import { getVisitorCountry } from "@/lib/billing/visitor-country";
import { APP_NAME } from "@/lib/config/app";
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

export async function PremiumOffer({ guest, accountNotice }: { guest?: boolean; accountNotice?: ReactNode }) {
  const tierResult = tryLoadTiers();

  return (
    <PremiumPage
      guest={guest}
      tiers={"tiers" in tierResult ? tierResult.tiers : null}
      tiersError={"error" in tierResult ? tierResult.error : null}
      country={await getVisitorCountry()}
      accountNotice={accountNotice}
    />
  );
}

export default function PremiumPage({
  guest = false,
  tiers,
  tiersError,
  country,
  accountNotice,
}: {
  guest?: boolean;
  tiers: Tier[] | null;
  tiersError?: string | null;
  /** ISO country from the request edge. Undefined → Paddle IP detect. */
  country?: string;
  accountNotice?: ReactNode;
}) {
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
          signInLabel={sr.auth.signInForPlan}
          // Guests must sign in first so checkout can bind the Paddle customer
          // and authorize the transaction before the webhook grants the plan.
          requireAuth={guest}
        />
      )}

      {accountNotice}

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
              a: "Nakon plaćanja otvara se potvrda pretplate. Pristup se aktivira kada stigne Paddle webhook.",
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
