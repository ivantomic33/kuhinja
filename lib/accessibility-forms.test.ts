import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { AuthField } from "@/components/auth/AuthField";
import { DataTable } from "@/components/ui/DataTable";

it("gives repeated form fields unique visible labels and error descriptions", () => {
  const html = renderToStaticMarkup(
    createElement("div", null,
      createElement(AuthField, { name: "name", label: "Ime", error: "Unesite ime." }),
      createElement(AuthField, { name: "name", label: "Naziv", error: "Unesite naziv." }),
    ),
  );

  const inputs = [...html.matchAll(/<input[^>]*\sid="([^"]+)"[^>]*>/g)];
  expect(inputs).toHaveLength(2);
  expect(new Set(inputs.map((match) => match[1])).size).toBe(2);
  for (const [input, id] of inputs) {
    expect(html).toContain(`for="${id}"`);
    expect(input).toContain(`aria-describedby="${id}-error"`);
    expect(html).toContain(`id="${id}-error" aria-live="polite"`);
  }
});

it("shows associated labels for sorting and selecting table rows", () => {
  const Table = DataTable<{ id: string; name: string }>;
  const html = renderToStaticMarkup(createElement(Table, {
    columns: [{
      id: "name",
      header: "Naziv",
      cell: (row) => row.name,
      compare: (left, right) => left.name.localeCompare(right.name),
    }],
    rows: [{ id: "pepper", name: "Paprika" }],
    rowKey: (row) => row.id,
    rowLabel: (row) => row.name,
    selectable: true,
    stacked: true,
  }));

  const controls = [...html.matchAll(/<(?:input|select)[^>]*\sid="([^"]+)"/g)];
  expect(controls).toHaveLength(3);
  for (const [, id] of controls) {
    expect(html).toContain(`for="${id}"`);
  }
  expect(html).toContain(">Sortiranje<");
  expect(html).toContain(">Sve<");
  expect(html).toContain(">Izaberi<");
});
