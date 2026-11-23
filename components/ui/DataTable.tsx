"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  compare?: (left: T, right: T) => number;
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
  className?: string;
  /** Set to null when the header should be announced only in the desktop table. */
  mobileLabel?: string | null;
  price?: boolean;
};

export type DataTableSort = { column: string; direction: "ascending" | "descending" };

export function sortTableRows<T>(rows: T[], columns: DataTableColumn<T>[], sort?: DataTableSort) {
  const compare = columns.find(column => column.id === sort?.column)?.compare;
  if (!sort || !compare) return rows;
  const multiplier = sort.direction === "ascending" ? 1 : -1;
  return [...rows].sort((left, right) => multiplier * compare(left, right));
}

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowLabel?: (row: T) => string;
  label?: string;
  empty?: ReactNode;
  className?: string;
  stickyFirst?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[]) => void;
  /** Initial density when there is no browser preference. */
  dense?: boolean;
  stacked?: boolean;
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** When controlled, the caller sorts the full list before paging it. */
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort | undefined) => void;
  onRowClick?: (row: T) => void;
};

type Density = "compact" | "comfortable";
const densityKey = "treuplate.table-density";
const densities = [
  { value: "compact", label: "Kompaktno" },
  { value: "comfortable", label: "Udobno" },
] as const;

