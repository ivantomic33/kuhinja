"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Timer } from "lucide-react";
import { CreateTemplateSheet } from "@/components/create/CreateTemplateSheet";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SectionCardHeader } from "@/components/ui/SectionCardHeader";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import {
  getCachedTemplateSummaries,
  type CachedTemplateSummary,
} from "@/lib/offline/cache";
import { FREE_MAX_TEMPLATES } from "@/lib/plan/limits";
import { cn } from "@/lib/utils/cn";

export type TemplateRow = CachedTemplateSummary & {
  itemCount?: number;
  totalMinutes?: number;
};

export type ShiftTemplatesCardProps = {
  initialTemplates: TemplateRow[];
  venueId?: string | null;
  onRequestCreate?: () => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
};

export function ShiftTemplatesCard({
  initialTemplates,
  venueId = null,
  onRequestCreate,
  createOpen,
  onCreateOpenChange,
}: ShiftTemplatesCardProps) {
  const online = useOnline(true);
  const { isFree } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const [templates, setTemplates] = useState<TemplateRow[]>(initialTemplates);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = createOpen ?? internalOpen;
  const setOpen = onCreateOpenChange ?? setInternalOpen;

  useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);

  useEffect(() => {
    if (online && initialTemplates.length > 0) return;
    void getCachedTemplateSummaries().then((cached) => {
      if (cached.length === 0) return;
      setTemplates(cached);
    });
  }, [online, initialTemplates.length]);

  const resolvedVenueId = useMemo(() => {
    if (venueId) return venueId;
    return templates.find((row) => row.venue_id)?.venue_id ?? null;
  }, [venueId, templates]);

  function openCreate() {
    if (isFree && templates.length >= FREE_MAX_TEMPLATES) {
      showFreeLimit("FREE_LIMIT_TEMPLATES");
      return;
    }
    if (onRequestCreate) onRequestCreate();
    else setOpen(true);
  }

  return (
    <>
      <BentoCard
        header={
          <SectionCardHeader
            title={sr.shift.title}
            count={templates.length}
            onAdd={openCreate}
            addLabel="Dodaj šablon"
            subtitle={sr.shift.subtitle}
            showOpen={false}
          />
        }
      >
        {templates.length > 0 ? (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {templates.map((template) => {
                const items = template.itemCount ?? 0;
                const mins = template.totalMinutes ?? 0;
                return (
                  <li
                    key={template.id}
                    className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3.5"
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-3 text-[var(--text-2)]">
                      <ClipboardList className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-text">
                        {template.name}
                      </p>
                      <p className="text-[14px] text-[var(--text-3)]">
                        {items} stavki · {mins} min
                      </p>
                    </div>
                    <PrimaryButton
                      size="sm"
                      leftIcon={<Timer className="size-4" aria-hidden="true" />}
                      onClick={() => {
                        window.location.href = `/shift/${template.id}`;
                      }}
                    >
                      Pokreni smenu
                    </PrimaryButton>
                  </li>
                );
              })}
            </ul>
            {isFree ? (
              <p className="text-[14px] text-[var(--text-3)]">
                Free plan uključuje 1 šablon smene.{" "}
                <Link href="/premium" className="font-semibold text-accent no-underline">
                  Premium
                </Link>{" "}
                donosi neograničene šablone.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[14px] border border-border-strong bg-surface-2 text-[var(--text-2)]">
                <ClipboardList className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[length:var(--fs-md)] font-semibold text-text">
                  Nema pripreme za ovu smenu
                </h3>
                <p className="mt-1 text-[length:var(--fs-sm)] text-[var(--text-2)]">
                  Dodaj šablon ili kreni od recepta za danas.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <PrimaryButton
                    leftIcon={<span className="text-lg leading-none">+</span>}
                    onClick={openCreate}
                  >
                    Novi šablon smene
                  </PrimaryButton>
                  <PrimaryButton
                    variant="secondary"
                    disabled
                    title="Još nema sačuvanih šablona"
                  >
                    Izaberi postojeći šablon
                  </PrimaryButton>
                </div>
              </div>
            </div>
            <ol
              className={cn(
                "flex flex-col gap-3 border-t border-border pt-4 opacity-60 sm:flex-row sm:items-center sm:gap-2"
              )}
            >
              {[
                { n: 1, label: "Šablon" },
                { n: 2, label: "Recepti" },
                { n: 3, label: "Pregled food cost" },
              ].map((step, i) => (
                <li key={step.n} className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-3 text-[length:var(--fs-xs)] font-semibold text-[var(--text-2)]">
                    {step.n}
                  </span>
                  <span className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
                    {step.label}
                  </span>
                  {i < 2 ? (
                    <span className="mx-1 hidden text-[var(--text-3)] sm:inline" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        )}
      </BentoCard>

      <CreateTemplateSheet
        open={open}
        onClose={() => setOpen(false)}
        venueId={resolvedVenueId}
        currentCount={templates.length}
        onCreated={(template) => {
          setTemplates((prev) => [
            ...prev.filter((row) => row.id !== template.id),
            template,
          ]);
        }}
      />
    </>
  );
}
