import { sr } from "@/lib/i18n/sr";

export function AuthDivider() {
  return (
    <div className="flex items-center gap-2 py-1" aria-hidden="true">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wide text-muted">
        {sr.common.or}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
