import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BentoCardProps = HTMLAttributes<HTMLElement> & {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  as?: "article" | "section" | "div";
  dense?: boolean;
  /** Remove default body padding (e.g. full-bleed tables). */
  flush?: boolean;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
};

export function BentoCard({
  header,
  footer,
  children,
  className,
  dense = false,
  flush = false,
  bodyClassName,
  headerClassName,
  footerClassName,
  as: Comp = "article",
  ...rest
}: BentoCardProps) {
  return (
    <Comp
      className={cn(
        "flex flex-col overflow-hidden rounded-[14px]",
        "border border-border bg-surface text-text",
        "min-w-0 shadow-[var(--shadow)]",
        className
      )}
      {...rest}
    >
      {header ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-b border-border",
            dense ? "px-4 py-3" : "px-5 py-4",
            headerClassName
          )}
        >
          {header}
        </div>
      ) : null}

      {children != null ? (
        <div
          className={cn(
            "flex flex-1 flex-col",
            flush
              ? "gap-0 p-0"
              : dense
                ? "gap-3 p-4"
                : "gap-4 p-5",
            bodyClassName
          )}
        >
          {children}
        </div>
      ) : null}

      {footer ? (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-t border-border text-ui-sm text-text-3",
            dense ? "px-4 py-3" : "px-5 py-4",
            footerClassName
          )}
        >
          {footer}
        </div>
      ) : null}
    </Comp>
  );
}
