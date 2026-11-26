import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import KakoPocetiPage from "@/app/(marketing)/kako-poceti/page";
import { sr } from "@/lib/i18n/sr";

it("renders the public guide with steps, glossary, landing FAQ, and FAQPage JSON-LD", () => {
  const html = renderToStaticMarkup(createElement(KakoPocetiPage));
  const copy = sr.onboarding.guide;

  expect(html).toContain(copy.title);
  expect(copy.steps.map((step) => step.title)).toEqual([
    "Napravi nalog",
    "Dodaj sastojke",
    "Napravi recept",
    "Pročitaj trošak porcije",
    "Vodi zalihe i smene",
  ]);
  for (const step of copy.steps) {
    expect(step.body.length).toBeGreaterThan(0);
    expect(step.body.length).toBeLessThanOrEqual(3);
    expect(html).toContain(step.title);
    expect(html).toContain(`href="${step.href}"`);
  }

  expect(copy.glossary.map((entry) => entry.term)).toEqual([
    "Sastojak",
    "Nabavna cena",
    "Porcija",
    "Trošak porcije",
    "Otpad",
    "Skaliranje",
    "Zaliha",
    "Smena",
  ]);
  for (const entry of copy.glossary) {
    expect(html).toContain(entry.term);
    expect(html).toContain(entry.definition);
  }

  for (const { question, answer } of sr.marketing.landing.faq) {
    expect(html).toContain(question);
    expect(html).toContain(answer);
  }

  expect(html).toContain('"@type":"FAQPage"');
  expect(html).not.toMatch(/\b(Supabase|PWA|API|sinhronizacija|cache|server)\b/i);
});
