"use client";

import type { ReactNode } from "react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  /** Cell content */
  cell: (row: T) => ReactNode;
  /** Optional header alignment */
  align?: "left" | "right" | "center";
  /** Hide on small screens */
  hideOnMobile?: boolean;
  className?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  className?: string;
  /** Sticky first column on horizontal scroll */
  stickyFirst?: boolean;
  /** Enable row selection checkboxes */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  /** Compact row height */
  dense?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  className,
  stickyFirst = true,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  dense = false,
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const allIds = rows.map(rowKey);
  const allSelected =
    selectable &&
    allIds.length > 0 &&
    selectedIds != null &&
    allIds.every((id) => selectedIds.has(id));

  const cellPad = dense ? "px-2.5 py-1.5" : "px-3 py-2.5";

  return (
    <div
      className={cn(
        "app-scroll w-full overflow-x-auto rounded-[var(--radius-md)] border border-border",
        className
      )}
    >
      <table className="w-full min-w-[420px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/80">
            {selectable ? (
              <th
                scope="col"
                className={cn(
                  cellPad,
                  "w-11 sticky left-0 z-10 bg-surface-2/95 backdrop-blur-sm"
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(allSelected)}
                  aria-label={sr.common.select}
                  onChange={() => {
                    if (!onToggleSelectAll) {
                      allIds.forEach((id) => onToggleSelect?.(id));
                      return;
                    }
                    onToggleSelectAll(allIds);
                  }}
                  className="size-4 rounded border-border accent-[var(--accent)]"
                />
              </th>
            ) : null}
            {columns.map((col, index) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  cellPad,
                  "text-xs font-semibold uppercase tracking-wide text-muted",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.hideOnMobile && "hidden md:table-cell",
                  stickyFirst &&
                    !selectable &&
                    index === 0 &&
                    "sticky left-0 z-10 bg-surface-2/95 backdrop-blur-sm",
                  stickyFirst &&
                    selectable &&
                    index === 0 &&
                    "sticky left-11 z-10 bg-surface-2/95 backdrop-blur-sm",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            const isSelected = selectedIds?.has(id) ?? false;
            return (
              <tr
                key={id}
                className={cn(
                  "border-b border-border last:border-b-0 hover:bg-surface-2/40",
                  isSelected && "bg-[var(--accent-muted)]/40"
                )}
              >
                {selectable ? (
                  <td
                    className={cn(
                      cellPad,
                      "sticky left-0 z-10 bg-surface/95 backdrop-blur-sm"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      aria-label={`${sr.common.select} ${id}`}
                      onChange={() => onToggleSelect?.(id)}
                      className="size-4 rounded border-border accent-[var(--accent)]"
                    />
                  </td>
                ) : null}
                {columns.map((col, index) => (
                  <td
                    key={col.id}
                    className={cn(
                      cellPad,
                      "align-middle text-text",
                      col.align === "right" && "text-right tabular-nums",
                      col.align === "center" && "text-center",
                      col.hideOnMobile && "hidden md:table-cell",
                      stickyFirst &&
                        !selectable &&
                        index === 0 &&
                        "sticky left-0 z-10 bg-surface/95 backdrop-blur-sm",
                      stickyFirst &&
                        selectable &&
                        index === 0 &&
                        "sticky left-11 z-10 bg-surface/95 backdrop-blur-sm",
                      col.className
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
