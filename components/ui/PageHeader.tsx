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
        "mb-6 flex flex-wrap items-end justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0 flex flex-col">
        {eyebrow ? <div className="app-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-ui-base leading-normal text-text-2">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
          {action}
        </div>
      ) : null}
    </header>
  );
}
