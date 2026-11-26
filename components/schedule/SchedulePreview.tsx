import type { CSSProperties } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { APP_NAME } from "@/lib/config/app";
import { shiftColors, type getSchedulePreview } from "@/lib/schedule/exports-preview";
import "./schedule-export.css";

export function SchedulePreview({ preview, titleId, titleAs: Title = "h3" }: {
  preview: ReturnType<typeof getSchedulePreview>;
  titleId: string;
  titleAs?: "h1" | "h3";
}) {
  return (
    <div className="r-share-prev">
      <div className="sp-head">
        <LogoMark className="size-9" />
        <div className="sp-heading">
          <Title className="sp-title" id={titleId}>{preview.title}</Title>
          <span>{preview.week}</span>
        </div>
        <span className="sp-brand">{APP_NAME}</span>
      </div>
      <div className="sp-scroll app-scroll" role="region" aria-labelledby={titleId} tabIndex={0}>
        <table className="sp-grid" aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Zaposleni</span></th>
              {preview.days.map((day) => (
                <th key={day.date} scope="col" className={day.today ? "sp-today" : undefined} aria-current={day.today ? "date" : undefined}>
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, index) => (
              <tr key={`${row.name}-${index}`}>
                <th scope="row" title={row.name}>{row.name}</th>
                {row.cells.map((cell, day) => {
                  const [background, border, text] = cell ? shiftColors[cell.code] : [];
                  const style = cell ? { "--sp-bg": background, "--sp-border": border, "--sp-text": text } as CSSProperties : undefined;
                  return (
                    <td key={preview.days[day].date} data-code={cell?.code} style={style}>
                      {cell ? <><span className="sr-only">{cell.label}</span><span aria-hidden="true">{cell.text}</span></> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
