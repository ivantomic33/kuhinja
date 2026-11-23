"use client";

import { useMemo, useState } from "react";
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
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StateLink } from "@/components/ui/RouteStates";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { APP_NAME } from "@/lib/config/app";
import { usePlan } from "@/lib/hooks/usePlan";
import {
  FREE_MAX_INGREDIENTS,
  FREE_MAX_RECIPES,
  FREE_MAX_STOCK_ITEMS,
  PLAN_PRICES,
  type BillingPeriod,
  type PlanId,
} from "@/lib/plan/entitlements";
import { sr } from "@/lib/i18n/sr";
import { formatMoney, formatPercent } from "@/lib/utils/format";
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
    pro: Cell;
    team: Cell;
  }>;
};

const ALL_PLANS = { free: true, pro: true, team: true };
const PAID_PLANS = { ...ALL_PLANS, free: false };
const COMPARE_PLANS = [
  ["free", "Free"],
  ["pro", "Pro"],
  ["team", "Tim"],
] as const;

const COMPARE_GROUPS: CompareGroup[] = [
  {
    title: "Limiti",
    rows: [
      {
        label: "Recepti",
        free: String(FREE_MAX_RECIPES),
        pro: "Bez limita",
        team: "Bez limita",
      },
      {
        label: "Sastojci",
        free: String(FREE_MAX_INGREDIENTS),
        pro: "Bez limita",
        team: "Bez limita",
      },
      {
        label: "Lokacije",
        free: "1",
        pro: "1",
        team: "Više",
      },
      {
        label: "Korisnici",
        free: "1",
        pro: "1",
        team: "Više + uloge",
      },
    ],
  },
  {
    title: "Trebovanje",
    rows: [
      {
        label: "Stavke na stanju",
        free: String(FREE_MAX_STOCK_ITEMS),
        pro: "Bez limita",
        team: "Bez limita",
      },
      {
        label: "Praćenje stanja i unos prodaje",
        free: true,
        pro: true,
        team: true,
      },
      { label: "Upozorenje kada zaliha nestane", ...ALL_PLANS },
      { label: "Upozorenje ispod minimuma i procena preostalih smena", ...PAID_PLANS },
      { label: "Zvonce i obaveštenja o zalihama u aplikaciji", ...PAID_PLANS },
      {
        label: "Dopuna sa nabavnom cenom",
        free: false,
        pro: true,
        team: true,
      },
      {
        label: "Otpis / kalo",
        free: false,
        pro: true,
        team: true,
      },
      {
        label: "Inventura (usklađivanje)",
        free: false,
        pro: true,
        team: true,
      },
      {
        label: "Audit pokreta (ko je uneo)",
        free: false,
        pro: false,
        team: true,
      },
    ],
  },
  {
    title: "Raspored smena",
    rows: [
      { label: "Nedeljni raspored i zbir sati po zaposlenom", ...PAID_PLANS },
      {
        label: "Broj zaposlenih u rasporedu",
        free: false,
        pro: "Bez limita",
        team: "Bez limita",
      },
      { label: "Pregled drugih nedelja i kopiranje rasporeda", ...PAID_PLANS },
      { label: "Deljenje rasporeda i štampa / PDF", ...PAID_PLANS },
    ],
  },
  {
    title: "Priprema",
    rows: [
      {
        label: "Šabloni smene",
        free: "1",
        pro: "Bez limita",
        team: "Bez limita",
      },
      {
        label: "Istovremeni tajmeri",
        free: "2",
        pro: "Više",
        team: "Više",
      },
      {
        label: "PDF lista pripreme",
        free: false,
        pro: true,
        team: true,
      },
    ],
  },
  {
    title: "Troškovi i izveštaji",
    rows: [
      {
        label: "Food cost kalkulator",
        free: true,
        pro: true,
        team: true,
      },
      { label: "Oznaka i upozorenje za food cost iznad cilja", ...ALL_PLANS },
      { label: "Sastojak sa najvećim troškom i predlog cene", ...PAID_PLANS },
      { label: "Food cost posle prodaje", ...PAID_PLANS },
      { label: "Jela koja najviše doprinose trošku", ...PAID_PLANS },
      {
        label: "Istorija cena",
        free: false,
        pro: true,
        team: true,
      },
      {
        label: "Food cost variance / skaliranje",
        free: false,
        pro: true,
        team: true,
      },
      {
        label: "Osnovni izveštaji",
        free: false,
        pro: true,
        team: true,
      },
    ],
  },
  {
    title: "Tim",
    rows: [
      {
        label: "Uloge (šef / menadžer)",
        free: false,
        pro: false,
        team: true,
      },
      {
        label: "Deljena knjiga cena",
        free: false,
        pro: false,
        team: true,
      },
      {
        label: "Offline keširani recepti",
        free: true,
        pro: true,
        team: true,
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
        <Check className={cn("size-4", highlight ? "text-accent" : "text-success")} aria-hidden="true" />
        <span className="sr-only">Da</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center">
      <Minus className="size-4 text-text-3" aria-hidden="true" />
      <span className="sr-only">Ne</span>
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
    <li className="flex items-start gap-3 text-ui-sm text-text">
      <span
        className={cn(
          "ck mt-1 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full",
          featured
            ? "bg-[var(--accent-soft)] text-accent"
            : "bg-surface-3 text-text-2"
        )}
      >
        <Check className="size-3.5" aria-hidden="true" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function yearlySavings(prices: { monthly: number; yearly: number }) {
  return 12 * prices.monthly - prices.yearly;
}

function yearlyPriceNote(prices: { monthly: number; yearly: number }) {
  const savings = yearlySavings(prices);
  const monthlyEquivalent = `Oko ${formatMoney(prices.yearly / 12)} din/mes`;
  return savings > 0 ? `${monthlyEquivalent} · Ušteda ${formatMoney(savings)} din/god` : monthlyEquivalent;
}

function priceBlock(
  amount: number,
  period: BillingPeriod,
  opts?: { bare?: boolean }
) {
  const suffix = opts?.bare ? null : period === "yearly" ? "/ god" : "/ mes";
  return (
    <p className="flex flex-wrap items-baseline gap-2">
      <span className="text-ui-3xl font-bold leading-none tracking-[-0.03em] tabular-nums text-text">
        {formatMoney(amount)} din
      </span>
      {suffix ? (
        <span className="text-ui-base text-text-2">
          {suffix}
        </span>
      ) : null}
    </p>
  );
}

export default function PremiumPage({ guest = false }: { guest?: boolean }) {
  const {
    plan,
    isFree,
    isLoading,
    accountName,
    email,
  } = usePlan(!guest);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const yearly = period === "yearly";
  const interval = yearly ? "year" : "month";
  const proSavings = yearlySavings(PLAN_PRICES.pro);
  const savingsPercent = PLAN_PRICES.pro.monthly > 0
    ? Math.round(100 * proSavings / (12 * PLAN_PRICES.pro.monthly))
    : 0;

  const accountLabel = useMemo(() => {
    const raw = (accountName || email || "").trim();
    if (!raw) return "nalog";
    if (raw.includes("@")) return raw.split("@")[0] || raw;
    return raw.split(/\s+/)[0] || raw;
  }, [accountName, email]);

  function isCurrent(id: PlanId): boolean {
    return plan === id;
  }

  return (
    <div className="flex min-w-0 flex-col gap-10 pb-8">
      {/* 1. Hero */}
      <header className="prem-hero mx-auto mt-2 max-w-[820px] text-center">
        <p className="app-eyebrow">{APP_NAME} Premium</p>
        <h1>
          Više prostora za vaš posao
        </h1>
        <p className="mt-3 text-ui-base text-text-2">
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
          options={[
            { value: "monthly", label: "Mesečno" },
            {
              value: "yearly",
              label: "Godišnje",
              badge: savingsPercent > 0 ? `Pro · Uštedi ${formatPercent(savingsPercent, { fractionDigits: 0 })}` : undefined,
            },
          ]}
        />
      </div>

      {/* Plans */}
      <section
        aria-labelledby="premium-plans-heading"
        className="motion-card-list mx-auto grid w-full min-w-0 max-w-[1200px] grid-cols-1 gap-5 md:grid-cols-3"
      >
        <h2 id="premium-plans-heading" className="sr-only">Planovi</h2>
        {/* Free */}
        <article
          className={cn(
            "card plan quiet relative flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--shadow)]"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-ui-lg font-semibold text-text">
              Free
            </h3>
            {!guest && !isLoading && isFree ? (
              <Badge variant="success">
                <Check className="size-3.5" aria-hidden="true" />
                Aktivan
              </Badge>
            ) : null}
          </div>
          <p className="text-ui-sm text-text-2">
            Osnove za jedan lokal.
          </p>
          <div>
            {priceBlock(0, period, { bare: true })}
            <p className="mt-2 text-ui-sm text-text-2">
              Zauvek besplatno{guest ? null : ` · nalog ${accountLabel}`}
            </p>
          </div>
          <ul className="flex flex-col gap-3 border-t border-border pt-4">
            <CheckItem>{`${FREE_MAX_RECIPES} recepata · ${FREE_MAX_INGREDIENTS} sastojaka`}</CheckItem>
            <CheckItem>{`Trebovanje · ${FREE_MAX_STOCK_ITEMS} stavki na stanju`}</CheckItem>
            <CheckItem>Food cost kalkulator</CheckItem>
            <CheckItem>Food cost iznad cilja i upozorenje kad zaliha nestane</CheckItem>
            <CheckItem>1 šablon smene</CheckItem>
            <CheckItem>Keširani recepti offline</CheckItem>
          </ul>
          <div className="mt-auto pt-2">
            {guest ? (
              <StateLink href="/register" variant="secondary" fullWidth>{sr.auth.signUp}</StateLink>
            ) : isLoading ? (
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
                {isFree ? "Trenutni plan" : "Besplatan plan"}
              </PrimaryButton>
            )}
          </div>
        </article>

        {/* Pro — featured */}
        <article
          id="plan-pro"
          className="premium-pro-card relative flex min-h-0 scroll-mt-20 flex-col gap-4 rounded-2xl px-5 py-6"
        >
          <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-ui-xs font-bold uppercase tracking-wide text-text-on-accent shadow-sm">
            Najpopularnije
          </span>
          <div className="flex items-start justify-between gap-2 pt-1">
            <h3 className="text-ui-lg font-semibold text-text">
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
          <p className="text-ui-sm text-text-2">
            Kontrola cene i food cost variance.
          </p>
          <div>
            {priceBlock(
              yearly ? PLAN_PRICES.pro.yearly : PLAN_PRICES.pro.monthly,
              period
            )}
            <p
              className={cn(
                "mt-2 text-ui-sm",
                yearly ? "text-success" : "text-text-2"
              )}
            >
              {yearly
                ? yearlyPriceNote(PLAN_PRICES.pro)
                : "Naplata mesečno. Otkažite kad želite."}
            </p>
          </div>
          <p className="includes text-ui-sm font-semibold text-accent">
            Uključuje Starter
          </p>
          <ul className="flex flex-col gap-3 border-t border-border pt-4">
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
            {guest ? (
              <StateLink href="/login?next=%2Fpremium%23plan-pro" fullWidth>{sr.auth.signInForPlan}</StateLink>
            ) : isLoading ? (
              <PrimaryButton fullWidth loading disabled className="min-h-[46px]">
                Učitavanje
              </PrimaryButton>
            ) : isCurrent("pro") ||
              isCurrent("team") ||
              isCurrent("business") ? (
              <Link
                href="/settings/billing"
                className="flex min-h-[46px] items-center justify-center rounded-xl border border-border-strong bg-surface-2 px-4 text-ui-base font-semibold text-text no-underline hover:bg-surface-3"
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

        {/* Tim */}
        <article id="plan-team" className="flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--shadow)]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-ui-lg font-semibold text-text">Tim</h3>
            <Badge variant="warning">Uskoro</Badge>
          </div>
          <p className="text-ui-sm text-text-2">Za više korisnika i lokala.</p>
          <p className="text-ui-sm font-semibold text-accent">Uključuje Pro</p>
          <ul className="flex flex-col gap-3 border-t border-border pt-4">
            <CheckItem>Više korisnika i lokacija</CheckItem>
            <CheckItem>Uloge: šef / menadžer</CheckItem>
            <CheckItem>Trebovanje · audit ko je uneo pokret</CheckItem>
            <CheckItem>Deljena knjiga cena sastojaka</CheckItem>
            <CheckItem>Zajednički šabloni smene</CheckItem>
          </ul>
          <div className="mt-auto flex flex-col gap-2 pt-2">
            <PrimaryButton fullWidth variant="secondary" disabled aria-describedby="premium-team-availability">
              Izaberi Tim
            </PrimaryButton>
            <p id="premium-team-availability" className="text-center text-ui-sm text-text-2">
              Plan Tim je u pripremi. Kupovina još nije dostupna.
            </p>
          </div>
        </article>
      </section>

      {/* 4. Trust row */}
      <div className="trust mx-auto flex max-w-[960px] flex-wrap items-center justify-center gap-7 text-ui-sm text-text-2">
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
          Plan Tim je u pripremi
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
            <h2 className="text-ui-md font-semibold text-text">
              {item.title}
            </h2>
            <p className="mt-1 text-ui-sm text-text-2">
              {item.body}
            </p>
          </article>
        ))}
      </section>

      <section aria-labelledby="premium-compare-heading" className="mx-auto w-full max-w-[1200px]">
        <h2 id="premium-compare-heading" className="mb-5 text-center text-ui-xl font-semibold text-text">
          Uporedite planove
        </h2>
        <div
          role="region"
          aria-label="Tabela poređenja planova"
          tabIndex={0}
          className="focus-ring app-scroll hidden max-h-[min(65dvh,32rem)] overflow-auto rounded-xl border border-border bg-surface md:block"
        >
          <table className="premium-compare-table w-full min-w-[640px] border-separate border-spacing-0 text-left text-ui-sm">
            <caption className="sr-only">Funkcije po planovima</caption>
            <thead>
              <tr>
                <th scope="col" className="text-text-2">Funkcija</th>
                {COMPARE_PLANS.map(([id, label]) => (
                  <th key={id} scope="col" className={cn("w-32 text-center", id === "pro" && "text-accent")}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARE_GROUPS.map(group => (
              <tbody key={group.title}>
                <tr className="bg-surface-2">
                  <th scope="rowgroup" className="text-ui-xs font-semibold uppercase text-text-2">
                    {group.title}
                  </th>
                  <td colSpan={COMPARE_PLANS.length} />
                </tr>
                {group.rows.map(row => (
                  <tr key={row.label}>
                    <th scope="row" className="font-normal text-text">{row.label}</th>
                    {COMPARE_PLANS.map(([id]) => (
                      <td key={id} className={cn("text-center", id === "pro" ? "bg-[var(--accent-soft)]/25" : "text-text-2")}>
                        <PlanCell value={row[id]} highlight={id === "pro"} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <div className="md:hidden">
          <FaqAccordion
            title=""
            initiallyOpen={false}
            items={COMPARE_GROUPS.map(group => ({
              q: group.title,
              a: (
                <dl className="divide-y divide-border">
                  {group.rows.map(row => (
                    <div key={row.label} className="py-3 first:pt-0 last:pb-0">
                      <dt className="font-semibold text-text">{row.label}</dt>
                      <dd className="mt-2">
                        <dl className="grid grid-cols-3 gap-2 text-ui-sm">
                          {COMPARE_PLANS.map(([id, label]) => (
                            <div key={id} className="min-w-0">
                              <dt className="text-text-2">{label}</dt>
                              <dd className="mt-1 break-words"><PlanCell value={row[id]} highlight={id === "pro"} /></dd>
                            </div>
                          ))}
                        </dl>
                      </dd>
                    </div>
                  ))}
                </dl>
              ),
            }))}
          />
        </div>
      </section>

      <details className="mx-auto w-full max-w-[760px] rounded-xl border border-border bg-surface">
        <summary className="focus-ring cursor-pointer rounded-xl px-5 py-4 font-semibold text-text">Starter paket</summary>
        <div id="plan-starter" className="flex scroll-mt-20 flex-col gap-4 border-t border-border p-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-ui-lg font-semibold text-text">
              Starter
            </h2>
            {isCurrent("starter") ? (
              <Badge variant="success">
                <Check className="size-3.5" aria-hidden="true" />
                Aktivan
              </Badge>
            ) : null}
          </div>
          <p className="text-ui-sm text-text-2">
            Bez limita na recepte i sastojke.
          </p>
          <div>
            {priceBlock(
              yearly ? PLAN_PRICES.starter.yearly : PLAN_PRICES.starter.monthly,
              period
            )}
            <p
              className={cn(
                "mt-2 text-ui-sm",
                yearly ? "text-success" : "text-text-2"
              )}
            >
              {yearly
                ? yearlyPriceNote(PLAN_PRICES.starter)
                : "Naplata mesečno. Otkažite kad želite."}
            </p>
          </div>
          <ul className="flex flex-col gap-3 border-t border-border pt-4">
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
            {guest ? (
              <StateLink href="/login?next=%2Fpremium%23plan-starter" variant="secondary" fullWidth>{sr.auth.signInForPlan}</StateLink>
            ) : isCurrent("starter") ? (
              <PrimaryButton fullWidth variant="secondary" disabled className="min-h-[46px]">
                Trenutni plan
              </PrimaryButton>
            ) : isLoading ? (
              <PrimaryButton fullWidth loading disabled className="min-h-[46px]">
                Učitavanje
              </PrimaryButton>
            ) : (
              <CheckoutButton interval={interval} planTarget="starter" variant="secondary">
                Izaberi Starter
              </CheckoutButton>
            )}
          </div>
        </div>
      </details>

      {/* FAQ */}
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
              a: "Free: 10 stavki. Starter: 40. Pro i Tim: bez limita. Otpis i dopuna sa nabavnom cenom od Startera; inventura od Pro.",
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
              q: "Kada stiže plan Tim?",
              a: "Plan Tim je u pripremi. Kupovina još nije dostupna.",
            },
          ]}
        />
      </div>
    </div>
  );
}
