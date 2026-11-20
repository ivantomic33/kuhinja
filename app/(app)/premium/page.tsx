"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  CreditCard,
  History,
  Minus,
  RotateCcw,
  Timer,
  Users,
} from "lucide-react";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { WaitlistButton } from "@/components/billing/WaitlistButton";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePlan } from "@/lib/hooks/usePlan";
import {
  FREE_MAX_RECIPES,
  PLAN_PRICES,
  PLAN_YEARLY_NOTES,
  type BillingPeriod,
  type PlanId,
} from "@/lib/plan/entitlements";
import { sr } from "@/lib/i18n/sr";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

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

type Cell = string | boolean;

type CompareGroup = {
  title: string;
  rows: Array<{
    label: string;
    free: Cell;
    starter: Cell;
    pro: Cell;
    team: Cell;
    business: Cell;
  }>;
};

const ALL_PLANS = { free: true, starter: true, pro: true, team: true, business: true };
const STARTER_PLUS = { ...ALL_PLANS, free: false };
const PRO_PLUS = { ...STARTER_PLUS, starter: false };

const COMPARE_GROUPS: CompareGroup[] = [
  {
    title: "Limiti",
    rows: [
      {
        label: "Recepti",
        free: String(FREE_MAX_RECIPES),
        starter: "Bez limita",
        pro: "Bez limita",
        team: "Bez limita",
        business: "Bez limita",
      },
      {
        label: "Sastojci",
        free: "20",
        starter: "Bez limita",
        pro: "Bez limita",
        team: "Bez limita",
        business: "Bez limita",
      },
      {
        label: "Lokacije",
        free: "1",
        starter: "1",
        pro: "1",
        team: "Više",
        business: "Više",
      },
      {
        label: "Korisnici",
        free: "1",
        starter: "1",
        pro: "1",
        team: "Više + uloge",
        business: "Više + uloge",
      },
    ],
  },
  {
    title: "Trebovanje",
    rows: [
      {
        label: "Stavke na stanju",
        free: "10",
        starter: "40",
        pro: "Bez limita",
        team: "Bez limita",
        business: "Bez limita",
      },
      {
        label: "Praćenje stanja i unos prodaje",
        free: true,
        starter: true,
        pro: true,
        team: true,
        business: true,
      },
      { label: "Upozorenje kada zaliha nestane", ...ALL_PLANS },
      { label: "Upozorenje ispod minimuma i procena preostalih smena", ...STARTER_PLUS },
      { label: "Zvonce i obaveštenja o zalihama u aplikaciji", ...PRO_PLUS },
      {
        label: "Dopuna sa nabavnom cenom",
        free: false,
        starter: true,
        pro: true,
        team: true,
        business: true,
      },
      {
        label: "Otpis / kalo",
        free: false,
        starter: true,
        pro: true,
        team: true,
        business: true,
      },
      {
        label: "Inventura (usklađivanje)",
        free: false,
        starter: false,
        pro: true,
        team: true,
        business: true,
      },
      {
        label: "Audit pokreta (ko je uneo)",
        free: false,
        starter: false,
        pro: false,
        team: true,
        business: true,
      },
    ],
  },
  {
    title: "Raspored smena",
    rows: [
      { label: "Nedeljni raspored i zbir sati po zaposlenom", ...STARTER_PLUS },
      {
        label: "Broj zaposlenih u rasporedu",
        free: false,
        starter: "Bez limita",
        pro: "Bez limita",
        team: "Bez limita",
        business: "Bez limita",
      },
      { label: "Pregled drugih nedelja i kopiranje rasporeda", ...STARTER_PLUS },
      { label: "Deljenje rasporeda i štampa / PDF", ...STARTER_PLUS },
    ],
  },
  {
    title: "Priprema",
    rows: [
      {
        label: "Šabloni smene",
        free: "1",
        starter: "Više",
        pro: "Bez limita",
        team: "Bez limita",
        business: "Bez limita",
      },
      {
        label: "Istovremeni tajmeri",
        free: "2",
        starter: "2",
        pro: "Više",
        team: "Više",
        business: "Više",
      },
      {
        label: "PDF lista pripreme",
        free: false,
        starter: true,
        pro: true,
        team: true,
        business: true,
      },
    ],
  },
  {
    title: "Troškovi i izveštaji",
    rows: [
      {
        label: "Food cost kalkulator",
        free: true,
        starter: true,
        pro: true,
        team: true,
        business: true,
      },
      { label: "Oznaka i upozorenje za food cost iznad cilja", ...ALL_PLANS },
      { label: "Sastojak sa najvećim troškom i predlog cene", ...PRO_PLUS },
      { label: "Food cost posle prodaje", ...STARTER_PLUS },
      { label: "Jela koja najviše doprinose trošku", ...PRO_PLUS },
      {
        label: "Istorija cena",
        free: false,
        starter: false,
        pro: true,
        team: true,
        business: true,
      },
      {
        label: "Food cost variance / skaliranje",
        free: false,
        starter: false,
        pro: true,
        team: true,
        business: true,
      },
      {
        label: "Osnovni izveštaji",
        free: false,
        starter: false,
        pro: true,
        team: true,
        business: true,
      },
      {
        label: "PDF / Excel izveštaji",
        free: false,
        starter: false,
        pro: false,
        team: false,
        business: true,
      },
    ],
  },
  {
    title: "Tim",
    rows: [
      {
        label: "Uloge (šef / menadžer)",
        free: false,
        starter: false,
        pro: false,
        team: true,
        business: true,
      },
      {
        label: "Deljena knjiga cena",
        free: false,
        starter: false,
        pro: false,
        team: true,
        business: true,
      },
      {
        label: "Offline keširani recepti",
        free: true,
        starter: true,
        pro: true,
        team: true,
        business: true,
      },
    ],
  },
];

