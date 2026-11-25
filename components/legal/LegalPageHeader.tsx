import { sr } from "@/lib/i18n/sr";
import type { LegalVersionMeta } from "@/lib/legal/versions";

export function LegalPageHeader({ page, headingId }: { page: LegalVersionMeta; headingId?: string }) {
  return (
    <header className="mb-8 space-y-3">
      {page.status === "nacrt" ? (
        <p className="text-sm font-medium text-amber-200/90">{sr.legal.draftBadge}</p>
      ) : null}
      <h1 id={headingId} className="text-3xl font-semibold tracking-tight text-text">{page.title}</h1>
      <p className="text-sm text-muted">
        {sr.legal.versionLabel}: <span className="tabular-nums">{page.version}</span>
        {" · "}
        {sr.legal.lastUpdatedLabel}:{" "}
        <time dateTime={page.lastUpdated}>{page.lastUpdated}</time>
      </p>
    </header>
  );
}
