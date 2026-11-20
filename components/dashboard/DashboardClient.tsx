"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Carrot,
  ClipboardList,
  History,
  Percent,
  Plus,
  TrendingUp,
  Utensils,
} from "lucide-react";
import { CreateTemplateSheet } from "@/components/create/CreateTemplateSheet";
import { IngredientsCard } from "@/components/offline/IngredientsCard";
import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import {
  RecentRecipesCard,
  type RecipeFoodCosts,
  type RecipePreview,
} from "@/components/offline/RecentRecipesCard";
import {
  ShiftTemplatesCard,
  type TemplateRow,
} from "@/components/offline/ShiftTemplatesCard";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { usePlan } from "@/lib/hooks/usePlan";
import type { CachedIngredient } from "@/lib/offline/cache";
import {
  FREE_MAX_INGREDIENTS,
  FREE_MAX_RECIPES,
  FREE_MAX_TEMPLATES,
} from "@/lib/plan/limits";
import { cn } from "@/lib/utils/cn";

export type ActivityItem = {
  id: string;
  kind: "warning" | "recipe" | "ingredient";
  title: string;
  body: ReactNode;
};

export type DashboardClientProps = {
  firstName: string;
  greeting: string;
  venueId: string | null;
  recipes: RecipePreview[];
  recipeFoodCosts: Promise<RecipeFoodCosts>;
  recipeCount: number;
  ingredients: CachedIngredient[];
  ingredientCount: number;
  stockAlertCount?: number;
  stockAlertsAreZeroOnly?: boolean;
  templates: TemplateRow[];
  loadError?: boolean;
  activity?: ActivityItem[];
};

