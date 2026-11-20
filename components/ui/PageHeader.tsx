import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0 flex flex-col">
        {eyebrow ? <div className="mise-eyebrow">{eyebrow}</div> : null}
        <h1 className="mise-h1">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-[length:var(--fs-base)] text-[var(--text-2)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5">
          {action}
        </div>
      ) : null}
    </header>
  );
}