function PlanCell({ value, highlight }: { value: Cell; highlight?: boolean }) {
  if (typeof value === "string") {
    return (
      <span className={cn(highlight && "font-medium text-text")}>{value}</span>
    );
  }
  if (value) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check
          className={cn("size-4", highlight ? "text-accent" : "text-success")}
          aria-label="Da"
        />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center">
      <Minus className="size-4 text-[var(--text-3)]" aria-label="Ne" />
    </span>
  );
}

function CheckItem({
  children,
  featured = false,
}: {
  children: string;
  featured?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5 text-[length:var(--fs-sm)] text-text">
      <span
        className={cn(
          "ck mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full",
          featured
            ? "bg-[var(--accent-soft)] text-accent"
            : "bg-surface-3 text-[var(--text-2)]"
        )}
      >
        <Check className="size-3.5" aria-hidden="true" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function priceBlock(
  amount: number,
  period: BillingPeriod,
  opts?: { bare?: boolean }
) {
  const suffix = opts?.bare ? null : period === "yearly" ? "/ god" : "/ mes";
  return (
    <p className="flex flex-wrap items-baseline gap-2">
      <span className="text-[34px] font-bold leading-none tracking-[-0.03em] tabular-nums text-text">
        {formatMoney(amount)} din
      </span>
      {suffix ? (
        <span className="text-[length:var(--fs-base)] text-[var(--text-2)]">
          {suffix}
        </span>
      ) : null}
    </p>
  );
}

export default function PremiumPage() {
  const {
    plan,
    isFree,
    isLoading,
    isPremium,
    accountName,
    email,
  } = usePlan();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const yearly = period === "yearly";
  const interval = yearly ? "year" : "month";

  const accountLabel = useMemo(() => {
    const raw = (accountName || email || "").trim();
    if (!raw) return "nalog";
    if (raw.includes("@")) return raw.split("@")[0] || raw;
    return raw.split(/\s+/)[0] || raw;
  }, [accountName, email]);

  function isCurrent(id: PlanId): boolean {
    return plan === id;
  }

  function manageOrCurrent(id: PlanId) {
    if (isCurrent(id)) {
      return (
        <PrimaryButton fullWidth variant="secondary" disabled className="min-h-[46px]">
          Trenutni plan
        </PrimaryButton>
      );
    }
    if (isPremium && (id === "pro" || id === "team" || id === "business")) {
      return (
        <Link
          href="/settings/billing"
          className="flex min-h-[46px] items-center justify-center rounded-xl border border-border-strong bg-surface-2 px-4 text-[length:var(--fs-base)] font-semibold text-text no-underline hover:bg-surface-3"
        >
          {sr.settings.manageBilling}
        </Link>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-10 pb-8">
      {/* 1. Hero */}
      <header className="prem-hero mx-auto mt-2 max-w-[820px] text-center">
        <p className="mise-eyebrow">Mise Premium</p>
        <h1 className="text-[length:var(--fs-3xl)] font-semibold leading-[1.15] tracking-[-0.02em] text-text max-[900px]:text-[length:var(--fs-2xl)]">
          Više prostora za vaš posao
        </h1>
        <p className="mt-3 text-[length:var(--fs-base)] text-[var(--text-2)]">
          Počnite besplatno. Nadogradite kada kuhinji zatreba više recepata,
          stanja, lokala ili izveštaja.
        </p>
      </header>

      {/* 2. Billing toggle */}
      <div className="billing mx-auto flex justify-center">
        <SegmentedControl<BillingPeriod>
          ariaLabel="Period naplate"
          value={period}
          onChange={setPeriod}
          size="lg"
          className="seg big"
          options={[
            { value: "monthly", label: "Mesečno" },
            {
              value: "yearly",
              label: "Godišnje",
              badge: "2 meseca gratis",
            },
          ]}
        />
      </div>

      {/* 3. Five plan cards */}
      <section
        aria-label="Planovi"
        className="plans mx-auto grid w-full max-w-[1200px] gap-3.5 max-[1100px]:grid-flow-col max-[1100px]:auto-cols-[minmax(260px,1fr)] max-[1100px]:overflow-x-auto max-[1100px]:pb-2 min-[1101px]:grid-cols-[0.82fr_1fr_1.12fr_1fr_1fr]"
      >
        {/* Free */}
        <article
          className={cn(
            "card plan quiet relative flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-surface px-[18px] py-[22px] shadow-[var(--shadow)]"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[length:var(--fs-lg)] font-semibold text-text">
              Free
            </h3>
            {!isLoading && isFree ? (
              <Badge variant="success">
                <Check className="size-3.5" aria-hidden="true" />
                Aktivan
              </Badge>
            ) : null}
          </div>
          <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
            Osnove za jedan lokal.
          </p>
          <div>
            {priceBlock(0, period, { bare: true })}
            <p className="mt-2 text-[length:var(--fs-sm)] text-[var(--text-2)]">
              Zauvek besplatno · nalog {accountLabel}
            </p>
          </div>
          <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
            <CheckItem>{`${FREE_MAX_RECIPES} recepata · 20 sastojaka`}</CheckItem>
            <CheckItem>Trebovanje · 10 stavki na stanju</CheckItem>
            <CheckItem>Food cost kalkulator</CheckItem>
            <CheckItem>Food cost iznad cilja i upozorenje kad zaliha nestane</CheckItem>
            <CheckItem>1 šablon smene</CheckItem>
            <CheckItem>Keširani recepti offline</CheckItem>
          </ul>
          <div className="mt-auto pt-2">
            {isLoading ? (
              <PrimaryButton fullWidth loading disabled className="min-h-[46px]">
                Učitavanje
              </PrimaryButton>
            ) : (
              <PrimaryButton
                fullWidth
                variant="secondary"
                disabled
                className="min-h-[46px]"
              >
                {isFree ? "Trenutni plan" : "Uključeno"}
              </PrimaryButton>
            )}
          </div>
        </article>

        {/* Starter */}
        <article className="card plan relative flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-surface px-[18px] py-[22px] shadow-[var(--shadow)]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[length:var(--fs-lg)] font-semibold text-text">
              Starter
            </h3>
            {isCurrent("starter") ? (
              <Badge variant="success">
                <Check className="size-3.5" aria-hidden="true" />
                Aktivan
              </Badge>
            ) : null}
          </div>
          <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
            Bez limita na recepte i sastojke.
          </p>
          <div>
            {priceBlock(
              yearly ? PLAN_PRICES.starter.yearly : PLAN_PRICES.starter.monthly,
              period
            )}
            <p
              className={cn(
                "mt-2 text-[length:var(--fs-sm)]",
                yearly ? "text-success" : "text-[var(--text-2)]"
              )}
            >
              {yearly
                ? PLAN_YEARLY_NOTES.starter
                : "Naplata mesečno. Otkažite kad želite."}
            </p>
          </div>
          <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
            <CheckItem>Neograničeni recepti i sastojci</CheckItem>
            <CheckItem>Trebovanje · 40 stavki · otpis / dopuna</CheckItem>
            <CheckItem>Raspored smena · neograničeno zaposlenih</CheckItem>
            <CheckItem>Food cost posle prodaje</CheckItem>
            <CheckItem>Upozorenja ispod minimuma i procena preostalih smena</CheckItem>
            <CheckItem>Više šablona smene</CheckItem>
            <CheckItem>1 lokacija</CheckItem>
            <CheckItem>PDF izvoz liste pripreme</CheckItem>
          </ul>
          <div className="mt-auto pt-2">
            {manageOrCurrent("starter") ??
              (isLoading ? (
                <PrimaryButton fullWidth loading disabled className="min-h-[46px]">
                  Učitavanje
                </PrimaryButton>
              ) : (
                <CheckoutButton
                  interval={interval}
                  planTarget="starter"
                  variant="secondary"
                >
                  Izaberi Starter
                </CheckoutButton>
              ))}
          </div>
        </article>

        {/* Pro — featured */}
        <article
          className={cn(
            "card plan featured relative flex min-h-0 flex-col gap-4 rounded-2xl border px-[18px] py-[22px]",
            "border-[var(--accent-line)] shadow-[var(--glow-pro)]"
          )}
          style={{
            background:
              "linear-gradient(180deg, rgba(255,107,53,.1), var(--surface) 42%)",
          }}
        >
          <span className="pop absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--accent-ink)] shadow-sm">
            Najpopularnije
          </span>
          <div className="flex items-start justify-between gap-2 pt-1">
            <h3 className="text-[length:var(--fs-lg)] font-semibold text-text">
              Pro
            </h3>
            {isCurrent("pro") || isCurrent("team") || isCurrent("business") ? (
              <Badge variant="success">
                <Check className="size-3.5" aria-hidden="true" />
                Aktivan
              </Badge>
            ) : (
              <Badge variant="accent">14 dana trial</Badge>
            )}
          </div>
          <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
            Kontrola cene i food cost variance.
          </p>
          <div>
            {priceBlock(
              yearly ? PLAN_PRICES.pro.yearly : PLAN_PRICES.pro.monthly,
              period
            )}
            <p
              className={cn(
                "mt-2 text-[length:var(--fs-sm)]",
                yearly ? "text-success" : "text-[var(--text-2)]"
              )}
            >
              {yearly
                ? PLAN_YEARLY_NOTES.pro
                : "Naplata mesečno. Otkažite kad želite."}
            </p>
          </div>
          <p className="includes text-[length:var(--fs-sm)] font-semibold text-accent">
            Uključuje Starter
          </p>
          <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
            <CheckItem featured>Istorija cena sastojaka</CheckItem>
            <CheckItem featured>Trebovanje bez limita · inventura</CheckItem>
            <CheckItem featured>Neograničeni šabloni smene</CheckItem>
            <CheckItem featured>Više tajmera odjednom</CheckItem>
            <CheckItem featured>Food cost variance i skaliranje</CheckItem>
            <CheckItem featured>Sastojak sa najvećim troškom i predlog cene</CheckItem>
            <CheckItem featured>Jela koja najviše doprinose trošku</CheckItem>
            <CheckItem featured>Zvonce i obaveštenja o zalihama u aplikaciji</CheckItem>
            <CheckItem featured>Osnovni izveštaji</CheckItem>
          </ul>
          <div className="mt-auto pt-2">
            {isLoading ? (
              <PrimaryButton fullWidth loading disabled className="min-h-[46px]">
                Učitavanje
              </PrimaryButton>
            ) : isCurrent("pro") ||
              isCurrent("team") ||
              isCurrent("business") ? (
              <Link
                href="/settings/billing"
                className="flex min-h-[46px] items-center justify-center rounded-xl border border-border-strong bg-surface-2 px-4 text-[length:var(--fs-base)] font-semibold text-text no-underline hover:bg-surface-3"
              >
                {sr.settings.manageBilling}
              </Link>
            ) : (
              <CheckoutButton interval={interval} planTarget="pro">
                Probaj 14 dana besplatno
              </CheckoutButton>
            )}
          </div>
        </article>

        {/* Team */}
        <article className="card plan relative flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-surface px-[18px] py-[22px] shadow-[var(--shadow)]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[length:var(--fs-lg)] font-semibold text-text">
              Team
            </h3>
            <Badge variant="warning">Uskoro</Badge>
          </div>
          <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
            Više ljudi i više lokala.
          </p>
          <div>
            {priceBlock(
              yearly ? PLAN_PRICES.team.yearly : PLAN_PRICES.team.monthly,
              period
            )}
            <p
              className={cn(
                "mt-2 text-[length:var(--fs-sm)]",
                yearly ? "text-success" : "text-[var(--text-2)]"
              )}
            >
              {yearly
                ? PLAN_YEARLY_NOTES.team
                : "Naplata mesečno. Otkažite kad želite."}
            </p>
          </div>
          <p className="includes text-[length:var(--fs-sm)] font-semibold text-accent">
            Uključuje Pro
          </p>
          <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
            <CheckItem>Više korisnika i lokacija</CheckItem>
            <CheckItem>Uloge: šef / menadžer</CheckItem>
            <CheckItem>Trebovanje · audit ko je uneo pokret</CheckItem>
            <CheckItem>Deljena knjiga cena sastojaka</CheckItem>
            <CheckItem>Zajednički šabloni smene</CheckItem>
          </ul>
          <div className="mt-auto flex flex-col gap-2 pt-2">
            <WaitlistButton planLabel="Team" />
            <p className="soon-tag text-center text-[length:var(--fs-xs)] text-[var(--text-3)]">
              Uskoro · nije dostupno za kupovinu
            </p>
          </div>
        </article>

        {/* Business */}
        <article className="card plan relative flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-surface px-[18px] py-[22px] shadow-[var(--shadow)]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[length:var(--fs-lg)] font-semibold text-text">
              Business
            </h3>
            <Badge variant="neutral">Uskoro</Badge>
          </div>
          <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
            Izveštaji i napredni izvoz.
          </p>
          <div>
            {priceBlock(
              yearly
                ? PLAN_PRICES.business.yearly
                : PLAN_PRICES.business.monthly,
              period
            )}
            <p
              className={cn(
                "mt-2 text-[length:var(--fs-sm)]",
                yearly ? "text-success" : "text-[var(--text-2)]"
              )}
            >
              {yearly
                ? PLAN_YEARLY_NOTES.business
                : "Naplata mesečno. Otkažite kad želite."}
            </p>
          </div>
          <p className="includes text-[length:var(--fs-sm)] font-semibold text-accent">
            Uključuje Team
          </p>
          <ul className="flex flex-col gap-2.5 border-t border-border pt-4">
            <CheckItem>PDF i Excel izveštaji</CheckItem>
            <CheckItem>Napredni izvoz podataka</CheckItem>
            <CheckItem>Prioritetna podrška</CheckItem>
            <CheckItem>Kasnije: API i integracije</CheckItem>
          </ul>
          <div className="mt-auto flex flex-col gap-2 pt-2">
            <PrimaryButton fullWidth disabled className="min-h-[46px]">
              Uskoro
            </PrimaryButton>
            <p className="text-center text-[length:var(--fs-xs)] text-[var(--text-3)]">
              Nije dostupno za kupovinu
            </p>
          </div>
        </article>
      </section>

      {/* 4. Trust row */}
      <div className="trust mx-auto flex max-w-[960px] flex-wrap items-center justify-center gap-7 text-[length:var(--fs-sm)] text-[var(--text-2)]">
        <span className="inline-flex items-center gap-2">
          <CreditCard className="size-4" aria-hidden="true" />
          Sigurna naplata karticom
        </span>
        <span className="inline-flex items-center gap-2">
          <RotateCcw className="size-4" aria-hidden="true" />
          Otkažite kad hoćete
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="size-4" aria-hidden="true" />
          Team i Business: waitlist · uskoro
        </span>
      </div>

      {/* 5. Feature strip */}
      <section className="mx-auto grid w-full max-w-[1200px] gap-5 sm:grid-cols-3 max-[900px]:grid-cols-1">
        {FEATURE_STRIP.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)]"
          >
            <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-accent">
              <item.icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-[length:var(--fs-md)] font-semibold text-text">
              {item.title}
            </h2>
            <p className="mt-1 text-[length:var(--fs-sm)] text-[var(--text-2)]">
              {item.body}
            </p>
          </article>
        ))}
      </section>

      {/* 6. Compare table */}
      <section className="mx-auto w-full max-w-[1200px]">
        <h2 className="mb-5 text-center text-[length:var(--fs-xl)] font-semibold text-text">
          Uporedite planove
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow)]">
          <table className="w-full min-w-[720px] text-left text-[length:var(--fs-sm)]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-4 font-medium text-[var(--text-2)] sm:px-6">
                  Funkcija
                </th>
                <th className="w-[14%] px-2 py-4 text-center font-medium text-text sm:px-3">
                  Free
                </th>
                <th className="w-[14%] px-2 py-4 text-center font-medium text-text sm:px-3">
                  Starter
                </th>
                <th className="prem-col w-[16%] bg-[var(--accent-soft)]/40 px-2 py-4 text-center font-semibold text-accent sm:px-3">
                  Pro
                </th>
                <th className="w-[14%] px-2 py-4 text-center font-medium text-text sm:px-3">
                  Team
                </th>
                <th className="w-[14%] px-2 py-4 text-center font-medium text-text sm:px-3">
                  Business
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_GROUPS.map((group) => (
                <Fragment key={group.title}>
                  <tr className="border-b border-border">
                    <th
                      colSpan={6}
                      className="bg-surface-2/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-3)] sm:px-6"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={`${group.title}-${row.label}`}
                      className="border-b border-border last:border-0"
                    >
                      <th
                        scope="row"
                        className="px-4 py-3.5 font-normal text-text sm:px-6"
                      >
                        {row.label}
                      </th>
                      <td className="px-2 py-3.5 text-center text-[var(--text-2)] sm:px-3">
                        <PlanCell value={row.free} />
                      </td>
                      <td className="px-2 py-3.5 text-center text-[var(--text-2)] sm:px-3">
                        <PlanCell value={row.starter} />
                      </td>
                      <td className="prem bg-[var(--accent-soft)]/25 px-2 py-3.5 text-center sm:px-3">
                        <PlanCell value={row.pro} highlight />
                      </td>
                      <td className="px-2 py-3.5 text-center text-[var(--text-2)] sm:px-3">
                        <PlanCell value={row.team} />
                      </td>
                      <td className="px-2 py-3.5 text-center text-[var(--text-2)] sm:px-3">
                        <PlanCell value={row.business} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {/* 7. Note */}
        <p className="mb-10 mt-4 text-center text-[length:var(--fs-sm)] text-[var(--text-3)]">
          Team i Business su na waitlisti i još nisu dostupni za kupovinu.
          PDF/Excel izveštaji stižu sa Business planom. Trebovanje: Free 10
          stavki, Starter 40, Pro+ bez limita.
        </p>
      </section>

      {/* 8. FAQ */}
      <div className="mx-auto w-full max-w-[760px]">
        <FaqAccordion
          title="Česta pitanja"
          items={[
            {
              q: "Da li mogu bez kartice?",
              a: "Da. Free plan ne traži karticu.",
            },
            {
              q: "Šta je uključeno u Pro trial?",
              a: "14 dana Pro funkcija — istorija cena, više tajmera, variance, inventura i neograničeno trebovanje. Otkažite bilo kada.",
            },
            {
              q: "Koliko stavki na stanju imam u Trebovanju?",
              a: "Free: 10 stavki. Starter: 40. Pro, Team i Business: bez limita. Otpis i dopuna sa nabavnom cenom od Startera; inventura od Pro.",
            },
            {
              q: "Mogu li otkazati pretplatu?",
              a: "Da, u bilo kom trenutku iz Podešavanja. Plan ostaje aktivan do kraja plaćenog perioda.",
            },
            {
              q: "Radi li offline?",
              a: "Keširani recepti su dostupni i bez interneta. Izmene se sinhronizuju kada se veza vrati.",
            },
            {
              q: "Kada stižu Team i Business?",
              a: "Na waitlisti su. Javićemo se čim budu spremni za kupovinu.",
            },
          ]}
        />
      </div>
    </div>
  );
}
