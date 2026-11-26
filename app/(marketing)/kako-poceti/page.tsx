import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteFooterLinks } from "@/components/legal/SiteFooterLinks";
import {
  primaryCtaClass,
  secondaryCtaClass,
  textLinkClass,
  trialHref,
} from "@/components/marketing/landing-links";
import { JsonLd } from "@/components/seo/JsonLd";
import { publicPageMetadata } from "@/lib/seo/metadata";
import { SITE_NAME } from "@/lib/seo/site";
import { sr } from "@/lib/i18n/sr";

export const revalidate = 300;

const copy = sr.onboarding.guide;
const faqItems = sr.marketing.landing.faq;

export const metadata: Metadata = publicPageMetadata(
  copy.title,
  copy.description,
  "/kako-poceti",
);

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

const sectionTitle = "mb-6 text-ui-kpi font-semibold tracking-tight text-text";
const card = "rounded-xl border border-border bg-surface p-5";
const paragraph = "mt-2 text-sm leading-relaxed text-text-2";

export default function KakoPocetiPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <main className="page-gutter mx-auto flex w-full max-w-app flex-col gap-14 pb-10 pt-10 lg:gap-16 lg:pt-16">
        <section aria-labelledby="kako-poceti-title" className="max-w-2xl">
          <p className="mb-3 text-sm font-medium text-accent">{copy.eyebrow}</p>
          <h1
            id="kako-poceti-title"
            className="text-balance text-[clamp(2rem,4vw,3rem)] font-semibold leading-tight tracking-tight text-text"
          >
            {copy.title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-text-2 sm:text-lg">
            {copy.intro}
          </p>
          <div className="mt-6 flex flex-col gap-3 min-[420px]:flex-row">
            <Link href={trialHref} prefetch={false} className={`${primaryCtaClass} gap-2`}>
              {copy.primaryCta}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/premium" className={secondaryCtaClass}>
              {copy.secondaryCta}
            </Link>
          </div>
        </section>

        <section aria-labelledby="steps-title">
          <h2 id="steps-title" className={sectionTitle}>
            {copy.stepsTitle}
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2">
            {copy.steps.map((step, index) => (
              <li key={step.title} className={card}>
                <p className="mb-2 text-sm font-semibold text-accent">
                  {index + 1}.
                </p>
                <h3 className="text-base font-semibold text-text">{step.title}</h3>
                {step.body.map((sentence) => (
                  <p key={sentence} className={paragraph}>
                    {sentence}
                  </p>
                ))}
                <p className="mt-4">
                  <Link href={step.href} prefetch={false} className={textLinkClass}>
                    {step.linkLabel}
                  </Link>
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="glossary-title">
          <h2 id="glossary-title" className={sectionTitle}>
            {copy.glossaryTitle}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {copy.glossary.map((entry) => (
              <div key={entry.term} className={card}>
                <dt className="text-base font-semibold text-text">{entry.term}</dt>
                <dd className={paragraph}>{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="faq-title" className="mx-auto w-full max-w-3xl">
          <h2 id="faq-title" className={`${sectionTitle} text-center`}>
            {copy.faqTitle}
          </h2>
          <div className="flex flex-col gap-3">
            {faqItems.map(({ question, answer }) => (
              <details
                key={question}
                className="group rounded-xl border border-border bg-surface"
              >
                <summary className="focus-ring flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 text-base font-semibold text-text [&::-webkit-details-marker]:hidden">
                  {question}
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{answer}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-text-2">
            {copy.faqMore}{" "}
            <Link href="/faq" className={textLinkClass}>
              {copy.faqLink}
            </Link>
            .
          </p>
        </section>

        <footer className="border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6">
            <p className="text-sm font-semibold">{SITE_NAME}</p>
            <nav aria-label={copy.footerNav} className="flex flex-wrap gap-x-4 text-sm">
              <Link href="/" className={textLinkClass}>
                {copy.footerHome}
              </Link>
              <Link href="/premium" className={textLinkClass}>
                {copy.footerPremium}
              </Link>
              <Link href="/register" prefetch={false} className={textLinkClass}>
                {copy.footerRegister}
              </Link>
            </nav>
          </div>
          <SiteFooterLinks />
        </footer>
      </main>
    </>
  );
}
