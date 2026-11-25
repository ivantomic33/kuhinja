import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SchedulePreview } from "@/components/schedule/SchedulePreview";
import { getSchedulePreview } from "./exports-preview";
import {
  PUBLIC_ASSIGNMENT_KEYS,
  PUBLIC_EMPLOYEE_KEYS,
  PUBLIC_SCHEDULE_ROOT_KEYS,
  parsePublicSchedule,
  publicScheduleJson,
  publicShareHasForbiddenKeys,
} from "./public-payload";
import type { PublicSchedule } from "./types";

const cleanSchedule: PublicSchedule = {
  venueName: "Dorćol",
  monday: "2026-11-16",
  employees: [{ id: "e1", full_name: "Ana P." }],
  assignments: [
    {
      employee_id: "e1",
      date: "2026-11-16",
      code: "N",
      custom_start: null,
      custom_end: null,
    },
  ],
};

it("documents the public /r/ whitelist (venue name, people, shifts only)", () => {
  expect(PUBLIC_SCHEDULE_ROOT_KEYS).toEqual([
    "venueName",
    "monday",
    "employees",
    "assignments",
  ]);
  expect(PUBLIC_EMPLOYEE_KEYS).toEqual(["id", "full_name"]);
  expect(PUBLIC_ASSIGNMENT_KEYS).toEqual([
    "employee_id",
    "date",
    "code",
    "custom_start",
    "custom_end",
  ]);
});

it("accepts a whitelisted public schedule and rejects price/cost business fields", () => {
  expect(parsePublicSchedule(cleanSchedule)).toEqual(cleanSchedule);
  expect(publicShareHasForbiddenKeys(cleanSchedule)).toBe(false);

  const dirty = {
    ...cleanSchedule,
    selling_price: 1200,
    cost_per_portion: 340,
    margin: 0.4,
    supplier: "Metro",
    internal_notes: "secret",
    venue_id: "venue-1",
    location_id: "loc-1",
    employees: [
      {
        id: "e1",
        full_name: "Ana P.",
        hourly_rate_rsd: 800,
        role: "kuvar",
        login_email: "ana@example.com",
      },
    ],
  };

  expect(publicShareHasForbiddenKeys(dirty)).toBe(true);
  expect(parsePublicSchedule(dirty)).toBeNull();
  expect(parsePublicSchedule(null)).toBeNull();
  expect(parsePublicSchedule({ venueName: "X" })).toBeNull();
});

it("public HTML and JSON contain no price or cost fields", () => {
  const preview = getSchedulePreview(cleanSchedule, "2026-11-16");
  const html = renderToStaticMarkup(
    createElement(SchedulePreview, {
      preview,
      titleId: "public-preview",
    }),
  );
  const json = publicScheduleJson(cleanSchedule);

  for (const blob of [html, json, JSON.stringify(preview)]) {
    expect(blob.toLowerCase()).not.toMatch(
      /price|cost|margin|supplier|hourly|venue_id|location_id/,
    );
  }
  expect(html).toContain("Ana P.");
  expect(html).toContain("Raspored · Dorćol");
});

it("treats a revoked or empty public payload as missing (page will 404)", () => {
  expect(parsePublicSchedule(null)).toBeNull();
  expect(parsePublicSchedule(undefined)).toBeNull();
});
