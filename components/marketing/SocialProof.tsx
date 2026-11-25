import { landingTestimonials, type LandingTestimonial } from "@/content/landing-social-proof";
import { sr } from "@/lib/i18n/sr";

export function SocialProof({
  testimonials = landingTestimonials,
}: {
  testimonials?: readonly LandingTestimonial[];
}) {
  const approved = testimonials.filter(({ approvedAt }) => approvedAt?.trim());
  if (!approved.length) return null;

  return (
    <section aria-labelledby="social-proof-title">
      <h2 id="social-proof-title" className="mb-5 text-ui-kpi font-semibold tracking-tight">
        {sr.marketing.landing.socialProof}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {approved.map(({ quote, attribution }) => (
          <figure key={quote} className="rounded-xl border border-border bg-surface p-6">
            <blockquote>{quote}</blockquote>
            <figcaption className="mt-2 text-sm text-text-2">{attribution}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
