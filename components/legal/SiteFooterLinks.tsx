import Link from "next/link";
import { LEGAL_VERSIONS, PUBLIC_LEGAL_PAGES } from "@/lib/legal/versions";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

type SiteFooterLinksProps = {
  className?: string;
  /** Compact row for auth / app chrome */
  compact?: boolean;
};

export function SiteFooterLinks({
  className,
  compact = false,
}: SiteFooterLinksProps) {
  return (
    <nav
      aria-label={sr.legal.footerNavLabel}
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1 text-sm",
        compact && "justify-center gap-x-2 text-xs",
        className
      )}
    >
      {PUBLIC_LEGAL_PAGES.map(({ path, title }) => (
        <Link
          key={path}
          href={path}
          className="focus-ring inline-flex min-h-11 min-w-11 items-center rounded-sm text-muted underline-offset-2 hover:text-text hover:underline"
        >
          {compact ? shortLabel(title) : title}
        </Link>
      ))}
    </nav>
  );
}

function shortLabel(label: string): string {
  if (label === LEGAL_VERSIONS.terms.title) return sr.legal.termsShort;
  if (label === LEGAL_VERSIONS.privacy.title) return sr.legal.privacyShort;
  if (label === LEGAL_VERSIONS.refund.title) return sr.legal.refundShort;
  return label;
}
