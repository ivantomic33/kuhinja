"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown, Clock, Minus, Plus, Sun, Thermometer, Trash2, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { assignmentTime, dayLong, dayShort, shifts, shortDate } from "@/lib/schedule/math";
import type { Assignment, Employee, ShiftCode, TemplateCode } from "@/lib/schedule/types";

const templates: TemplateCode[] = ["J", "P", "N", "D"];
const statuses = { O: Minus, B: Thermometer, G: Sun };
const statusCodes = ["O", "B", "G"] as const;

export type CellWarning = { text: string; level: "warn" | "danger"; tag: string };

export function employeeInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join("").toLocaleUpperCase("sr-RS");
}

export function assignmentDescription(assignment?: Assignment) {
  if (!assignment) return "Nije dodeljeno";
  const time = assignmentTime(assignment);
  return [shifts[assignment.code].name, time].filter(Boolean).join(" ");
}

type SaveShift = (assignment: Assignment | null, employeeId: string, date: string) => Promise<void>;

type Overlay = {
  date: string;
  day: number;
} & (
  | { employee: Employee; assignment?: Assignment; warnings: CellWarning[]; anchor: HTMLButtonElement }
  | { gap: "j" | "p"; employees: Employee[] }
);

const desktopQuery = "(min-width: 720px)";

