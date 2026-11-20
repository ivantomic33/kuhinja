"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent, type MouseEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ChevronRight, Plus, Sun, Thermometer, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { analyzeWeek, assignmentTime, dayLong, dayShort, formatHours, shifts, shortDate, weekDates, type ScheduleWarning } from "@/lib/schedule/math";
import type { Assignment, Employee, ShiftCode } from "@/lib/schedule/types";
import { assignmentDescription, employeeInitials, ScheduleEditor, type CellWarning } from "./ScheduleEditor";
import "./schedule-grid.css";

const shiftsByGroup: ShiftCode[] = ["J", "D", "X", "P", "N"];
const legend: ShiftCode[] = ["J", "P", "N", "D", "O"];
const slots = [
  { key: "j", code: "J", label: "Ujutru" },
  { key: "p", code: "P", label: "Uveče" },
  { key: "n", code: "N", label: "" },
] as const;
const modes = [{ value: "shift", label: "Po smeni" }, { value: "employee", label: "Po zaposlenom" }] as const;
const number = new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 2 });
const noWarnings: ScheduleWarning[] = [];

type Gap = "j" | "p";
type Focus = { day: number; employeeId?: string; gap?: Gap; stamp: number };
type EditorTarget = { day: number; anchor: HTMLButtonElement } & (
  | { employee: Employee }
  | { gap: Gap }
);
type Hint = { anchor: HTMLElement; warnings: CellWarning[] };

type Props = {
  monday: string;
  today: string;
  employees: Employee[];
  assignments: Assignment[];
  analysis: ReturnType<typeof analyzeWeek>;
  showPro: boolean;
  onAddEmployee: () => void;
  onEditEmployee?: (employee: Employee) => void;
  onSave: (assignment: Assignment | null, employeeId: string, date: string) => Promise<void>;
  focus?: Focus;
};

function cellWarnings(warnings: ScheduleWarning[], day: number): CellWarning[] {
  return warnings.flatMap(warning => (warning.cellMessages ?? []).filter(message => message.day === day)
    .map(({ text }) => ({ text, level: warning.level, tag: warning.tag })));
}

function warningLevel(warnings: CellWarning[]) {
  if (warnings.some(warning => warning.level === "danger")) return "danger";
  return warnings.length ? "warn" : undefined;
}

function targetName(day: number, employeeId?: string, gap?: Gap) {
  if (employeeId) return day === -1 ? `employee:${employeeId}` : `cell:${employeeId}:${day}`;
  return `gap:${day}:${gap ?? ""}`;
}

function visibleTarget(grid: HTMLDivElement | null, match: (name: string) => boolean) {
  return Array.from(grid?.querySelectorAll<HTMLElement>("[data-r-target]") ?? [])
    .find(element => match(element.dataset.rTarget ?? "") && element.getClientRects().length > 0);
}

export function ScheduleGrid(props: Props) {
  return <WeekGrid key={props.monday} {...props} />;
}