export function DataTable<T>({
  columns, rows, rowKey, rowLabel, label = "Tabela", empty, className, stickyFirst = true,
  selectable = false, selectedIds, onToggleSelect, onToggleSelectAll, dense = false,
  stacked = false, scrollRef, sort, onSortChange, onRowClick,
}: DataTableProps<T>) {
  const [density, setDensity] = useState<Density>(dense ? "compact" : "comfortable");
  const [internalSort, setInternalSort] = useState<DataTableSort>();
  const [internalSelection, setInternalSelection] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const checkboxes = useRef(new Map<string, HTMLInputElement>());
  const range = useRef<{ anchor: string; last: string; baseline: Set<string> } | null>(null);
  const activeSort = onSortChange ? sort : internalSort;
  const displayRows = useMemo(() => onSortChange ? rows : sortTableRows(rows, columns, activeSort), [
    rows, columns, activeSort, onSortChange,
  ]);
  const selection = selectedIds ?? internalSelection;
  const allIds = displayRows.map(rowKey);
  const selectedCount = allIds.filter(id => selection.has(id)).length;
  const allSelected = allIds.length > 0 && selectedCount === allIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(densityKey);
      if (stored === "compact" || stored === "comfortable") setDensity(stored);
    } catch {
      // The table still works when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  function changeDensity(value: Density) {
    setDensity(value);
    try {
      localStorage.setItem(densityKey, value);
    } catch {
      // The choice still applies to the current table.
    }
  }

  function changeSort(next?: DataTableSort) {
    range.current = null;
    if (onSortChange) onSortChange(next);
    else setInternalSort(next);
  }

  function updateSelection(next: Set<string>) {
    if (!selectedIds) setInternalSelection(next);
    for (const id of allIds) {
      if (next.has(id) !== selection.has(id)) onToggleSelect?.(id);
    }
  }

  function selectRow(id: string, checked: boolean) {
    range.current = null;
    const next = new Set(selection);
    if (checked) next.add(id);
    else next.delete(id);
    updateSelection(next);
  }

  function extendSelection(id: string, direction: number) {
    const index = allIds.indexOf(id);
    const target = allIds[index + direction];
    if (!target) return;
    const previous = range.current;
    const continuing = previous?.last === id && allIds.includes(previous.anchor);
    const anchor = continuing ? previous.anchor : id;
    const baseline = continuing ? previous.baseline : new Set(selection);
    const anchorIndex = allIds.indexOf(anchor);
    const targetIndex = index + direction;
    const next = new Set(baseline);
    for (const item of allIds.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)) {
      next.add(item);
    }
    range.current = { anchor, last: target, baseline };
    updateSelection(next);
    checkboxes.current.get(target)?.focus();
  }

  if (rows.length === 0 && empty) return <>{empty}</>;

  const sortableColumns = columns.filter(column => column.compare);
  return (
    <div className={cn("data-table min-w-0", className)} data-density={density}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div role="group" aria-label="Gustina tabele" className="flex rounded-lg bg-background p-1">
          {densities.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={density === option.value}
              onClick={() => changeDensity(option.value)}
              className={cn("focus-ring min-h-11 rounded-md px-2 text-ui-xs font-semibold md:min-h-9", density === option.value ? "bg-elevated text-text" : "text-text-2")}
            >
              {option.label}
            </button>
          ))}
        </div>
        {stacked && sortableColumns.length > 0 ? (
          <label className="flex min-w-0 items-center gap-2 text-ui-sm md:hidden">
            <span className="sr-only">Sortiranje</span>
            <select
              className="field-control min-w-0 max-w-full"
              value={activeSort ? `${activeSort.column}:${activeSort.direction}` : ""}
              onChange={event => {
                const column = sortableColumns.find(col => event.currentTarget.value.startsWith(`${col.id}:`));
                changeSort(column ? {
                  column: column.id,
                  direction: event.currentTarget.value.endsWith(":descending") ? "descending" : "ascending",
                } : undefined);
              }}
            >
              <option value="">Podrazumevani redosled</option>
              {sortableColumns.flatMap(column => [
                <option key={`${column.id}:ascending`} value={`${column.id}:ascending`}>{column.header} ↑ rastuće</option>,
                <option key={`${column.id}:descending`} value={`${column.id}:descending`}>{column.header} ↓ opadajuće</option>,
              ])}
            </select>
          </label>
        ) : null}
      </div>
      <div ref={scrollRef} className={cn("data-table-scroll app-scroll", stacked && "data-table-stacked")} role="region" aria-label={label} tabIndex={0}>
        <table className={stacked ? "app-table table-cards" : "app-table"} role="table" aria-label={label}>
          <thead role="rowgroup">
            <tr role="row">
              {selectable ? (
                <th scope="col" role="columnheader" className="data-table-check">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    aria-label={`Izaberi sve redove: ${label}`}
                    onChange={() => {
                      range.current = null;
                      const next = new Set(selection);
                      for (const id of allIds) {
                        if (allSelected) next.delete(id);
                        else next.add(id);
                      }
                      if (onToggleSelectAll) {
                        if (!selectedIds) setInternalSelection(next);
                        onToggleSelectAll(allIds);
                      } else updateSelection(next);
                    }}
                    className="focus-ring size-4 accent-accent"
                  />
                </th>
              ) : null}
              {columns.map((column, index) => {
                const direction = activeSort?.column === column.id ? activeSort.direction : "none";
                const Icon = direction === "ascending" ? ArrowUp : direction === "descending" ? ArrowDown : ArrowDownUp;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    role="columnheader"
                    aria-sort={column.compare ? direction : undefined}
                    className={cn(
                      column.align === "right" && "num",
                      column.align === "center" && "text-center",
                      column.hideOnMobile && "hidden md:table-cell",
                      stickyFirst && index === 0 && (selectable ? "data-table-first-after-check" : "data-table-first"),
                      column.className
                    )}
                  >
                    {column.compare ? (
                      <button
                        type="button"
                        className={cn(
                          "focus-ring inline-flex min-h-8 items-center gap-1 rounded-sm text-inherit hover:text-text",
                          column.align === "right" ? "text-end" : "text-start"
                        )}
                        onClick={() => changeSort({ column: column.id, direction: direction === "ascending" ? "descending" : "ascending" })}
                      >
                        {column.header}
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                      </button>
                    ) : column.mobileLabel === null ? (
                      <span className="sr-only">{column.header}</span>
                    ) : column.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody role="rowgroup" className={stacked ? "motion-card-list" : undefined}>
            {displayRows.map(row => {
              const id = rowKey(row);
              const checked = selection.has(id);
              return (
                <tr
                  key={id}
                  role="row"
                  data-selected={checked || undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? event => {
                    if (event.target instanceof Element && !event.target.closest("button, a, input, label, [role='dialog']")) onRowClick(row);
                  } : undefined}
                >
                  {selectable ? (
                    <td role="cell" className="data-table-check">
                      <label className="inline-flex min-h-9 items-center gap-2">
                        <input
                          ref={element => {
                            if (element) checkboxes.current.set(id, element);
                            else checkboxes.current.delete(id);
                          }}
                          type="checkbox"
                          checked={checked}
                          aria-label={`${sr.common.select}: ${rowLabel?.(row) ?? id}`}
                          aria-keyshortcuts="Shift+ArrowUp Shift+ArrowDown"
                          onChange={event => selectRow(id, event.currentTarget.checked)}
                          onKeyDown={event => {
                            if (event.key === "Tab") range.current = null;
                            if (!event.shiftKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
                            event.preventDefault();
                            extendSelection(id, event.key === "ArrowUp" ? -1 : 1);
                          }}
                          className="focus-ring size-4 accent-accent"
                        />
                        {stacked ? <span className="text-ui-sm text-text-2 md:hidden">Izaberi</span> : null}
                      </label>
                    </td>
                  ) : null}
                  {columns.map((column, index) => (
                    <td
                      key={column.id}
                      role="cell"
                      data-card-price={column.price || undefined}
                      className={cn(
                        column.align === "right" && "num",
                        column.align === "center" && "text-center",
                        column.hideOnMobile && "hidden md:table-cell",
                        stickyFirst && index === 0 && (selectable ? "data-table-first-after-check" : "data-table-first"),
                        column.className
                      )}
                    >
                      {stacked && column.mobileLabel != null ? (
                        <span className="card-field-label">{column.mobileLabel}</span>
                      ) : null}
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
