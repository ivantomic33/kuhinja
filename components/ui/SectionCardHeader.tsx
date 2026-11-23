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
  singleLine?: boolean;
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
  singleLine = false,
}: SectionCardHeaderProps) {
  return (
    <div className={cn("flex w-full min-w-0 items-start gap-2", className)}>
      <div className="min-w-0 flex-1">
        <div className={cn("flex min-h-11 items-center gap-2", !singleLine && "flex-wrap")}>
          <h2 className="min-w-0 truncate text-ui-xl font-semibold text-text">
            {title}
          </h2>
          {typeof count === "number" ? (
            <span className="count-pill shrink-0">{count}</span>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {href && showOpen ? (
              <Link
                href={href}
                className="inline-flex h-9 items-center gap-1 rounded-[10px] px-3 text-ui-sm font-semibold text-text-2 no-underline hover:bg-surface-2 hover:text-text"
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
          <p className="text-ui-sm text-text-2">{subtitle}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
