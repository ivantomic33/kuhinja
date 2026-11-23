"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useToast } from "@/components/ui/Toast";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import { removeCachedIngredient } from "@/lib/offline/cache";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

export type DeleteIngredientButtonProps = {
  ingredientId: string;
  ingredientName?: string;
  /** Compact icon button for list rows */
  compact?: boolean;
  className?: string;
  onDeleted?: (ingredientId: string) => void;
};

export function DeleteIngredientButton({
  ingredientId,
  ingredientName,
  compact = false,
  className,
  onDeleted,
}: DeleteIngredientButtonProps) {
  const router = useRouter();
  const online = useOnline(true);
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const actionLabel = compact ? sr.common.delete : sr.create.ingredient.delete;
  const ariaLabel = ingredientName?.trim()
    ? `${actionLabel} ${ingredientName}`
    : sr.create.ingredient.delete;

  function openConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (loading) return;
    setError(undefined);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (loading) return;
    setConfirmOpen(false);
  }

  async function confirmDelete() {
    if (loading) return;

    if (!online) {
      setError(sr.create.offline);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("ingredients")
        .delete()
        .eq("id", ingredientId);

      if (deleteError) {
        setError(sr.create.ingredient.deleteError);
        setLoading(false);
        return;
      }

      await removeCachedIngredient(ingredientId);
      setConfirmOpen(false);
      setLoading(false);
      toast("Sastojak obrisan", "success");
      onDeleted?.(ingredientId);
      router.refresh();
    } catch {
      setError(sr.create.ingredient.deleteError);
      setLoading(false);
    }
  }

  const description = ingredientName?.trim()
    ? `${sr.create.ingredient.deleteConfirm} (${ingredientName})`
    : sr.create.ingredient.deleteConfirm;

  const confirmSheet = (
    <ConfirmSheet
      open={confirmOpen}
      onClose={closeConfirm}
      onConfirm={() => {
        void confirmDelete();
      }}
      title={sr.create.ingredient.delete}
      description={description}
      error={error}
      confirmLabel={sr.common.delete}
      danger
      loading={loading}
    />
  );

  if (compact) {
    return (
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={openConfirm}
          disabled={loading}
          aria-label={ariaLabel}
          title={ariaLabel}
          className={cn(
            "icon-btn danger size-11",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
        {confirmSheet}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={openConfirm}
        disabled={loading}
        aria-label={loading ? undefined : ariaLabel}
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl",
          "border border-danger/40 px-3 text-sm font-medium text-danger-text",
          "enabled:hover:bg-[var(--danger-soft)] outline-none",
          "disabled:cursor-not-allowed disabled:border-dashed"
        )}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {loading ? sr.common.loading : sr.create.ingredient.delete}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {confirmSheet}
    </div>
  );
}
