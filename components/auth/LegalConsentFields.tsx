import Link from "next/link";
import { useId } from "react";
import { sr } from "@/lib/i18n/sr";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";

type Props = {
  acceptTerms: boolean;
  marketingOptIn: boolean;
  onAcceptTerms: (accepted: boolean) => void;
  onMarketingOptIn: (accepted: boolean) => void;
  error?: string;
};

export function LegalConsentFields({
  acceptTerms, marketingOptIn, onAcceptTerms, onMarketingOptIn, error,
}: Props) {
  const errorId = useId();
  return (
    <div className="space-y-2 text-sm text-text">
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          checked={acceptTerms}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onAcceptTerms(event.target.checked)}
          className="focus-ring mt-0.5 size-4 shrink-0 accent-accent"
        />
        {sr.auth.acceptTerms}
      </label>
      <div className="flex flex-wrap gap-x-3 pl-6 text-muted">
        {[LEGAL_VERSIONS.terms, LEGAL_VERSIONS.privacy].map(({ path, title }) => (
          <Link key={path} href={path} target="_blank" rel="noopener" className="focus-ring underline underline-offset-2">
            {title}
          </Link>
        ))}
      </div>
      {error ? <p id={errorId} role="alert" className="text-error">{error}</p> : null}
      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="marketingOptIn"
          checked={marketingOptIn}
          onChange={(event) => onMarketingOptIn(event.target.checked)}
          className="focus-ring mt-0.5 size-4 shrink-0 accent-accent"
        />
        {sr.auth.marketingOptIn}
      </label>
    </div>
  );
}
