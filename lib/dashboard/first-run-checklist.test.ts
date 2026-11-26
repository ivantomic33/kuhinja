/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  FirstRunChecklist,
  type FirstRunChecklistStep,
} from "@/components/dashboard/FirstRunChecklist";
import { sr } from "@/lib/i18n/sr";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => createElement("a", { href, ...props }, children),
}));

const DISMISS_KEY = "treuplate:onboarding-dismissed";

const openSteps: FirstRunChecklistStep[] = [
  { id: "ingredient", title: "Dodaj sastojak", hint: "hint-1", href: "/ingredients", done: true },
  { id: "price", title: "Unesi nabavnu cenu", hint: "hint-2", href: "/ingredients", done: true },
  { id: "recipe", title: "Napravi recept", hint: "hint-3", href: "/recipes", done: false },
  { id: "cost", title: "Pročitaj trošak porcije", hint: "hint-4", href: "/recipes", done: false },
];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

it("renders when nothing is dismissed and at least one step is open", async () => {
  render(createElement(FirstRunChecklist, { steps: openSteps }));

  expect(await screen.findByText(sr.onboarding.checklist.title)).toBeTruthy();
  expect(screen.getByText(openSteps[2]!.title)).toBeTruthy();
});

it("sets progressbar aria-valuenow to the percentage of done steps", async () => {
  render(createElement(FirstRunChecklist, { steps: openSteps }));

  const bar = await screen.findByRole("progressbar");
  // 2 of 4 done → 50
  expect(bar.getAttribute("aria-valuenow")).toBe("50");
});

it("hides on dismiss and writes treuplate:onboarding-dismissed = 1", async () => {
  render(createElement(FirstRunChecklist, { steps: openSteps }));

  const dismiss = await screen.findByRole("button", {
    name: sr.onboarding.checklist.dismissAria,
  });
  fireEvent.click(dismiss);

  await waitFor(() => {
    expect(screen.queryByText(sr.onboarding.checklist.title)).toBeNull();
  });
  expect(localStorage.getItem(DISMISS_KEY)).toBe("1");
});

it("does not render when all steps are done", async () => {
  const doneSteps = openSteps.map((step) => ({ ...step, done: true }));
  const { container } = render(createElement(FirstRunChecklist, { steps: doneSteps }));

  await waitFor(() => {
    expect(container.innerHTML).toBe("");
  });
  expect(screen.queryByText(sr.onboarding.checklist.title)).toBeNull();
});

it("does not crash when localStorage.getItem throws", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });

  render(createElement(FirstRunChecklist, { steps: openSteps }));

  expect(await screen.findByText(sr.onboarding.checklist.title)).toBeTruthy();
});
