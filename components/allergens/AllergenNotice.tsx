import { ALLERGEN_NOTICE } from "@/lib/allergens/notice";
import { cn } from "@/lib/utils/cn";

export function AllergenNotice({ className }: { className?: string }) {
  return (
    <p
      role="note"
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-surface-2 px-3 py-2 text-ui-sm leading-snug text-text-2",
        className,
      )}
    >
      {ALLERGEN_NOTICE}
    </p>
  );
}
