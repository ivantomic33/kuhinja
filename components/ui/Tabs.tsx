"use client";

import { cn } from "@/lib/utils/cn";

export type TabItem<T extends string> = {
  id: T;
  label: string;
};

export type TabsProps<T extends string> = {
  items: readonly TabItem<T>[] | TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border",
        className
      )}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            id={`tab-${item.id}`}
            onClick={() => onChange(item.id)}
            className={cn(
              "relative min-h-11 shrink-0 px-3 text-sm font-medium outline-none",
              "transition-colors duration-150",
              "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected ? "text-text" : "text-muted hover:text-text"
            )}
          >
            {item.label}
            {selected ? (
              <span
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent"
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
