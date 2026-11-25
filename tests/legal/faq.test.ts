import { expect, it } from "vitest";
import { searchFaqItems } from "@/content/faq";

it("matches questions and answers without Serbian diacritics, including đ", () => {
  expect(searchFaqItems("  otkazuje  ").map(({ id }) => id)).toContain("cancel");
  expect(searchFaqItems("brise nalog").map(({ id }) => id)).toContain("delete-account");
  expect(searchFaqItems("uredjaju").map(({ id }) => id)).toContain("sign-out-cache");
  expect(searchFaqItems("uredaju").map(({ id }) => id)).toContain("sign-out-cache");
});

it("can find pending changes lost on logout and restrict matches by category", () => {
  expect(searchFaqItems("nesinhronizovane", "Offline i PWA").map(({ id }) => id)).toContain("sign-out-pending");
  expect(searchFaqItems("nesinhronizovane", "Paketi i cene")).toEqual([]);
});
