import type { ReactNode } from "react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { PrimaryButton } from "./PrimaryButton";

export type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title = sr.ui.emptyState.defaultTitle,
  description,
  actionLabel = sr.ui.emptyState.defaultAction,
  onAction,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-8 text-center",
        className
      )}
    >
      {icon ? (
        <div
          className="flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-[var(--text-2)] [&_svg]:size-6"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}

      <div className="flex max-w-[40ch] flex-col gap-1.5">
        <p className="text-[length:var(--fs-md)] font-semibold text-text">
          {title}
        </p>
        {description ? (
          <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        action
      ) : onAction ? (
        <PrimaryButton onClick={onAction} className="mt-2">
          {actionLabel}
        </PrimaryButton>
      ) : null}
    </div>
  );
}
