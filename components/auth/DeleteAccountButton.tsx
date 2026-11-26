"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useId, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { clearClientUserState } from "@/lib/auth/clear-client-state";
import { createClient } from "@/lib/supabase/client";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export function DeleteAccountButton() {
  const queryClient = useQueryClient();
  const confirmId = useId();
  const hintId = `${confirmId}-hint`;
  const errorId = `${confirmId}-error`;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");

  const canDelete = confirmWord === sr.settings.deleteConfirmWord && !needsSignIn;

  function openConfirm() {
    if (loading) return;
    setError(undefined);
    setNeedsSignIn(false);
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
      const { data, error: invokeError } = await createClient().functions.invoke<{ success: boolean }>(
        "delete-account",
        { body: { confirmation: confirmWord } }
      );

      if (invokeError instanceof FunctionsHttpError &&
          [401, 403].includes(invokeError.context.status)) {
        setNeedsSignIn(true);
        setError(sr.auth.deleteAccountSignIn);
        return;
      }
      if (invokeError || data?.success !== true) {
        setError(sr.auth.errors.deleteFailed);
        return;
      }

      await clearClientUserState(queryClient);
      window.location.replace("/#nalog-obrisan");
    } catch {
      setError(sr.auth.errors.deleteFailed);
    } finally {
      setLoading(false);
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
              aria-describedby={needsSignIn ? errorId : hintId}
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
          <ul className="list-disc space-y-1 pl-5 text-sm text-text">
            {sr.auth.deleteAccountData.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p id={hintId} className="text-sm text-muted">{sr.settings.deleteConfirmHint}</p>
          <label htmlFor={confirmId} className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {sr.settings.deleteConfirmWord}
            </span>
            <input
              id={confirmId}
              aria-describedby={hintId}
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder={sr.settings.deleteConfirmPlaceholder}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={loading || needsSignIn}
              className={cn(
                "min-h-11 w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3",
                "text-base text-text outline-none",
                "focus-visible:ring-2 focus-visible:ring-accent"
              )}
            />
          </label>
          {error ? <p id={errorId} role="alert" className="text-sm text-danger">{error}</p> : null}
          {needsSignIn ? <SignOutButton /> : null}
        </div>
      </BottomSheet>
    </div>
  );
}
