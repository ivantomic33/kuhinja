"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { clearClientUserState } from "@/lib/auth/clear-client-state";
import { createClient } from "@/lib/supabase/client";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export function DeleteAccountButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirmWord, setConfirmWord] = useState("");

  const canDelete = useMemo(() => {
    return confirmWord.trim().toUpperCase() === sr.settings.deleteConfirmWord;
  }, [confirmWord]);

  function openConfirm() {
    if (loading) return;
    setError(undefined);
    setConfirmWord("");
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (loading) return;
    setConfirmOpen(false);
    setConfirmWord("");
  }

  async function confirmDelete() {
    if (loading || !canDelete) return;

    setLoading(true);
    setError(undefined);

    try {
      const supabase = createClient();
      const { data, error: invokeError } = await supabase.functions.invoke(
        "delete-account",
        { method: "POST" }
      );

      if (invokeError) {
        setError(sr.auth.errors.deleteFailed);
        setLoading(false);
        setConfirmOpen(false);
        return;
      }

      if (data && typeof data === "object" && "error" in data && data.error) {
        setError(sr.auth.errors.deleteFailed);
        setLoading(false);
        setConfirmOpen(false);
        return;
      }

      setConfirmOpen(false);
      await clearClientUserState(queryClient);
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setError(sr.auth.errors.deleteFailed);
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">{sr.auth.deleteAccountHint}</p>
      <div className="max-w-xs">
        <PrimaryButton
          type="button"
          variant="danger"
          fullWidth
          loading={loading}
          onClick={openConfirm}
        >
          {sr.auth.deleteAccount}
        </PrimaryButton>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <BottomSheet
        open={confirmOpen}
        onClose={closeConfirm}
        title={sr.auth.deleteAccount}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <PrimaryButton
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={closeConfirm}
            >
              {sr.common.cancel}
            </PrimaryButton>
            <PrimaryButton
              type="button"
              variant="danger"
              loading={loading}
              disabled={!canDelete}
              onClick={() => {
                void confirmDelete();
              }}
            >
              {sr.common.delete}
            </PrimaryButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-base text-muted">{sr.auth.deleteAccountConfirm}</p>
          <p className="text-sm text-muted">{sr.settings.deleteConfirmHint}</p>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {sr.settings.deleteConfirmWord}
            </span>
            <input
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder={sr.settings.deleteConfirmPlaceholder}
              autoComplete="off"
              className={cn(
                "min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3",
                "text-base text-text outline-none",
                "focus-visible:ring-2 focus-visible:ring-accent"
              )}
            />
          </label>
        </div>
      </BottomSheet>
    </div>
  );
}