export function DashboardClient({
  firstName,
  greeting,
  venueId,
  recipes,
  recipeFoodCosts,
  recipeCount,
  ingredients,
  ingredientCount,
  stockAlertCount = 0,
  stockAlertsAreZeroOnly = false,
  templates,
  loadError = false,
  activity = [],
}: DashboardClientProps) {
  const { isPremium, isFree } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateList, setTemplateList] = useState(templates);

  function openTemplate() {
    if (isFree && templateList.length >= FREE_MAX_TEMPLATES) {
      showFreeLimit("FREE_LIMIT_TEMPLATES");
      return;
    }
    setTemplateOpen(true);
  }

  const chips: Array<{
    key: string;
    label: string;
    tone: "danger" | "warn" | "ok" | "neutral";
    href?: string;
    onClick?: () => void;
  }> = [];

  if (templateList.length === 0) {
    chips.push({
      key: "no-prep",
      label: "Nema pripreme za današnju smenu",
      tone: "warn",
      onClick: openTemplate,
    });
  }

  if (isFree) {
    chips.push({
      key: "recipes-limit",
      label: `Recepti: ${recipeCount} od ${FREE_MAX_RECIPES} na Free planu`,
      tone: "neutral",
      href: "/premium",
    });
  }

  if (stockAlertCount > 0) {
    chips.push({
      key: "stock-alerts",
      label: stockAlertsAreZeroOnly
        ? `Nestalo sa stanja: ${stockAlertCount}`
        : `Zalihe koje zahtevaju pažnju: ${stockAlertCount}`,
      tone: stockAlertsAreZeroOnly ? "danger" : "warn",
      href: "/trebovanje",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <OfflineCacheSeeder
        recipes={recipes}
        ingredients={ingredients}
        templates={templates}
      />
      <PageHeader
        eyebrow="Radni prostor"
        title={`${greeting}, ${firstName}`}
        description="Sve za dobru pripremu. Recepti, troškovi i smena na jednom mestu."
        action={
          <>
            <Badge variant={isPremium ? "accent" : "neutral"}>
              {isPremium ? "Premium" : "Free plan"}
            </Badge>
            <PrimaryButton
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
              onClick={openTemplate}
            >
              Novi šablon smene
            </PrimaryButton>
          </>
        }
      />

      {loadError ? (
        <p
          role="alert"
          className="rounded-[14px] border border-danger/30 bg-[var(--danger-soft)] p-5 text-danger"
        >
          Deo podataka nije učitan. Proverite vezu i osvežite stranicu.
        </p>
      ) : null}

      {chips.length > 0 ? (
        <div className="mb-1 flex flex-wrap items-center gap-2.5">
          <span className="text-[length:var(--fs-xs)] font-semibold uppercase tracking-[0.08em] text-[var(--text-2)]">
            Zahteva pažnju
          </span>
          {chips.map((chip) => {
            const className = cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[length:var(--fs-sm)] text-text no-underline transition-colors hover:bg-surface-2"
            );
            const dot = (
              <span
                className={cn(
                  "size-2 rounded-full",
                  chip.tone === "danger" && "bg-danger",
                  chip.tone === "warn" && "bg-warning",
                  chip.tone === "ok" && "bg-success",
                  chip.tone === "neutral" && "bg-[var(--text-3)]"
                )}
              />
            );
            if (chip.href) {
              return (
                <Link key={chip.key} href={chip.href} className={className}>
                  {dot}
                  {chip.label}
                </Link>
              );
            }
            return (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClick}
                className={className}
              >
                {dot}
                {chip.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* KPI grid */}
      <div
        className={cn(
          "grid gap-4",
          "grid-cols-1",
          "min-[720px]:grid-cols-2",
          "min-[1280px]:grid-cols-5",
          // 1279 and below: 6-col with 3+2
          "max-[1279px]:min-[720px]:grid-cols-6"
        )}
      >
        <KpiCard
          className="max-[1279px]:min-[720px]:col-span-2 min-[1280px]:col-span-1"
          label="Recepti"
          value={recipeCount}
          icon={<BookOpen className="size-5" />}
          trend={{ direction: "flat", label: "bez promene" }}
        />
        <KpiCard
          className="max-[1279px]:min-[720px]:col-span-2 min-[1280px]:col-span-1"
          label="Sastojci"
          value={ingredientCount}
          icon={<Carrot className="size-5" />}
          trend={{ direction: "flat", label: "bez promene" }}
        />
        <KpiCard
          className="max-[1279px]:min-[720px]:col-span-2 min-[1280px]:col-span-1"
          label="Šabloni smene"
          value={templateList.length}
          icon={<ClipboardList className="size-5" />}
          trend={{ direction: "flat", label: "bez promene" }}
        />
        <KpiCard
          className="max-[1279px]:min-[720px]:col-span-3 min-[1280px]:col-span-1 max-[719px]:col-span-1"
          label="Prosečan food cost"
          value="—"
          suffix=""
          highlight
          icon={<Percent className="size-5" />}
          hint="Dostupno po receptu"
        />
        <KpiCard
          className="max-[1279px]:min-[720px]:col-span-3 min-[1280px]:col-span-1 max-[719px]:col-span-2"
          label="Prosečna marža"
          value="—"
          highlight
          icon={<TrendingUp className="size-5" />}
          hint="Dostupno po receptu"
        />
      </div>

      {/* Main 12-col grid — 8/4 at ≥1200, stack below */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-6 min-[1200px]:col-span-8">
          <ShiftTemplatesCard
            initialTemplates={templateList}
            venueId={venueId}
            createOpen={templateOpen}
            onCreateOpenChange={setTemplateOpen}
            onRequestCreate={openTemplate}
          />
          <RecentRecipesCard
            initialRecipes={recipes}
            recipeFoodCosts={recipeFoodCosts}
            venueId={venueId}
          />
        </div>

        <div className="col-span-12 flex flex-col gap-6 min-[1200px]:col-span-4">
          {/* Activity */}
          <article className="rounded-2xl border border-border bg-surface shadow-[var(--shadow)]">
            <div className="border-b border-border px-6 py-5">
              <h2 className="text-[length:var(--fs-md)] font-semibold text-text">
                Nedavno i upozorenja
              </h2>
              <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
                Šta se promenilo
              </p>
            </div>
            <ul className="flex flex-col gap-1 p-3">
              {activity.length === 0 ? (
                <li className="px-3 py-6 text-center text-[length:var(--fs-sm)] text-[var(--text-3)]">
                  Još nema aktivnosti.
                </li>
              ) : (
                activity.map((item) => {
                  const Icon =
                    item.kind === "warning"
                      ? History
                      : item.kind === "recipe"
                        ? Utensils
                        : Carrot;
                  return (
                    <li key={item.id}>
                      <div className="flex min-h-16 items-start gap-3 rounded-xl px-4 py-3 hover:bg-surface-2">
                        <span
                          className={cn(
                            "inline-flex size-8 shrink-0 items-center justify-center rounded-[9px]",
                            item.kind === "warning"
                              ? "bg-[var(--warning-soft)] text-warning"
                              : "bg-surface-2 text-[var(--text-2)]"
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[length:var(--fs-sm)] font-semibold text-text">
                            {item.title}
                          </p>
                          <p className="text-[13px] text-[var(--text-2)]">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </article>

          {/* Plan card */}
          <article className="plan-card rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow)]">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-[length:var(--fs-md)] font-semibold text-text">
                Vaš plan
              </h2>
              <Badge variant={isPremium ? "accent" : "accent"}>
                {isPremium ? "Premium" : "Free"}
              </Badge>
            </div>

            {!isPremium ? (
              <>
                <UsageRow
                  label="Recepti"
                  used={recipeCount}
                  max={FREE_MAX_RECIPES}
                />
                <UsageRow
                  label="Sastojci"
                  used={ingredientCount}
                  max={FREE_MAX_INGREDIENTS}
                />
                <UsageRow
                  label="Šabloni smene"
                  used={templateList.length}
                  max={FREE_MAX_TEMPLATES}
                />
                <div
                  className="mt-4 rounded-xl border p-3.5"
                  style={{
                    borderColor: "var(--accent-line)",
                    background:
                      "linear-gradient(135deg, rgba(255,107,53,.16), rgba(255,107,53,.04))",
                  }}
                >
                  <p className="text-[length:var(--fs-sm)] text-text">
                    <span className="font-bold">Premium</span> donosi
                    neograničene recepte, istoriju cena i više tajmera.
                  </p>
                  <PrimaryButton fullWidth className="mt-3" onClick={() => {
                    window.location.href = "/premium";
                  }}>
                    Probaj 14 dana besplatno
                  </PrimaryButton>
                </div>
              </>
            ) : (
              <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
                Premium je aktivan — bez limita na recepte, sastojke i šablone.
              </p>
            )}
          </article>
        </div>

        <div className="col-span-12">
          <IngredientsCard initialIngredients={ingredients} venueId={venueId} />
        </div>
      </div>

      <CreateTemplateSheet
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        venueId={venueId}
        currentCount={templateList.length}
        onCreated={(t) => {
          setTemplateList((prev) => [
            ...prev.filter((row) => row.id !== t.id),
            t,
          ]);
        }}
      />
    </div>
  );
}

function UsageRow({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max: number;
}) {
  const pct = Math.min(100, (used / Math.max(1, max)) * 100);
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[length:var(--fs-sm)]">
        <span className="text-[var(--text-2)]">{label}</span>
        <span className="tabular-nums text-text">
          {used} / {max}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
