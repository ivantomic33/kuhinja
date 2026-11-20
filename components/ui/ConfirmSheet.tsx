"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";

export type ConfirmSheetProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Shows spinner on the confirm action */
  loading?: boolean;
  /** Danger styling for destructive actions */
  danger?: boolean;
};

/**
 * In-app confirm dialog (BottomSheet) — replaces browser chrome confirms.
 */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  error,
  confirmLabel = sr.common.confirm,
  cancelLabel = sr.common.cancel,
  loading = false,
  danger = false,
}: ConfirmSheetProps) {
  return (
    <BottomSheet open={open} onClose={loading ? () => undefined : onClose} title={title}>
      <div className="flex flex-col gap-2 pb-1">
        {description ? (
          <p className="text-base text-muted">{description}</p>
        ) : null}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <PrimaryButton
          fullWidth
          variant={danger ? "danger" : "primary"}
          loading={loading}
          onClick={onConfirm}
        >
          {confirmLabel}
        </PrimaryButton>
        <PrimaryButton
          fullWidth
          variant="ghost"
          disabled={loading}
          onClick={onClose}
        >
          {cancelLabel}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
