"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import { removeCachedTemplate } from "@/lib/offline/cache";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

export type DeleteTemplateButtonProps = {
  templateId: string;
  templateName?: string;
  /** Compact icon button for list rows */
  compact?: boolean;
  className?: string;
  onDeleted?: (templateId: string) => void;
};

export function DeleteTemplateButton({
  templateId,
  templateName,
  compact = false,
  className,
  onDeleted,
}: DeleteTemplateButtonProps) {
  const router = useRouter();
  const online = useOnline(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

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
        .from("checklist_templates")
        .delete()
        .eq("id", templateId);

      if (deleteError) {
        setError(sr.create.template.deleteError);
        setLoading(false);

        return;
      }

      await removeCachedTemplate(templateId);
      setConfirmOpen(false);
      onDeleted?.(templateId);

      if (!onDeleted) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setError(sr.create.template.deleteError);
      setLoading(false);

    }
  }

  const description = templateName?.trim()
    ? `${sr.create.template.deleteConfirm} (${templateName})`
    : sr.create.template.deleteConfirm;

  const confirmSheet = (
    <ConfirmSheet
      open={confirmOpen}
      onClose={closeConfirm}
      onConfirm={() => {
        void confirmDelete();
      }}
      title={sr.create.template.delete}
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
          aria-label={sr.create.template.delete}
          title={sr.create.template.delete}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-input)]",
            "text-muted hover:bg-danger/10 hover:text-danger",
            "focus-visible:ring-2 focus-visible:ring-accent outline-none",
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
        aria-label={sr.create.template.delete}
        className={cn(
          "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-input)]",
          "border border-danger/40 px-3 text-sm font-medium text-danger",
          "hover:bg-danger/10 focus-visible:ring-2 focus-visible:ring-accent outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {loading ? sr.common.loading : sr.create.template.delete}
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