export function ScheduleEditor({
  overlay,
  onClose,
  onSave,
}: {
  overlay: Overlay;
  onClose: () => void;
  onSave: SaveShift;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; custom: boolean }>();
  const fieldId = useId();
  const pending = useRef(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia(desktopQuery).matches);
  const assignment = "employee" in overlay ? overlay.assignment : undefined;
  const [custom, setCustom] = useState(assignment?.code === "X");
  const [start, setStart] = useState(assignment?.custom_start?.slice(0, 5) ?? "09:00");
  const [end, setEnd] = useState(assignment?.custom_end?.slice(0, 5) ?? "17:00");
  const close = () => { if (!pending.current) onClose(); };

  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  async function save(employeeId: string, code?: ShiftCode) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(undefined);
    const date = overlay.date;
    try {
      await onSave(code ? {
        employee_id: employeeId,
        date,
        code,
        custom_start: code === "X" ? start : null,
        custom_end: code === "X" ? end : null,
      } : null, employeeId, date);
      onClose();
    } catch (failure) {
      setError({ message: failure instanceof Error && failure.message ? failure.message : "Smena nije sačuvana.", custom: code === "X" });
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const feedback = error ? <p id={`${fieldId}-error`} className="rp-error" role="alert">{error.message}</p> : null;

  if ("gap" in overlay) {
    const code = overlay.gap === "j" ? "J" : "P";
    const shift = shifts[code];
    return (
      <BottomSheet id="rSheet" open title={`Dodaj u ${shift.name}`} description={`${dayLong[overlay.day]} ${shortDate(overlay.date)} · ${shift.time}`} onClose={close}>
        <p className="rp-label">Slobodni taj dan</p>
        {feedback}
        <div className="r-picker" aria-busy={saving}>
          {overlay.employees.map(employee => (
            <button type="button" className="r-pick" key={employee.id} disabled={saving} onClick={() => void save(employee.id, code)}>
              <span className="r-av" aria-hidden="true">{employeeInitials(employee.full_name)}</span>
              <span className="r-person"><b>{employee.full_name}</b><small>{employee.role}</small></span>
              <Plus size={16} aria-hidden="true" />
            </button>
          ))}
          {!overlay.employees.length && <p className="r-empty">Niko nije slobodan.</p>}
        </div>
      </BottomSheet>
    );
  }

  const { employee, warnings } = overlay;
  const title = employee.full_name;
  const anchored = desktop && overlay.anchor.getClientRects().length > 0;
  const description = `${(anchored ? dayShort : dayLong)[overlay.day]} ${shortDate(overlay.date)} · ${assignmentDescription(assignment)}`;
  const body = (
    <>
      {warnings.map(({ text, level }) => (
        <p className={`rp-warn ${level}`} key={text}><AlertTriangle size={15} aria-hidden="true" />{text}</p>
      ))}
      {feedback}
      <fieldset className="rp-fields" disabled={saving} aria-busy={saving}>
        <legend className="rp-label">Šabloni smene</legend>
        <div className="rp-tpls">
          {templates.map(code => {
            const isCurrent = assignment?.code === code;
            const shift = shifts[code];
            return (
              <button key={code} type="button" className={`r-cell ${shift.className}${isCurrent ? " cur" : ""}`} aria-pressed={isCurrent} onClick={() => void save(employee.id, code)}>
                <span className="n">{shift.name}</span><span className="t">{shift.time}</span>
                {isCurrent && <Check className="ck" size={14} aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <button type="button" className="rp-opt" aria-expanded={custom} onClick={() => setCustom(!custom)}>
          <Clock size={16} aria-hidden="true" />Prilagodi vreme<ChevronDown size={16} aria-hidden="true" />
        </button>
        {custom && (
          <form className="rp-custom" aria-describedby={error?.custom ? `${fieldId}-error` : undefined} onSubmit={event => { event.preventDefault(); void save(employee.id, "X"); }}>
            <label htmlFor={`${fieldId}-start`}>Od<input id={`${fieldId}-start`} type="time" step={1800} required value={start} onChange={event => setStart(event.target.value)} /></label>
            <label htmlFor={`${fieldId}-end`}>Do<input id={`${fieldId}-end`} type="time" step={1800} required value={end} onChange={event => setEnd(event.target.value)} /></label>
            <PrimaryButton variant="secondary" type="submit" loading={saving}>Primeni</PrimaryButton>
          </form>
        )}
        <div className="rp-abs">
          {statusCodes.map(code => {
            const Icon = statuses[code];
            const isCurrent = assignment?.code === code;
            return (
              <button key={code} type="button" className={`r-cell ${shifts[code].className}${isCurrent ? " cur" : ""}`} aria-pressed={isCurrent} onClick={() => void save(employee.id, code)}>
                <Icon size={15} aria-hidden="true" />{shifts[code].name}
              </button>
            );
          })}
        </div>
        {assignment && (
          <PrimaryButton variant="ghost" className="rp-remove" leftIcon={<Trash2 aria-hidden="true" />} onClick={() => void save(employee.id)}>
            Ukloni iz rasporeda
          </PrimaryButton>
        )}
      </fieldset>
    </>
  );

  return anchored ? (
    <EditorPopover anchor={overlay.anchor} title={title} description={description} onClose={close} saving={saving}>{body}</EditorPopover>
  ) : (
    <BottomSheet id="rSheet" open title={title} description={description} onClose={close}>{body}</BottomSheet>
  );
}

function EditorPopover({
  anchor,
  title,
  description,
  onClose,
  saving,
  children,
}: {
  anchor: HTMLButtonElement;
  title: string;
  description: string;
  onClose: () => void;
  saving: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  close.current = onClose;
  useDialogFocus({ open: true, onClose, panelRef: ref, returnFocusTo: anchor, lockScroll: false });

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const margin = 8;
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const above = rect.top - panel.offsetHeight - margin;
      const below = rect.bottom + margin;
      panel.style.left = `${Math.max(margin, Math.min(rect.left, window.innerWidth - panel.offsetWidth - margin))}px`;
      panel.style.top = `${Math.max(margin, Math.min(
        below + panel.offsetHeight <= window.innerHeight ? below : above,
        window.innerHeight - panel.offsetHeight - margin,
      ))}px`;
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    update();

    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.contains(event.target) && !anchor.contains(event.target)) close.current();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  return createPortal(
    <div id="rPop" className="r-pop" ref={ref} role="dialog" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
      <div className="rp-head">
        <div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div>
        <button type="button" className="icon-btn" aria-label="Zatvori" disabled={saving} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
}
