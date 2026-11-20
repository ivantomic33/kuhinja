import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type SectionCardHeaderProps = {
  title: string;
  count?: number;
  href?: string;
  onAdd?: () => void;
  addLabel?: string;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
  /** Show ghost "Otvori" link */
  showOpen?: boolean;
};

export function SectionCardHeader({
  title,
  count,
  href,
  onAdd,
  addLabel,
  subtitle,
  children,
  className,
  showOpen = true,
}: SectionCardHeaderProps) {
  return (
    <div className={cn("flex w-full min-w-0 items-start gap-2", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex min-h-11 flex-wrap items-center gap-2">
          <h2 className="truncate text-[length:var(--fs-md)] font-semibold text-text">
            {title}
          </h2>
          {typeof count === "number" ? (
            <span className="count-pill">{count}</span>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            {href && showOpen ? (
              <Link
                href={href}
                className="inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-[length:var(--fs-sm)] font-semibold text-[var(--text-2)] no-underline hover:bg-surface-2 hover:text-text"
              >
                {sr.common.open}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
            {onAdd ? (
              <button
                type="button"
                onClick={onAdd}
                aria-label={addLabel ?? sr.common.next}
                className="icon-btn bordered size-9"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        {subtitle ? (
          <p className="text-[length:var(--fs-sm)] text-[var(--text-2)]">{subtitle}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
