import Link from "next/link";
import { DeleteAccountButton } from "@/components/auth/DeleteAccountButton";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SettingsAccountForm } from "@/components/settings/SettingsAccountForm";
import { Badge } from "@/components/ui/Badge";
import { BentoCard } from "@/components/ui/BentoCard";
import { LimitMeter } from "@/components/ui/LimitMeter";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import {
  FREE_MAX_INGREDIENTS,
  FREE_MAX_RECIPES,
  FREE_MAX_TEMPLATES,
} from "@/lib/plan/limits";
import { isPremium } from "@/lib/supabase/plan";
import { getPlanDetails } from "@/lib/supabase/plan-server";
import { getRecipeCount } from "@/lib/supabase/recipe-count";
import { createClient, getServerUser } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/utils/format";

export default async function SettingsPage() {
  const [supabase, user, details] = await Promise.all([
    createClient(),
    getServerUser(),
    getPlanDetails(),
  ]);
  const premium = isPremium(details.plan);

  const [recipesCount, ingredientsCountRes, templatesCountRes] = premium
    ? [0, null, null]
    : await Promise.all([
        getRecipeCount(),
        supabase.from("ingredients").select("id", { count: "exact", head: true }),
        supabase
          .from("checklist_templates")
          .select("id", { count: "exact", head: true }),
      ]);
  const ingredientsCount = ingredientsCountRes?.count ?? 0;
  const templatesCount = templatesCountRes?.count ?? 0;

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={sr.settings.title}
        description={sr.settings.subtitle}
      />

      {/* Prototype account block: Ime / Email / Valuta / Sačuvaj */}
      <SettingsAccountForm
        initialName={displayName}
        email={user?.email ?? ""}
        currencyLabel="RSD (din)"
      />

      {/* Plan & billing — keep existing controls */}
      <BentoCard
        header={
          <div className="flex w-full items-center justify-between gap-2">
            <h2 className="text-[length:var(--fs-md)] font-semibold text-text">
              {sr.settings.planAndBilling}
            </h2>
            <Badge variant={premium ? "accent" : "neutral"}>
              {premium ? sr.settings.planPremium : sr.settings.planFree}
            </Badge>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div>
              <p className="field-label mb-1">{sr.settings.renewalDate}</p>
              <p className="text-[length:var(--fs-base)] text-text">
                {premium
                  ? formatShortDate(details.planExpiresAt)
                  : sr.billing.noExpiration}
              </p>
            </div>
            <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
              {sr.settings.usage}
            </p>
            <LimitMeter
              label={sr.recipes.title}
              used={recipesCount}
              max={FREE_MAX_RECIPES}
              isPremium={premium}
            />
            <LimitMeter
              label={sr.ingredients.title}
              used={ingredientsCount}
              max={FREE_MAX_INGREDIENTS}
              isPremium={premium}
            />
            <LimitMeter
              label={sr.shift.title}
              used={templatesCount}
              max={FREE_MAX_TEMPLATES}
              isPremium={premium}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/settings/billing" className="block">
              <PrimaryButton fullWidth type="button" variant="secondary">
                {sr.settings.manageBilling}
              </PrimaryButton>
            </Link>
            {!premium ? (
              <Link href="/premium" className="block">
                <PrimaryButton fullWidth type="button">
                  {sr.settings.upgrade}
                </PrimaryButton>
              </Link>
            ) : null}
            <div className="pt-2">
              <SignOutButton />
            </div>
          </div>
        </div>
      </BentoCard>

      {/* Security */}
      <BentoCard
        header={
          <h2 className="text-[length:var(--fs-md)] font-semibold text-text">
            {sr.settings.security}
          </h2>
        }
      >
        <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
          {sr.auth.resetPasswordHint}
        </p>
        <div className="max-w-xs">
          <Link href="/forgot-password" className="block">
            <PrimaryButton fullWidth type="button" variant="ghost">
              {sr.auth.forgotPassword}
            </PrimaryButton>
          </Link>
        </div>
      </BentoCard>

      {/* Danger zone — isolated */}
      <section className="mt-2 rounded-2xl border border-danger/40 bg-[var(--danger-soft)]/40 p-1">
        <BentoCard
          className="border-danger/30 bg-transparent shadow-none"
          header={
            <h2 className="text-[length:var(--fs-md)] font-semibold text-danger">
              {sr.settings.dangerZone}
            </h2>
          }
        >
          <DeleteAccountButton />
        </BentoCard>
      </section>
    </div>
  );
}
