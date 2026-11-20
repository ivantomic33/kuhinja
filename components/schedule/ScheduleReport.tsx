"use client";

import { useMemo, useRef } from "react";
import { Download, FileText, Send } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { downloadScheduleFile } from "@/lib/schedule/exports-browser";
import { printScheduleContent } from "@/lib/schedule/exports-print";
import { workbookBlob } from "@/lib/schedule/exports-workbook";
import { formatHours, getMonthlyReport, shortDate } from "@/lib/schedule/math";
import type { Assignment, Employee } from "@/lib/schedule/types";
import { formatMoney } from "@/lib/utils/format";
import "./schedule-export.css";

const title = "Mesečni izveštaj sati";
const detail = "Prekovremeno i noćni rad uračunati sa +26%.";
const headers = ["Sati", "Prekovr.", "Noćni", "Bolovanje", "Godišnji", "Trošak"];
const exportHeaders = ["Zaposleni", "Uloga", "Satnica (din/h)", "Sati (h)", "Prekovremeno (h)", "Noćni rad (h)", "Bolovanje (d)", "Godišnji (d)", "Trošak (din)"];
const monthFormatter = new Intl.DateTimeFormat("sr-Latn-RS", { month: "long", timeZone: "UTC" });

type ScheduleReportProps = {
  open: boolean;
  onClose: () => void;
  venueName: string;
  month: string;
  employees: Employee[];
  assignments: Assignment[];
};

type ReportTotals = ReturnType<typeof getMonthlyReport>["totals"];

function values(row: ReportTotals) {
  return [row.hours, row.overtime, row.night, row.sick, row.leave, row.cost];
}

function ReportCells({ row }: { row: ReportTotals }) {
  return values(row).map((value, index) => {
    const text = index < 3 ? `${formatHours(value)} h` : index < 5 ? `${value} d` : `${formatMoney(value)} din`;
    return <td className={value ? undefined : "r-rep-zero"} key={headers[index]}>{value ? text : "—"}</td>;
  });
}

export function ScheduleReport({ open, onClose, venueName, month, employees, assignments }: ScheduleReportProps) {
  const { toast } = useToast();
  const content = useRef<HTMLDivElement>(null);
  const monthKey = month.slice(0, 7);
  const [year, monthNumber] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  const lastDate = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  const monthLabel = monthFormatter.format(date);
  const period = `${monthLabel[0].toLocaleUpperCase("sr-Latn-RS")}${monthLabel.slice(1)} ${year}`;
  const description = `${period} · ${venueName} · ${shortDate(`${monthKey}-01`)}–${shortDate(lastDate)}`;
  const filename = `sati-${monthLabel}-${year}`;
  const { rows, totals } = useMemo(() => getMonthlyReport(employees, assignments), [employees, assignments]);
  const count = `Ukupno · ${rows.length} zaposlenih`;

  function saveExcel() {
    downloadScheduleFile(workbookBlob([
      [title],
      [description],
      exportHeaders,
      ...rows.map(({ employee, ...row }) => [employee.full_name, employee.role, employee.hourly_rate_rsd, ...values(row)]),
      [count, null, null, ...values(totals)],
      [detail],
    ]), `${filename}.xlsx`);
  }

  function printPdf() {
    if (!content.current || !printScheduleContent(filename, content.current.innerHTML)) toast("Štampanje nije dostupno.", "danger");
  }

  function prepareMail() {
    const subject = encodeURIComponent(`${title} · ${period} · ${venueName}`);
    const body = encodeURIComponent(`Poštovani,\r\n\r\nPrilažem mesečni izveštaj sati za ${venueName} (${period}).\r\n\r\nPrilog: ${filename}.xlsx`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  const hourKpis = [
    { label: "Ukupno sati", value: totals.hours },
    { label: "Prekovremeno", value: totals.overtime },
    { label: "Noćni rad", value: totals.night },
  ];

  return (
    <BottomSheet
      id="rReportModal"
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      className="r-report-modal"
      footer={
        <div className="r-export-actions">
          <PrimaryButton variant="secondary" onClick={saveExcel} leftIcon={<Download aria-hidden="true" />}>Excel</PrimaryButton>
          <PrimaryButton variant="secondary" onClick={printPdf} leftIcon={<FileText aria-hidden="true" />}>PDF</PrimaryButton>
          <PrimaryButton onClick={prepareMail} leftIcon={<Send aria-hidden="true" />}>Pošalji knjigovođi</PrimaryButton>
        </div>
      }
    >
      <div ref={content}>
        <div className="r-rep-print-heading hidden">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="r-rep-kpis">
          {hourKpis.map(({ label, value }) => (
            <div key={label} className="fc-kpi"><span>{label}</span><strong>{value ? <>{formatHours(value)} <small>h</small></> : "—"}</strong></div>
          ))}
          <div className="fc-kpi"><span>Bruto trošak rada</span><strong>{totals.cost ? <>{formatMoney(totals.cost)} <small>din</small></> : "—"}</strong></div>
        </div>
        <div className="r-rep-scroll mise-scroll" role="region" aria-label={title} tabIndex={0}>
          <table className="tbl r-rep">
            <thead><tr><th scope="col">Zaposleni</th>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee.id}>
                  <th scope="row">
                    <div className="r-rep-person">
                      <span className="r-rep-avatar" aria-hidden="true">{row.employee.full_name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("sr-Latn-RS")}</span>
                      <span className="r-rep-details">
                        <strong>{row.employee.full_name}</strong>
                        <span>{row.employee.role} · {row.employee.hourly_rate_rsd === null ? "—" : `${formatMoney(row.employee.hourly_rate_rsd)} din/h`}</span>
                      </span>
                    </div>
                  </th>
                  <ReportCells row={row} />
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">{count}</th><ReportCells row={totals} /></tr></tfoot>
          </table>
        </div>
        <p className="r-rep-note">{detail}</p>
      </div>
    </BottomSheet>
  );
}
