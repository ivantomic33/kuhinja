import { APP_NAME } from "@/lib/config/app";
import icons from "@/lib/config/pwa-icons.json";
import { tokens } from "@/lib/design/tokens";
import { getSchedulePreview, shiftColors } from "./exports-preview";
import type { PublicSchedule } from "./types";

export function downloadScheduleFile(file: Blob, filename: string) {
  const href = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export async function createSchedulePng(schedule: PublicSchedule): Promise<Blob> {
  const { title, week, days, rows } = getSchedulePreview(schedule);
  const canvas = document.createElement("canvas");
  const padding = 30;
  const employeeWidth = 186;
  const rowHeight = 46;
  const gap = 6;
  canvas.width = 1200;
  canvas.height = 126 + rowHeight * (rows.length + 1);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  context.fillStyle = tokens.surface;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const logo = new Image();
  logo.src = icons.svg;
  await logo.decode();
  context.drawImage(logo, padding, padding, 50, 50);

  const right = canvas.width - padding;
  context.textBaseline = "middle";
  context.font = "700 28px Inter, system-ui, sans-serif";
  context.fillStyle = tokens.text;
  context.fillText(title, 94, 46, right - 205);
  context.font = "18px Inter, system-ui, sans-serif";
  context.fillStyle = tokens.text2;
  context.fillText(week, 94, 74);
  context.textAlign = "right";
  context.fillText(APP_NAME, right, 46);

  const columnWidth = (canvas.width - 2 * padding - employeeWidth - 7 * gap) / 7;
  const columnLeft = (index: number) => padding + employeeWidth + gap + index * (columnWidth + gap);
  context.textAlign = "center";
  context.font = "600 18px Inter, system-ui, sans-serif";
  days.forEach((day, index) => {
    context.fillStyle = day.today ? tokens.accent : tokens.text2;
    context.fillText(day.label, columnLeft(index) + columnWidth / 2, 107);
  });

  rows.forEach((row, index) => {
    const top = 127 + index * rowHeight;
    const middle = top + (rowHeight - gap) / 2;
    context.fillStyle = tokens.text;
    context.textAlign = "left";
    context.fillText(row.name, padding + 8, middle, employeeWidth - 16);
    context.textAlign = "center";
    row.cells.forEach((cell, column) => {
      const [background, border, color] = cell
        ? shiftColors[cell.code]
        : ["transparent", tokens.border, tokens.text];
      const left = columnLeft(column);
      context.beginPath();
      context.roundRect(left, top, columnWidth, rowHeight - gap, 7);
      context.fillStyle = background;
      context.fill();
      context.strokeStyle = border;
      context.setLineDash(cell?.code === "O" || !cell ? [4, 4] : []);
      context.stroke();
      if (cell) {
        context.fillStyle = color;
        context.fillText(cell.text, left + columnWidth / 2, middle, columnWidth - 10);
      }
    });
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG unavailable")), "image/png");
  });
}
