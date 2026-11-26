import type { ReactNode } from "react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { PrimaryButton } from "./PrimaryButton";

export type EmptyStateProps = {
  icon?: ReactNode;
  title?: string;
  titleAs?: "p" | "h1";
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title = sr.ui.emptyState.defaultTitle,
  titleAs: Title = "p",
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
          className="flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-text-2 [&_svg]:size-6"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}

      <div className="flex max-w-[40ch] flex-col gap-2">
        <Title className="text-ui-md font-semibold text-text">
          {title}
        </Title>
        {description ? (
          <p className="text-ui-sm text-text-2">
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
