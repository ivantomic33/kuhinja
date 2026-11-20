"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, Check, Repeat2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BentoCard } from "@/components/ui/BentoCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import type { ScheduleAction } from "@/lib/schemas/schedule";
import { analyzeWeek, assignmentHours, assignmentTime, dayLong, dayShort, formatHours, shifts, shortDate, weekDates, weekNumber } from "@/lib/schedule/math";
import type { Assignment, Employee, ScheduleRequest, ScheduleWeek } from "@/lib/schedule/types";
import { cn } from "@/lib/utils/cn";

const requestLabels = { slobodan: "Slobodan dan", zamena: "Zamena", promena: "Promena smene" };
const requestActions = { slobodan: "Zatraži slobodan dan", zamena: "Zatraži zamenu" };
const statusLabels = { novo: "Čeka odobrenje", odobreno: "Odobreno", odbijeno: "Odbijeno" };
const statusVariants = { novo: "warning", odobreno: "success", odbijeno: "neutral" } as const;

function showShift(assignment?: Assignment | null) {
  if (!assignment) return "—";
  const time = assignmentTime(assignment);
  return `${shifts[assignment.code].name}${time ? ` · ${time}` : ""}`;
}

function displayRequestDate(date: string, days: string[], full = false) {
  return `${(full ? dayLong : dayShort)[days.indexOf(date)]} ${shortDate(date)}`;
}

