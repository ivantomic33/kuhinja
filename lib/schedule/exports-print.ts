import { escapeMarkup, getSchedulePreview } from "./exports-preview";
import type { PublicSchedule } from "./types";

const printStyles = `
  @page { size: A4 landscape; margin: 14mm; }
  body { font: 12px system-ui, sans-serif; color: #202023; }
  h1 { font-size: 22px; margin-bottom: 3px; }
  .sp-head strong { display: block; font-size: 22px; }
  .sp-brand, .sp-head svg, .r-rep-avatar { display: none; }
  .sp-head, .r-rep-print-heading { margin-bottom: 14px; }
  p { margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
  th, td { border: 1px solid #c9c9c9; padding: 7px; text-align: right; }
  th[scope=row], th:first-child, .sp-grid th, .sp-grid td { text-align: center; }
  th[scope=row], th:first-child { text-align: left; }
  thead, tfoot, tbody tr:nth-child(even) { background-color: #f3f3f3; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; font-weight: 700; }
  tr { break-inside: avoid; }
  .r-rep-kpis { display: flex; flex-wrap: wrap; gap: 12px 24px; margin-bottom: 12px; }
  .r-rep-kpis strong, .r-rep-details span, .r-rep-details strong { display: block; }
  .sp-grid td[data-code] { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .sp-grid .sp-today { color: #a33d1b; }
  .sp-grid td[data-code=J] { background-color: #dbeafe; }
  .sp-grid td[data-code=P] { background-color: #f3e8ff; }
  .sp-grid td[data-code=N] { background-color: #e0e7ff; }
  .sp-grid td[data-code=D] { background-color: #ccfbf1; }
  .sp-grid td[data-code=X], .sp-grid td[data-code=B], .sp-grid td[data-code=G] { background-color: #f4f4f5; }
`;

export function printScheduleContent(title: string, html: string): boolean {
  document.querySelector("iframe.r-export-print")?.remove();
  const frame = document.createElement("iframe");
  frame.className = "r-export-print";
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;border:0";
  document.body.append(frame);
  const target = frame.contentWindow;
  const printDocument = frame.contentDocument;
  if (!target || !printDocument) {
    frame.remove();
    return false;
  }
  printDocument.documentElement.lang = "sr-Latn";
  printDocument.title = title;
  const style = printDocument.createElement("style");
  style.textContent = printStyles;
  printDocument.head.append(style);
  printDocument.body.innerHTML = html;
  target.addEventListener("afterprint", () => frame.remove(), { once: true });
  try {
    target.print();
    return true;
  } catch {
    frame.remove();
    return false;
  }
}

export function printSchedule(schedule: PublicSchedule): boolean {
  const { title, week, days, rows } = getSchedulePreview(schedule);
  const headings = days.map((day) => `<th scope="col"${day.today ? ' class="sp-today"' : ""}>${escapeMarkup(day.label)}</th>`).join("");
  const body = rows.map((row) => {
    const cells = row.cells.map((cell) => cell ? `<td data-code="${cell.code}">${escapeMarkup(cell.text)}</td>` : "<td></td>").join("");
    return `<tr><th scope="row">${escapeMarkup(row.name)}</th>${cells}</tr>`;
  }).join("");
  return printScheduleContent(`raspored-${schedule.monday}`, `
    <div class="sp-head"><strong>${escapeMarkup(title)}</strong><span>${escapeMarkup(week)}</span></div>
    <table class="sp-grid"><thead><tr><th scope="col">Zaposleni</th>${headings}</tr></thead><tbody>${body}</tbody></table>
  `);
}
