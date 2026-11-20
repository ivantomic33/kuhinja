"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, X } from "lucide-react";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { parseDecimal } from "@/lib/domain/parse";
import { getPrimaryVenueId } from "@/lib/domain/venue";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import {
  saveChecklistTemplate,
  type CachedTemplateSummary,
} from "@/lib/offline/cache";
import {
  canCreateTemplate,
  FREE_MAX_TEMPLATES,
} from "@/lib/plan/entitlements";
import {
  checklistTemplateInsertSchema,
  type ChecklistItemInput,
} from "@/lib/schemas/domain";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils/cn";

type DraftItem = {
  key: string;
  label: string;
  minutes: string;
  group: string;
};

function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyItem(): DraftItem {
  return { key: newKey(), label: "", minutes: "", group: "" };
}

export type CreateTemplateSheetProps = {
  open: boolean;
  onClose: () => void;
  venueId?: string | null;
  currentCount: number;
  onCreated?: (template: CachedTemplateSummary) => void;
};

export function CreateTemplateSheet({
  open,
  onClose,
  venueId: venueIdProp,
  currentCount,
  onCreated,
}: CreateTemplateSheetProps) {
  const router = useRouter();
  const online = useOnline(true);
  const { isFree } = usePlan();
  const { showFreeLimit, handleError } = usePlanUi();
  const { toast } = useToast();
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [nameError, setNameError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setItems([emptyItem()]);
    setNameError(undefined);
    setFieldErrors({});
    setFormError(undefined);
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    reset();
    const t = window.setTimeout(() => nameRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading]);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  function removeItem(key: string) {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.key !== key);
    });
  }

  function addItem() {
    const item = emptyItem();
    setItems((prev) => [...prev, item]);
    window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(
        `input[name="item-label-${item.key}"]`
      );
      el?.focus();
    }, 30);
  }

  const totalMinutes = items.reduce((sum, item) => {
    const n = parseDecimal(item.minutes);
    return sum + (n && n > 0 ? n : 0);
  }, 0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});
    setNameError(undefined);

    if (!name.trim()) {
      setNameError("Unesite naziv šablona.");
      nameRef.current?.focus();
      return;
    }

    if (!online) {
      setFormError(sr.create.offline);
      return;
    }

    if (isFree && currentCount >= FREE_MAX_TEMPLATES) {
      showFreeLimit("FREE_LIMIT_TEMPLATES");
      return;
    }

    let venueId = venueIdProp ?? null;
    if (!venueId) {
      venueId = await getPrimaryVenueId();
    }
    if (!venueId) {
      setFormError(sr.create.noVenue);
      return;
    }

    const checklistItems: ChecklistItemInput[] = [];
    const itemErrors: Record<string, string> = {};

    for (const draft of items) {
      const label = draft.label.trim();
      if (!label) {
        itemErrors[`label-${draft.key}`] = sr.auth.errors.required;
        continue;
      }

      let minutes: number | undefined;
      if (draft.minutes.trim()) {
        const parsedMinutes = parseDecimal(draft.minutes);
        if (parsedMinutes === null || parsedMinutes < 0) {
          itemErrors[`minutes-${draft.key}`] = sr.create.invalidNumber;
          continue;
        }
        minutes = parsedMinutes;
      }

      const group = draft.group.trim();
      checklistItems.push({
        id: draft.key,
        label,
        ...(minutes !== undefined ? { minutes } : {}),
        ...(group ? { group } : {}),
      });
    }

    if (Object.keys(itemErrors).length > 0) {
      setFieldErrors(itemErrors);
      return;
    }

    if (checklistItems.length === 0) {
      setFormError(sr.create.template.needItem);
      return;
    }

    const parsed = checklistTemplateInsertSchema.safeParse({
      venue_id: venueId,
      name,
      items: checklistItems,
    });

    if (!parsed.success) {
      setNameError("Unesite naziv šablona.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("checklist_templates")
        .insert({
          venue_id: parsed.data.venue_id,
          name: parsed.data.name,
          items: parsed.data.items as unknown as Json,
        })
        .select("id, venue_id, name, items")
        .single();

      if (error) {
        if (handleError(error)) return;
        const message = error.message?.toLowerCase() ?? "";
        if (
          error.code === "23505" ||
          message.includes("unique") ||
          message.includes("duplicate")
        ) {
          setFormError(sr.create.duplicateName);
          return;
        }
        setFormError(sr.create.genericError);
        return;
      }

      if (!data) {
        setFormError(sr.create.genericError);
        return;
      }

      const summary: CachedTemplateSummary & {
        itemCount?: number;
        totalMinutes?: number;
      } = {
        id: data.id,
        name: data.name,
        venue_id: data.venue_id,
        itemCount: checklistItems.length,
        totalMinutes: Math.round(totalMinutes),
      };

      void saveChecklistTemplate({
        id: data.id,
        name: data.name,
        venue_id: data.venue_id,
        items: checklistItems,
      });

      onCreated?.(summary);
      toast("Šablon sačuvan", "success");
      reset();
      onClose();
      router.refresh();
    } catch (error) {
      if (handleError(error)) return;
      setFormError(sr.create.genericError);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="mise-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[720px] max-h-[88vh] flex-col overflow-hidden rounded-[20px] border border-border-strong bg-surface shadow-[var(--shadow-modal)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 pb-5 pt-6">
          <div>
            <h2
              id={titleId}
              className="text-[length:var(--fs-xl)] font-semibold text-text"
            >
              Novi šablon smene
            </h2>
            <p className="mt-1 text-[length:var(--fs-sm)] text-[var(--text-2)]">
              Lista zadataka koju tim prolazi pre servisa.
            </p>
          </div>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={handleClose}
            className="icon-btn"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={onSubmit}
          noValidate
        >
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6 mise-scroll">
            <div>
              <label className="field-label" htmlFor="template-name">
                Naziv šablona
              </label>
              <div
                className={cn("field-input", nameError && "invalid")}
              >
                <input
                  ref={nameRef}
                  id="template-name"
                  name="templateName"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(undefined);
                  }}
                  placeholder="npr. Jutarnja priprema"
                  autoComplete="off"
                  required
                />
              </div>
              {nameError ? (
                <p className="mt-1.5 text-[length:var(--fs-sm)] text-danger">
                  {nameError}
                </p>
              ) : null}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-[length:var(--fs-md)] font-semibold text-text">
                  Stavke pripreme
                </h3>
                <span className="count-pill">{items.length}</span>
              </div>

              <div className="mb-2 hidden grid-cols-[32px_minmax(0,1fr)_110px_minmax(0,.8fr)_44px] gap-2.5 px-1 text-[length:var(--fs-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--text-3)] min-[720px]:grid">
                <span>#</span>
                <span>Naziv stavke</span>
                <span>Minuti</span>
                <span>Grupa (opciono)</span>
                <span />
              </div>

              <ul className="flex flex-col gap-2.5">
                {items.map((item, index) => (
                  <li
                    key={item.key}
                    className={cn(
                      "grid items-center gap-2.5",
                      "grid-cols-[32px_minmax(0,1fr)_44px]",
                      "min-[720px]:grid-cols-[32px_minmax(0,1fr)_110px_minmax(0,.8fr)_44px]",
                      "max-[719px]:rounded-xl max-[719px]:bg-surface-2 max-[719px]:p-3"
                    )}
                  >
                    <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface-3 text-[length:var(--fs-xs)] font-semibold text-[var(--text-2)]">
                      {index + 1}
                    </span>
                    <div className="contents min-[720px]:contents max-[719px]:col-span-1 max-[719px]:flex max-[719px]:flex-col max-[719px]:gap-2">
                      <div
                        className={cn(
                          "field-input",
                          fieldErrors[`label-${item.key}`] && "invalid",
                          "max-[719px]:col-auto"
                        )}
                      >
                        <input
                          name={`item-label-${item.key}`}
                          value={item.label}
                          onChange={(e) =>
                            updateItem(item.key, { label: e.target.value })
                          }
                          placeholder="Naziv stavke"
                        />
                      </div>
                      <div className="field-input max-[719px]:w-full">
                        <input
                          name={`item-minutes-${item.key}`}
                          type="number"
                          min={0}
                          inputMode="decimal"
                          value={item.minutes}
                          onChange={(e) =>
                            updateItem(item.key, { minutes: e.target.value })
                          }
                          placeholder="Minuti"
                        />
                      </div>
                      <div className="field-input max-[719px]:w-full min-[720px]:block">
                        <input
                          name={`item-group-${item.key}`}
                          value={item.group}
                          onChange={(e) =>
                            updateItem(item.key, { group: e.target.value })
                          }
                          placeholder="Grupa (opciono)"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Ukloni stavku"
                      onClick={() => removeItem(item.key)}
                      className={cn(
                        "icon-btn danger",
                        items.length <= 1 && "invisible pointer-events-none"
                      )}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={addItem}
                className={cn(
                  "mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong",
                  "bg-transparent text-[length:var(--fs-base)] font-semibold text-[var(--text-2)]",
                  "transition-colors hover:border-accent hover:bg-[var(--accent-soft)] hover:text-accent"
                )}
              >
                <Plus className="size-4" aria-hidden="true" />
                Dodaj stavku
              </button>
            </div>

            {formError ? (
              <p role="alert" className="text-[length:var(--fs-sm)] text-danger">
                {formError}
              </p>
            ) : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2 px-6 py-4 rounded-b-[20px]">
            <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
              Ukupno:{" "}
              <span className="font-semibold tabular-nums text-text">
                {Math.round(totalMinutes)} min
              </span>
            </p>
            <div className="flex items-center gap-2">
              <PrimaryButton
                type="button"
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Otkaži
              </PrimaryButton>
              <PrimaryButton
                type="submit"
                loading={loading}
                leftIcon={<Check className="size-4" aria-hidden="true" />}
              >
                Sačuvaj šablon
              </PrimaryButton>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