export function ScheduleRequests({ requests, dates, pending, onDecide }: {
  requests: ScheduleRequest[];
  dates: string[];
  pending: boolean;
  onDecide: (request: ScheduleRequest, status: "odobreno" | "odbijeno") => void;
}) {
  return (
    <BentoCard header={<div className="r-panel-head"><h2>Zahtevi <span className="count-pill">{requests.filter((item) => item.status === "novo").length}</span></h2><p>Slobodni dani i zamene od zaposlenih</p></div>}>
      {requests.length === 0 ? <p className="r-empty">Još nema zahteva.</p> : (
        <ul className="r-panel-list">
          {requests.map((request) => {
            const title = request.with_employee_name ? `${request.employee_name} → ${request.with_employee_name}` : request.employee_name;
            const change = request.to_template_code ? ` → ${shifts[request.to_template_code].name} ${shifts[request.to_template_code].time}` : "";
            return (
              <li className="r-req" key={request.id}>
                <span className="r-team-avatar" aria-hidden="true">{title.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>
                <div className="r-req-copy">
                  <b>{title} <span>{requestLabels[request.type]}</span></b>
                  <p>{displayRequestDate(request.date, dates)} · {request.type === "slobodan" ? "umesto " : ""}{showShift(request.source)}{change}</p>
                  {request.note ? <q>{request.note}</q> : null}
                </div>
                {request.status === "novo" ? <div className="r-req-actions">
                  <PrimaryButton variant="ghost" size="sm" disabled={pending} onClick={() => onDecide(request, "odbijeno")}>Odbij</PrimaryButton>
                  <PrimaryButton variant="secondary" size="sm" leftIcon={<Check />} disabled={pending} onClick={() => onDecide(request, "odobreno")}>Odobri</PrimaryButton>
                </div> : <Badge variant={statusVariants[request.status]}>{statusLabels[request.status]}</Badge>}
              </li>
            );
          })}
        </ul>
      )}
    </BentoCard>
  );
}

export function MySchedule({ data, employee, onRequest }: {
  data: ScheduleWeek;
  employee?: Employee;
  onRequest: (action: Extract<ScheduleAction, { type: "request" }>) => Promise<void>;
}) {
  const [requestType, setRequestType] = useState<keyof typeof requestActions | null>(null);
  const dates = weekDates(data.monday);
  const own = data.publication ? (data.publishedAssignments ?? data.assignments).filter((item) => item.employee_id === employee?.id) : [];
  const { hours, warnings } = analyzeWeek(employee ? [employee] : [], own, data.monday);
  const upcoming = own.filter((item) => item.date >= data.today && assignmentHours(item) > 0).sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  const mine = data.mode === "employee";

  return (
    <div className="r-my">
      <BentoCard header={<div className="r-panel-head"><h2>Moja nedelja <span className="count-pill">{formatHours(hours)} h</span></h2>
        <p>Nedelja {weekNumber(data.monday)} · {shortDate(dates[0])}–{shortDate(dates[6])}{data.publication?.publisherName ? ` · objavio ${data.publication.publisherName}` : ""}</p></div>}>
        <div className="r-myweek">
          {dates.map((date, day) => {
            const assignment = own.find((item) => item.date === date);
            const worked = assignment ? assignmentHours(assignment) : 0;
            const messages = warnings.filter((warning) => warning.employeeId === employee?.id)
              .flatMap((warning) => (warning.cellMessages ?? []).filter((message) => message.day === day)
                .map((message) => ({ ...message, level: warning.level, id: warning.id })));
            return <div className={cn("r-myday", date === data.today && "today")} key={date}>
              <span><b>{dayLong[day]}</b><small>{date === data.today ? "· danas" : shortDate(date)}</small></span>
              <span className={cn("r-cell", assignment ? shifts[assignment.code].className : "empty")}>{showShift(assignment)}</span>
              <b>{worked ? `${formatHours(worked)} h` : "—"}</b>
              {messages.map((message) => <small className={cn("r-mywarn", message.level)} key={message.id}>{message.text}</small>)}
            </div>;
          })}
        </div>
      </BentoCard>
      <BentoCard>
        <div className="r-next">
          <h2>Sledeća smena</h2>
          <strong>{next ? displayRequestDate(next.date, dates, true) : "Nema smena ove nedelje"}</strong>
          {next ? <p>{showShift(next)} · {data.venue.name}</p> : null}
        </div>
        {mine ? <div className="r-myactions">
          <PrimaryButton variant="secondary" disabled={!upcoming.length} leftIcon={<CalendarDays />} onClick={() => setRequestType("slobodan")}>{requestActions.slobodan}</PrimaryButton>
          <PrimaryButton variant="secondary" disabled={!upcoming.length || !data.coworkers.length} leftIcon={<Repeat2 />} onClick={() => setRequestType("zamena")}>{requestActions.zamena}</PrimaryButton>
        </div> : null}
        {mine && data.notifications.length ? <ul className="r-notifications" aria-live="polite">
          {data.notifications.map((item) => <li key={item.id}>
            <Badge variant={item.kind === "odbijeno" ? "neutral" : "success"}>{item.kind === "published" ? "Raspored objavljen" : statusLabels[item.kind]}</Badge>
            {item.monday !== data.monday ? <Link className="text-accent" href={`/raspored?${new URLSearchParams({ lokal: data.venue.id, nedelja: item.monday })}`}>Nedelja {weekNumber(item.monday)}</Link> : null}
            <span>{new Intl.DateTimeFormat("sr-Latn-RS", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Belgrade" }).format(new Date(item.created_at))}</span>
          </li>)}
        </ul> : null}
        <div className="r-panel-head"><h2>Moji zahtevi <span className="count-pill">{data.requests.length}</span></h2></div>
        {data.requests.length ? <ul className="r-panel-list">
          {data.requests.map((request) => <li className="r-myreq" key={request.id}>
            <span><b>{requestLabels[request.type]} · {displayRequestDate(request.date, dates)}</b><small>poslato {shortDate(request.created_at.slice(0, 10))}</small></span>
            <Badge variant={statusVariants[request.status]}>{statusLabels[request.status]}</Badge>
          </li>)}
        </ul> : <p className="r-empty">Još nema zahteva.</p>}
      </BentoCard>
      {requestType ? <RequestSheet type={requestType} dates={dates} upcoming={upcoming} coworkers={data.coworkers} onSave={onRequest} onClose={() => setRequestType(null)} /> : null}
    </div>
  );
}

function RequestSheet({ type, dates, upcoming, coworkers, onSave, onClose }: {
  type: keyof typeof requestActions;
  dates: string[];
  upcoming: Assignment[];
  coworkers: ScheduleWeek["coworkers"];
  onSave: (action: Extract<ScheduleAction, { type: "request" }>) => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await onSave({ type: "request", requestType: type, date: String(form.get("day")),
        with_employee_id: type === "zamena" ? String(form.get("coworker")) : null,
        note: String(form.get("note") ?? "") });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Zahtev nije poslat.");
    } finally {
      setPending(false);
    }
  }

  return <BottomSheet open title={requestActions[type]} description="Šef dobija zahtev i odobrava jednim klikom." onClose={() => { if (!pending) onClose(); }}>
    <form className="r-form" onSubmit={(event) => void submit(event)}>
      <fieldset className="r-form"><legend className="rp-label">Koji dan</legend>
        {upcoming.map((shift, index) => <label className="r-pick" key={shift.date}>
          <input type="radio" name="day" value={shift.date} defaultChecked={index === 0} required />
          <span><b>{displayRequestDate(shift.date, dates, true)}</b><small>{showShift(shift)}</small></span>
        </label>)}
      </fieldset>
      {type === "zamena" ? <label>Ko te menja<select className="field-control" name="coworker" required>
        {coworkers.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
      </select></label> : null}
      <label>Poruka šefu (nije obavezno)<textarea className="field-control" name="note" placeholder="npr. porodična obaveza" maxLength={500} /></label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="r-form-actions"><PrimaryButton variant="ghost" disabled={pending} onClick={onClose}>Otkaži</PrimaryButton>
        <PrimaryButton type="submit" loading={pending}>Pošalji zahtev</PrimaryButton></div>
    </form>
  </BottomSheet>;
}
