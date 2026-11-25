import Link from "next/link";
import type { LegalPageContent } from "@/lib/legal/documents";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { sr } from "@/lib/i18n/sr";
import { LegalPageHeader } from "@/components/legal/LegalPageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSiteUrl } from "@/lib/seo/site";

type LegalDocumentProps = {
  doc: LegalPageContent;
};

export function LegalDocument({ doc }: LegalDocumentProps) {
  const page = LEGAL_VERSIONS[doc.id];
  const origin = getSiteUrl();
  return (
    <article className="mx-auto w-full max-w-3xl">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Početna", item: new URL("/", origin).href },
          { "@type": "ListItem", position: 2, name: page.title, item: new URL(page.path, origin).href },
        ],
      }} />
      <LegalPageHeader page={page} />

      <nav
        aria-label={sr.legal.tocLabel}
        className="mb-10 rounded-xl border border-border bg-surface p-4"
      >
        <p className="mb-3 text-sm font-semibold text-text">{sr.legal.tocLabel}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          {doc.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-muted underline-offset-2 hover:text-text hover:underline"
              >
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-4 text-sm leading-relaxed text-muted">
        {doc.intro.map((paragraph) => (
          <p key={paragraph.slice(0, 48)}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-10 space-y-10">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`heading-${section.id}`} className="scroll-mt-28">
            <h2 id={`heading-${section.id}`} className="mb-3 text-xl font-semibold text-text">
              {section.title}
            </h2>
            <div className="space-y-3 text-sm leading-relaxed text-muted">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 64)}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 border-t border-border pt-6">
        <p className="mb-3 text-sm font-semibold text-text">{sr.legal.related}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {(
            [
              LEGAL_VERSIONS.terms,
              LEGAL_VERSIONS.privacy,
              LEGAL_VERSIONS.refund,
            ] as const
          )
            .filter((item) => item.path !== page.path)
            .map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className="text-muted underline-offset-2 hover:text-text hover:underline"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          <li>
            <Link
              href="/faq"
              className="text-muted underline-offset-2 hover:text-text hover:underline"
            >
              FAQ
            </Link>
          </li>
        </ul>
      </footer>
    </article>
  );
}
