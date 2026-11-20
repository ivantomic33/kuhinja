"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useToast } from "@/components/ui/Toast";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import { removeCachedRecipe } from "@/lib/offline/cache";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

export type DeleteRecipeButtonProps = {
  recipeId: string;
  recipeName?: string;
  /** Compact icon button for list rows */
  compact?: boolean;
  className?: string;
  onDeleted?: (recipeId: string) => void;
};

export function DeleteRecipeButton({
  recipeId,
  recipeName,
  compact = false,
  className,
  onDeleted,
}: DeleteRecipeButtonProps) {
  const router = useRouter();
  const online = useOnline(true);
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const ariaLabel = recipeName?.trim()
    ? `Obriši ${recipeName}`
    : sr.create.recipe.delete;

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
        .from("recipes")
        .delete()
        .eq("id", recipeId);

      if (deleteError) {
        setError(sr.create.recipe.deleteError);
        setLoading(false);
        return;
      }

      await removeCachedRecipe(recipeId);
      setConfirmOpen(false);
      setLoading(false);
      toast("Recept obrisan", "success");
      onDeleted?.(recipeId);

      if (!onDeleted) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setError(sr.create.recipe.deleteError);
      setLoading(false);
    }
  }

  const description = recipeName?.trim()
    ? `${sr.create.recipe.deleteConfirm} (${recipeName})`
    : sr.create.recipe.deleteConfirm;

  const confirmSheet = (
    <ConfirmSheet
      open={confirmOpen}
      onClose={closeConfirm}
      onConfirm={() => {
        void confirmDelete();
      }}
      title={sr.create.recipe.delete}
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
        aria-label={ariaLabel}
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl",
          "border border-danger/40 px-3 text-sm font-medium text-danger",
          "hover:bg-[var(--danger-soft)] outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {loading ? sr.common.loading : sr.create.recipe.delete}
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