function WeekGrid({
  monday, today, employees, assignments, analysis, showPro, onAddEmployee, onEditEmployee, onSave, focus,
}: Props) {
  const dates = useMemo(() => weekDates(monday), [monday]);
  const [day, setDay] = useState(() => Math.max(0, dates.indexOf(today)));
  const [mode, setMode] = useState<"shift" | "employee">("shift");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const saving = useRef(false);
  const { toast } = useToast();
  const warnings = showPro ? analysis.warnings : noWarnings;
  const warningsByEmployee = useMemo(() => {
    const grouped = new Map<string, ScheduleWarning[]>();
    for (const warning of warnings) {
      if (!warning.employeeId) continue;
      const list = grouped.get(warning.employeeId);
      if (list) list.push(warning);
      else grouped.set(warning.employeeId, [warning]);
    }
    return grouped;
  }, [warnings]);
  const byCell = useMemo(() => new Map(assignments.map(assignment => [`${assignment.employee_id}:${assignment.date}`, assignment])), [assignments]);
  const getAssignment = (employee: Employee, index: number) => byCell.get(`${employee.id}:${dates[index]}`);
  const gapWarnings = warnings.filter(warning => warning.gap);
  const dayRows = employees.map(employee => ({ employee, assignment: getAssignment(employee, day) }));

  useEffect(() => {
    if (!focus) return;
    const { day, employeeId, gap } = focus;
    if (day >= 0 && day < 7) setDay(day);
    setMode(employeeId && day < 0 ? "employee" : "shift");
    const frame = requestAnimationFrame(() => {
      const target = targetName(day, employeeId, gap);
      const element = visibleTarget(grid.current, name => name === target || (!employeeId && !gap && name.startsWith(target)));
      if (!element) return;
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
      element.focus({ preventScroll: true });
      element.classList.remove("flash");
      void element.offsetWidth;
      element.classList.add("flash");
    });
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  function openEditor(event: MouseEvent<HTMLButtonElement>, employee: Employee, day: number) {
    if (saving.current) return;
    setHint(null);
    setEditor({ day, employee, anchor: event.currentTarget });
  }

  async function saveAndWarn(assignment: Assignment | null, employeeId: string, date: string) {
    saving.current = true;
    try {
      await onSave(assignment, employeeId, date);
    } finally {
      saving.current = false;
    }
    const day = dates.indexOf(date);
    if (editor) {
      requestAnimationFrame(() => {
        if (editor.anchor.isConnected) return;
        const element = visibleTarget(grid.current, name => name === targetName(day, employeeId));
        element?.scrollIntoView({ block: "nearest" });
        element?.focus({ preventScroll: true });
      });
    }
    if (!showPro) return;
    const employee = employees.find(item => item.id === employeeId);
    if (!employee) return;
    const next = assignments.filter(item => item.employee_id === employeeId && item.date !== date);
    if (assignment) next.push(assignment);
    const [warning] = cellWarnings(analyzeWeek([employee], next, monday).warnings, day);
    if (warning) toast(warning.text, "warning");
  }

  function hintProps(messages: CellWarning[]) {
    if (!messages.length) return {};
    return {
      "aria-description": messages.map(message => message.text).join(". "),
      onPointerEnter: (event: PointerEvent<HTMLElement>) => setHint({ anchor: event.currentTarget, warnings: messages }),
      onPointerLeave: () => setHint(null),
      onFocus: (event: FocusEvent<HTMLElement>) => setHint({ anchor: event.currentTarget, warnings: messages }),
      onBlur: () => setHint(null),
    };
  }

  function employeeName(employee: Employee) {
    const content = <EmployeeIdentity employee={employee} />;
    return onEditEmployee ? (
      <button type="button" className="r-emp r-emp-edit" aria-haspopup="dialog" aria-label={`Izmeni zaposlenog · ${employee.full_name}`}
        onClick={() => { if (!saving.current) onEditEmployee(employee); }}>
        {content}
      </button>
    ) : <span className="r-emp">{content}</span>;
  }

  function employeeChips(codes: Array<ShiftCode | undefined>, label: string) {
    const rows = dayRows.filter(row => codes.includes(row.assignment?.code));
    if (!rows.length) return null;
    return (
      <div className="r-m-names">
        <h3>{label}</h3>
        <div className="r-names">
          {rows.map(({ employee, assignment }) => (
            <button key={employee.id} type="button" className={`r-name ${assignment ? shifts[assignment.code].className : "empty"}`} data-r-target={targetName(day, employee.id)} aria-haspopup="dialog"
              aria-label={`${employee.full_name} · ${dayLong[day]} ${shortDate(dates[day])} · ${assignmentDescription(assignment)}`}
              onClick={event => openEditor(event, employee, day)}>
              {employee.full_name.trim().split(/\s+/)[0]}
              {assignment?.code === "B" && <><span aria-hidden="true">·</span><Thermometer size={14} aria-hidden="true" />Bolovanje</>}
              {assignment?.code === "G" && <><span aria-hidden="true">·</span><Sun size={14} aria-hidden="true" />Godišnji</>}
              {!assignment && <Plus size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const overlay = editor && ("employee" in editor ? {
    ...editor,
    date: dates[editor.day],
    assignment: getAssignment(editor.employee, editor.day),
    warnings: cellWarnings(warningsByEmployee.get(editor.employee.id) ?? noWarnings, editor.day),
  } : {
    ...editor,
    date: dates[editor.day],
    employees: employees.filter(employee => {
      const code = getAssignment(employee, editor.day)?.code;
      return code === undefined || code === "O";
    }),
  });

  const addEmployee = (
    <PrimaryButton variant="ghost" aria-haspopup="dialog" leftIcon={<Plus aria-hidden="true" />}
      onClick={() => { if (!saving.current) onAddEmployee(); }}>Dodaj zaposlenog</PrimaryButton>
  );

  return (
    <div ref={grid} className="r-schedule-grid">
      <div className="r-desktop">
        <div className="r-grid-wrap mise-scroll">
          <table className="r-grid">
            <thead>
              <tr>
                <th scope="col" className="r-sticky">Zaposleni</th>
                {dates.map((date, index) => (
                  <th scope="col" key={date} className={date === today ? "today" : undefined}>
                    <span className="r-dh">
                      <b>{dayShort[index]}{date === today && <em> · Danas</em>}</b>
                      <span>{shortDate(date)}</span>
                    </span>
                  </th>
                ))}
                <th scope="col" className="c-sum">Sati</th>
              </tr>
            </thead>
            <tbody>
              {analysis.employees.map(({ employee, hours, cost }) => {
                const employeeWarnings = warningsByEmployee.get(employee.id) ?? noWarnings;
                const rowWarnings = employeeWarnings.flatMap(warning => warning.rowMessage
                  ? [{ text: warning.rowMessage, level: warning.level, tag: warning.tag }] : []);
                return (
                  <tr key={employee.id}>
                    <th scope="row" className="r-sticky">
                      <div className="r-emp-heading">
                        {employeeName(employee)}
                        {!!rowWarnings.length && (
                          <span className="r-row-warning" tabIndex={0} data-r-target={targetName(-1, employee.id)} {...hintProps(rowWarnings)}>
                            <AlertTriangle size={15} aria-hidden="true" /><span className="sr-only">Upozorenja</span>
                          </span>
                        )}
                      </div>
                    </th>
                    {dates.map((date, index) => {
                      const assignment = getAssignment(employee, index);
                      const messages = cellWarnings(employeeWarnings, index);
                      const level = warningLevel(messages);
                      const WarningIcon = level === "danger" ? X : AlertTriangle;
                      return (
                        <td key={date} className={date === today ? "today" : undefined}>
                          <button type="button" className={`r-cell ${assignment ? shifts[assignment.code].className : "empty"}${level ? ` w-${level}` : ""}`}
                            data-r-target={targetName(index, employee.id)}
                            aria-haspopup="dialog"
                            aria-label={`${employee.full_name} · ${dayLong[index]} ${shortDate(date)} · ${assignmentDescription(assignment)}`}
                            onClick={event => openEditor(event, employee, index)} {...hintProps(messages)}>
                            <ShiftCellContent assignment={assignment} />
                            {level && <span className="wdot"><WarningIcon size={12} aria-hidden="true" /></span>}
                          </button>
                        </td>
                      );
                    })}
                    <td className="c-sum"><Hours hours={hours} cost={showPro ? cost : undefined} overtime={showPro && hours > 48} /></td>
                  </tr>
                );
              })}
              <tr className="r-addrow">
                <td colSpan={9}>{addEmployee}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="r-sticky">
                  <b>Pokrivenost</b><small>ljudi po smeni</small>
                </th>
                {dates.map((date, index) => (
                  <td key={date} className={date === today ? "today" : undefined}>
                    <div className="r-covs">
                      {slots.map(({ key, code, label }) => {
                        const count = analysis.coverage[index][key];
                        const gap = key !== "n" && gapWarnings.some(warning => warning.day === index && warning.gap === key);
                        if (key === "n" && !count) return null;
                        if (gap) return (
                          <span key={key} className="r-gap" tabIndex={0}
                            data-r-target={targetName(index, undefined, key)}
                            {...hintProps([{ text: `${dayLong[index]} ${label.toLocaleLowerCase("sr-RS")}: niko nije u smeni`, level: "danger", tag: "Rupa" }])}>
                            {label} 0
                          </span>
                        );
                        return (
                          <span key={key} className={`r-cov${count === 0 ? " zero" : ""}`}>
                            <span className={`r-sw ${shifts[code].className}`} />{shifts[code].name}<b>{count}</b>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                ))}
                <td className="c-sum"><Hours hours={analysis.hours} cost={showPro ? analysis.cost : undefined} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="r-foot"><Legend times /></div>
      </div>

      <div className="r-mobile">
        {mode === "shift" && <div className="r-days" role="group" aria-label="Dan u nedelji">
          {dates.map((date, index) => {
            const dailyWarnings = warnings.filter(warning => warning.day === index || warning.cellMessages?.some(message => message.day === index));
            const hasGap = dailyWarnings.some(warning => warning.gap);
            return (
              <button type="button" key={date} className={`${day === index ? "on" : ""}${date === today ? " today" : ""}`}
                aria-pressed={day === index} aria-current={date === today ? "date" : undefined}
                aria-label={`${dayLong[index]} ${shortDate(date)}${hasGap ? " · Rupa" : dailyWarnings.length ? " · Upozorenja" : ""}`}
                onClick={() => setDay(index)}>
                {dayShort[index]} <b>{date.slice(8)}.</b>
                {!!dailyWarnings.length && <span className={`gd${hasGap ? "" : " warn"}`} aria-hidden="true" />}
              </button>
            );
          })}
        </div>}
        <SegmentedControl className="r-m-mode" options={modes} value={mode} onChange={setMode} ariaLabel="Prikaz rasporeda" />
        {mode === "shift" ? (
          <div className="r-m-cards">
            {gapWarnings.filter(warning => warning.day === day).map(({ id, gap }) => {
              if (!gap) return null;
              const shift = shifts[gap === "j" ? "J" : "P"];
              return (
                <section className="r-scard gap" key={id}>
                  <header>
                    <b>{shift.name}</b><span>{shift.time}</span>
                    <span className="r-gap">{gap === "j" ? "Ujutru" : "Uveče"} 0</span>
                  </header>
                  <div className="r-gap-body">Niko nije u smeni.
                    <PrimaryButton variant="secondary" aria-haspopup="dialog" aria-label={`Dodaj u ${shift.name}`}
                      data-r-target={targetName(day, undefined, gap)} leftIcon={<Plus aria-hidden="true" />}
                      onClick={event => setEditor({ day, gap, anchor: event.currentTarget })}>Dodaj</PrimaryButton>
                  </div>
                </section>
              );
            })}
            {shiftsByGroup.map(code => {
              const rows = dayRows.filter(row => row.assignment?.code === code);
              if (!rows.length) return null;
              const shift = shifts[code];
              return (
                <section key={code} className={`r-scard ${shift.className}`}>
                  <header><span className={`r-sw ${shift.className}`} /><b>{shift.name}</b><span>{shift.time}</span><Badge>{rows.length}</Badge></header>
                  {rows.map(({ employee, assignment }) => {
                    const messages = cellWarnings(warningsByEmployee.get(employee.id) ?? noWarnings, day);
                    const level = warningLevel(messages);
                    const warning = messages.find(message => message.level === level);
                    return (
                      <button key={employee.id} type="button" className="r-prow" data-r-target={targetName(day, employee.id)} aria-haspopup="dialog"
                        onClick={event => openEditor(event, employee, day)}>
                        <EmployeeIdentity employee={employee} detail={assignment && assignmentTime(assignment)} />
                        {warning && <span className={`wb ${level}`}>{warning.tag}</span>}
                        <ChevronRight size={16} aria-hidden="true" />
                      </button>
                    );
                  })}
                </section>
              );
            })}
            {employeeChips(["B", "G"], "Odsutni")}
            {employeeChips(["O"], "Slobodni")}
            {employeeChips([undefined], "Nije dodeljeno")}
          </div>
        ) : (
          <div className="r-m-cards">
            <Legend />
            {analysis.employees.map(({ employee, hours, cost }) => {
              const messages = warningsByEmployee.get(employee.id) ?? noWarnings;
              const level = messages.some(warning => warning.level === "danger") ? "d" : messages.length ? "w" : "";
              return (
                <article className={`r-pcard ${level}`} key={employee.id} data-r-target={targetName(-1, employee.id)} tabIndex={messages.length ? -1 : undefined}>
                  <header>{employeeName(employee)}<Hours hours={hours} cost={showPro ? cost : undefined} overtime={showPro && hours > 48} /></header>
                  <div className="r-bars">
                    {dates.map((date, index) => {
                      const assignment = getAssignment(employee, index);
                      return (
                        <button type="button" className={date === today ? "today" : undefined} key={date}
                          aria-haspopup="dialog"
                          aria-label={`${employee.full_name} · ${dayLong[index]} ${shortDate(date)} · ${assignmentDescription(assignment)}`}
                          onClick={event => openEditor(event, employee, index)}>
                          <span className={`bar ${assignment ? shifts[assignment.code].className : "empty"}`} />
                          {dayShort[index].charAt(0)}
                        </button>
                      );
                    })}
                  </div>
                  {!!messages.length && (
                    <p className="r-pline">{messages.flatMap(warning => warning.rowMessage ?? warning.cellMessages?.map(message => message.text) ?? []).join(" · ")}</p>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {addEmployee}
      </div>
      {hint && !editor && <WarningTooltip hint={hint} />}
      {overlay && <ScheduleEditor key={`${overlay.day}:${"employee" in overlay ? overlay.employee.id : overlay.gap}`} overlay={overlay}
        onClose={() => setEditor(current => current === editor ? null : current)} onSave={saveAndWarn} />}
    </div>
  );
}

function EmployeeIdentity({ employee, detail }: { employee: Employee; detail?: string }) {
  return (
    <>
      <span className="r-av" aria-hidden="true">{employeeInitials(employee.full_name)}</span>
      <span className="r-person"><b>{employee.full_name}</b><small>{[employee.role, detail].filter(Boolean).join(" · ")}</small></span>
    </>
  );
}

function Hours({ hours, cost, overtime }: { hours: number; cost?: number; overtime?: boolean }) {
  return (
    <span className={`r-sum${overtime ? " warn" : ""}`}>
      <b>{formatHours(hours)} h</b>
      {overtime && <small className="r-overtime">preko 48 h</small>}
      {cost !== undefined && <small>{number.format(cost)} din</small>}
    </span>
  );
}

function Legend({ times = false }: { times?: boolean }) {
  return (
    <div className="r-legend">
      {legend.map(code => (
        <span key={code}><i className={`r-sw ${shifts[code].className}`} aria-hidden="true" />{shifts[code].name}{times && shifts[code].time && ` ${shifts[code].time}`}</span>
      ))}
    </div>
  );
}

function ShiftCellContent({ assignment }: { assignment?: Assignment }) {
  if (!assignment) return <Plus size={16} aria-hidden="true" />;
  if (assignment.code === "X") return <><span className="n">{assignmentTime(assignment)}</span><span className="t">prilagođeno</span></>;
  const shift = shifts[assignment.code];
  return (
    <>
      <span className="n">
        {assignment.code === "B" && <Thermometer size={13} aria-hidden="true" />}
        {assignment.code === "G" && <Sun size={13} aria-hidden="true" />}
        {shift.name}
      </span>
      {shift.time && <span className="t">{shift.time}</span>}
    </>
  );
}

function WarningTooltip({ hint }: { hint: Hint }) {
  const rect = hint.anchor.getBoundingClientRect();
  const above = rect.top > 110;
  return createPortal(
    <div id="rTip" className={`r-tip${above ? " above" : ""}`} aria-hidden="true"
      style={{ left: Math.max(8, Math.min(rect.left, window.innerWidth - 278)), top: above ? rect.top - 8 : rect.bottom + 8 }}>
      {hint.warnings.map(warning => <span className={`ln ${warning.level}`} key={warning.text}>{warning.text}</span>)}
    </div>,
    document.body,
  );
}
