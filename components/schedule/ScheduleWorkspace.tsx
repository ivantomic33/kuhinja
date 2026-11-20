"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, CreditCard, FileText, Lock, MapPin, MoreHorizontal, Percent, Plus, Printer, Send, Share2, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BentoCard } from "@/components/ui/BentoCard";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiCard } from "@/components/ui/KpiCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { hasMinPlan, planDisplayName, type PlanId } from "@/lib/plan/entitlements";
import { loadScheduleReport, updateSchedule } from "@/lib/schedule/actions";
import type { ScheduleAction } from "@/lib/schemas/schedule";
import { scheduleSharePath } from "@/lib/schedule/exports-preview";
import { printSchedule } from "@/lib/schedule/exports-print";
import { addDays, analyzeWeek, formatHours, shifts, shortDate, weekNumber, weekStart, type ScheduleWarning } from "@/lib/schedule/math";
import type { Assignment, Employee, ScheduleWeek } from "@/lib/schedule/types";
import { cn } from "@/lib/utils/cn";
import { ScheduleGrid } from "./ScheduleGrid";
import { MySchedule, ScheduleRequests } from "./ScheduleTeam";
import "./schedule-workspace.css";

const todayTime = new Intl.DateTimeFormat("sr-Latn-RS", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Belgrade" });
const publishDate = new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "2-digit", timeZone: "Europe/Belgrade" });
const avgHours = new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const templates = ["J", "P", "N", "D"] as const;

type Dialog = { type: "employee"; employee?: Employee } | { type: "location" } | { type: "templates" };

function scheduleHref(location: string, week: string) {
  return `/raspored?${new URLSearchParams({ lokal: location, nedelja: week })}`;
}

function PlanLink() {
  return <Link className="r-outline-link" href="/premium">Pogledaj planove</Link>;
}

function Teaser({ title, plan, text, pills, row }: { title: string; plan: string; text: string; pills: string[]; row?: boolean }) {
  return <div className={cn("lock-teaser r-teaser", row && "r-row")}>
    <span className="r-teaser-icon"><Lock size={18} aria-hidden="true" /></span>
    <div className="r-teaser-copy"><h2>{title} <Badge variant="accent">{plan}</Badge></h2><p>{text}</p>
      <div className="r-pills">{pills.map((pill) => <Badge variant="neutral" key={pill}>{pill}</Badge>)}</div></div>
    <PlanLink />
  </div>;
}

function ScheduleMenu({ label, icon, children }: { label: ReactNode; icon: ReactNode; children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return <details className="r-menu" ref={menu} onKeyDown={(event) => {
    if (event.key === "Escape") { menu.current?.removeAttribute("open"); menu.current?.querySelector("summary")?.focus(); }
  }}>
    <summary className="r-outline-link">{icon}{label}</summary>
    <div className="r-menu-body" onClick={(event) => {
      if ((event.target as HTMLElement).closest("button,a")) {
        menu.current?.removeAttribute("open");
        menu.current?.querySelector("summary")?.focus();
      }
    }}>{children}</div>
  </details>;
}

function WeekNavigation({ data, move, mine, showMine }: {
  data: ScheduleWeek; move: (monday: string) => void;
  mine: boolean; showMine: (mine: boolean) => void;
}) {
  const current = weekStart(data.today);
  const publication = data.publication && new Date(data.publication.publishedAt);
  return <div className="r-toolbar">
    <div className="r-weeknav">
      <button type="button" className="icon-btn bordered" aria-label="Prethodna nedelja" onClick={() => move(addDays(data.monday, -7))}>
        <ChevronLeft size={19} aria-hidden="true" />
      </button>
      <span className="r-week-label"><b>Nedelja {weekNumber(data.monday)}</b><span>· {shortDate(data.monday)}–{shortDate(addDays(data.monday, 6))}</span></span>
      <button type="button" className="icon-btn bordered" aria-label="Sledeća nedelja" onClick={() => move(addDays(data.monday, 7))}>
        <ChevronRight size={19} aria-hidden="true" />
      </button>
      <PrimaryButton variant="ghost" size="sm" disabled={data.monday === current} onClick={() => move(current)}>Danas</PrimaryButton>
    </div>
    <div className="r-tool-right">
      {!mine ? <Badge variant={publication ? "success" : "neutral"}>{publication ? `✓ Objavljeno ${publishDate.format(publication).replaceAll(" ", "")} u ${todayTime.format(publication)}` : "Nacrt · nije objavljen"}</Badge> : null}
      {data.mode === "owner" ? <SegmentedControl ariaLabel="Prikaz rasporeda" value={mine ? "mine" : "boss"} onChange={(mode) => showMine(mode === "mine")}
        options={[
          { value: "boss", label: "Šef", icon: <Users size={16} aria-hidden="true" /> },
          { value: "mine", label: "Moje smene", icon: hasMinPlan(data.plan, "team") ? <UserRound size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" /> },
        ]} /> : null}
    </div>
  </div>;
}

export function ScheduleWorkspace({ data }: { data: ScheduleWeek }) {
  const router = useRouter();
  const { toast } = useToast();
  const [preview, setPreview] = useState(false);
  const [previewEmployeeId, setPreviewEmployeeId] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [focus, setFocus] = useState<{ day: number; employeeId?: string; gap?: "j" | "p"; stamp: number }>();
  const [busy, setBusy] = useState(false);
  const [exportDialog, setExportDialog] = useState<ReactNode>(null);
  const pro = hasMinPlan(data.plan, "pro");
  const team = hasMinPlan(data.plan, "team");
  const business = hasMinPlan(data.plan, "business");
  const month = `${data.today.slice(0, 7)}-01`;
  const mine = data.mode === "employee" || (preview && team);
  const employee = data.employees.find((person) => person.id === previewEmployeeId) ?? data.employees[0];
  const analysis = useMemo(() => mine ? null : analyzeWeek(data.employees, data.assignments, data.monday, pro),
    [mine, data.employees, data.assignments, data.monday, pro]);
  const warningCount = analysis?.warnings.length ?? 0;
  const chips = analysis?.warnings.filter((warning) => warning.chip);

  async function mutate(action: ScheduleAction) {
    const result = await updateSchedule(data.venue.id, data.monday, action);
    if ("error" in result) throw new Error(result.error.message);
    return result.data;
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try { await task(); }
    catch (error) { toast(error instanceof Error ? error.message : "Došlo je do greške.", "danger"); }
    finally { setBusy(false); }
  }

  function upsell(feature: string, plan: PlanId) {
    toast(`${feature}: dostupno od ${planDisplayName(plan)} plana`, { tone: "warning", action: { label: "Planovi", onClick: () => router.push("/premium") } });
  }

  function move(week: string, location = data.venue.id) {
    setFocus(undefined);
    router.push(scheduleHref(location, week), { scroll: false });
  }

  function focusWarning(warning: ScheduleWarning) {
    setFocus({ day: warning.day, employeeId: warning.employeeId, gap: warning.gap, stamp: Date.now() });
  }

  function copyWeek() {
    void run(async () => {
      const { token } = await mutate({ type: "copy" });
      toast(`Kopirana nedelja ${weekNumber(addDays(data.monday, -7))} u nedelju ${weekNumber(data.monday)}`, {
        action: token ? { label: "Poništi", onClick: () => void run(async () => { await mutate({ type: "undo", token }); }) } : undefined,
      });
    });
  }

  function publish() {
    void run(async () => {
      const { notified } = await mutate({ type: "publish" });
      toast(`Raspored objavljen${pro && warningCount ? ` uz ${warningCount} upozorenja` : ""} · ${notified ?? 0} zaposlenih obavešteno`, pro && warningCount ? "warning" : "success");
    });
  }

  function openShare() {
    void run(async () => {
      const [{ ScheduleShare }, { token, preview }] = await Promise.all([
        import("./ScheduleShare"),
        mutate({ type: "share" }),
      ]);
      if (!token || !preview) throw new Error("Link nije napravljen. Pokušaj ponovo.");
      const url = `${window.location.origin}${scheduleSharePath(preview.venueName, preview.monday, token)}`;
      setExportDialog(<ScheduleShare open onClose={() => setExportDialog(null)} url={url} schedule={preview} />);
    });
  }

  function openReport() {
    if (!business) { upsell("Mesečni izveštaj sati", "business"); return; }
    void run(async () => {
      const [{ ScheduleReport }, reportResult] = await Promise.all([
        import("./ScheduleReport"),
        loadScheduleReport(data.venue.id, month),
      ]);
      if ("error" in reportResult) throw new Error(reportResult.error.message);
      setExportDialog(
        <ScheduleReport
          open
          onClose={() => setExportDialog(null)}
          venueName={data.venue.name}
          month={month}
          {...reportResult.data}
        />
      );
    });
  }

  function printWeek() {
    const printed = printSchedule({
      venueName: data.venue.name,
      monday: data.monday,
      employees: data.employees.map(({ id, full_name }) => {
        const names = full_name.trim().split(/\s+/);
        return { id, full_name: names.length > 1 ? `${names[0]} ${names.at(-1)?.[0]}.` : names[0] };
      }),
      assignments: data.assignments,
    });
    if (!printed) toast("Štampa nije dostupna.", "danger");
  }

  async function saveAssignment(assignment: Assignment | null, employeeId: string, date: string) {
    await mutate({ type: "assignment", employee_id: employeeId, date, code: assignment?.code ?? null,
      custom_start: assignment?.custom_start?.slice(0, 5) ?? null, custom_end: assignment?.custom_end?.slice(0, 5) ?? null });
  }

  const weekNav = <WeekNavigation data={data} move={move} mine={mine} showMine={(show) => {
    if (show && !team) upsell("Pogled zaposlenog", "team"); else setPreview(show);
  }} />;

  return <section className="screen r-screen" id="s-raspored">
    <div id="rRoot">
      <header className="page-head r-header">
        <div><h1 className="app-h1">{mine ? "Moje smene" : "Raspored"}</h1>
          {mine ? <p>{[employee?.full_name, employee?.role, data.venue.name].filter(Boolean).join(" · ")}</p>
            : <p>Ko radi koju smenu ove nedelje.<span className="r-sub-desk"> Klikni na polje da dodeliš smenu.</span></p>}
        </div>
        {!mine ? <div className="actions r-actions">
          {business ? <div className="r-loc-btn"><ScheduleMenu label={<>{data.venue.name}<ChevronDown size={15} aria-hidden="true" /></>} icon={<MapPin size={17} aria-hidden="true" />}>
            {data.locations.map((location) => <button type="button" key={location.id} onClick={() => {
              move(data.monday, location.id); toast(`Lokal: ${location.name}`);
            }}><MapPin size={15} aria-hidden="true" /><span>{location.name}<small>{location.employeeCount} zap.</small></span>{location.id === data.venue.id ? "✓" : null}</button>)}
            <hr /><button type="button" onClick={() => setDialog({ type: "location" })}><Plus size={16} /> Dodaj lokal</button>
          </ScheduleMenu></div> : null}
          <ScheduleMenu label="Više" icon={<MoreHorizontal size={18} aria-hidden="true" />}>
            <button type="button" disabled={busy} onClick={copyWeek}><Copy size={16} /> Kopiraj prošlu nedelju</button>
            <button type="button" onClick={printWeek}><Printer size={16} /> Štampaj / PDF</button>
            <hr /><button type="button" disabled={busy} onClick={openReport}><FileText size={16} /> Mesečni izveštaj sati {!business ? <Locked plan="Business" /> : null}</button>
            <button type="button" onClick={() => setDialog({ type: "templates" })}><Clock3 size={16} /> Šabloni smena</button>
          </ScheduleMenu>
          <PrimaryButton variant="secondary" aria-label="Podeli" disabled={busy} leftIcon={<Share2 aria-hidden="true" />} onClick={openShare}><span className="r-share-label">Podeli</span></PrimaryButton>
          <PrimaryButton className="r-publish" leftIcon={<Send aria-hidden="true" />} disabled={busy} onClick={publish}>Objavi raspored</PrimaryButton>
        </div> : null}
      </header>

      {!analysis ? <>
        {weekNav}
        {preview && data.mode === "owner" && data.employees.length > 1 ? <label className="r-preview-select">Zaposleni <select className="field-control" value={employee?.id} onChange={(event) => setPreviewEmployeeId(event.target.value)}>
          {data.employees.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
        </select></label> : null}
        <MySchedule key={`${employee?.id}:${data.monday}`} data={data.mode === "employee" ? data : { ...data, requests: data.requests.filter((item) => item.employee_id === employee?.id) }} employee={employee} onRequest={async (action) => { await mutate(action); toast("Zahtev poslat šefu"); }} />
      </> : <>
        <div className="usage-strip r-usage">
          <Badge variant="accent">{planDisplayName(data.plan)}</Badge>
          <span>Zaposleni: <b>{data.employees.length} · bez limita</b></span>
          {business ? <span>{data.locations.length} lokala</span> : null}
        </div>
        {chips?.length ? <div className="chips r-chips"><b className="attn-label">Zahteva pažnju</b>
          {chips.map((warning) => <button type="button" key={warning.id} className={cn("chip", warning.level)} onClick={() => focusWarning(warning)}><span className="dot" aria-hidden="true" />{warning.chip}</button>)}
        </div> : null}

        <div className="r-kpi-slot">{pro ? <div className="r-kpis">
          <KpiCard label="Sati ove nedelje" value={formatHours(analysis.hours)} suffix="h" icon={<Clock3 />} hint={`${data.employees.length} zaposlenih · prosek ${avgHours.format(data.employees.length ? analysis.hours / data.employees.length : 0)} h`} />
          <KpiCard label="Trošak rada" value={formatHours(analysis.cost)} suffix="din" icon={<CreditCard />} hint="satnica × sati" />
          <KpiCard label="Rad u prometu" value="—" icon={<Percent />} hint={<span className="r-fcpair">Food cost <b>—</b> · Zajedno <b>—</b></span>} />
          <KpiCard label="Upozorenja" value={warningCount} icon={<AlertTriangle />} hint={warningCount ? "objavljivanje nije blokirano" : "sve u redu"} className={warningCount ? "kpi-warnc" : undefined} />
        </div> : <Teaser title="Trošak rada i upozorenja" plan="Pro" row text="Trošak rada uz food cost i upozorenja za rupe, preklapanja i odmor kraći od 11 h." pills={["Trošak rada", "Upozorenja"]} />}</div>

        <div className="r-week-card">
          {weekNav}
          {!data.employees.length ? <EmptyState title="Nema zaposlenih u rasporedu."
            actionLabel="Dodaj zaposlenog" onAction={() => setDialog({ type: "employee" })} />
            : !data.assignments.length ? <EmptyState title="Nedelja je prazna."
                action={<PrimaryButton variant="secondary" disabled={busy} onClick={copyWeek}>Kopiraj prošlu nedelju</PrimaryButton>} />
            : null}
          <ScheduleGrid monday={data.monday} today={data.today} employees={data.employees} assignments={data.assignments} analysis={analysis} showPro={pro}
            onAddEmployee={() => setDialog({ type: "employee" })} onEditEmployee={(employee) => setDialog({ type: "employee", employee })}
            onSave={saveAssignment} focus={focus} />
        </div>

        <div className="r-bottom">
          {pro ? <BentoCard header={<div className="r-panel-head"><h2>Upozorenja <span className="count-pill">{warningCount}</span></h2><p>Rupe, preklapanja, odmor i slobodni dani</p></div>}>
            {warningCount ? <ul className="r-panel-list">{analysis.warnings.map((warning) => <li key={warning.id}>
              <button type="button" className={cn("r-witem", warning.level)} onClick={() => focusWarning(warning)}>
                <AlertTriangle size={19} aria-hidden="true" /><span><b>{warning.title}</b><small>{warning.text}</small></span><Badge variant={warning.level === "danger" ? "danger" : "warning"}>{warning.tag}</Badge>
              </button></li>)}</ul> : <p className="r-empty">Nema upozorenja za ovu nedelju.</p>}
            <p className="r-wnote">ⓘ Upozorenja ne blokiraju objavu. Ti odlučuješ.</p>
          </BentoCard> : null}
          {team ? <ScheduleRequests requests={data.requests} dates={Array.from({ length: 7 }, (_, day) => addDays(data.monday, day))} pending={busy}
            onDecide={(request, status) => void run(async () => { await mutate({ type: "decide", id: request.id, status });
              toast(`${status === "odobreno" ? "Odobreno" : "Odbijeno"} · ${request.employee_name.split(/\s+/)[0]} je obavešten`); })} />
            : <Teaser title="Zahtevi i zamene" plan="Team" text="Zaposleni vide svoje smene na telefonu, traže slobodan dan ili zamenu, a ti odobriš jednim klikom." pills={["Moje smene", "Zamene", "Odobri jednim klikom"]} />}
          {!business ? <Teaser title="Više lokala i izveštaj za knjigovođu" plan="Business" row={pro} text="Prebacuj se između lokala i izvezi mesečni zbir sati, noćnog rada, bolovanja i godišnjih za knjigovođu." pills={["Više lokala", "Mesečni izveštaj", "Izvoz"]} /> : null}
        </div>
      </>}
      {dialog?.type === "templates" ? <BottomSheet open title="Šabloni smena" onClose={() => setDialog(null)}>
        <div className="rp-tpls">{templates.map((code) => <div key={code} className={cn("r-cell", shifts[code].className)}>{shifts[code].name} <small>{shifts[code].time}</small></div>)}</div>
      </BottomSheet> : dialog ? <ScheduleSetupSheet dialog={dialog} pro={pro} team={team} onClose={() => setDialog(null)}
        onSave={async (action) => { const { id } = await mutate(action); if (action.type === "location" && id) move(data.monday, id); }} /> : null}
      {exportDialog}
    </div>
  </section>;
}

function Locked({ plan }: { plan: string }) {
  return <span className="mm-lock"><Lock size={12} aria-hidden="true" /> {plan}</span>;
}

function ScheduleSetupSheet({ dialog, pro, team, onClose, onSave }: {
  dialog: Exclude<Dialog, { type: "templates" }>; pro: boolean; team: boolean; onClose: () => void;
  onSave: (action: Extract<ScheduleAction, { type: "employee" | "location" }>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const employee = dialog.type === "employee" ? dialog.employee : undefined;
  const title = dialog.type === "location" ? "Dodaj lokal" : employee ? "Izmeni zaposlenog" : "Dodaj zaposlenog";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const rate = form.get("rate");
    setError(""); setSaving(true);
    try {
      if (dialog.type === "location") await onSave({ type: "location", name: String(form.get("name")) });
      else await onSave({ type: "employee", id: employee?.id, full_name: String(form.get("name")), role: String(form.get("role")),
        hourly_rate_rsd: rate ? Number(rate) : null, login_email: form.get("email") ? String(form.get("email")) : null });
      onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Promena nije sačuvana. Pokušaj ponovo."); }
    finally { setSaving(false); }
  }

  return <BottomSheet open title={title} onClose={() => { if (!saving) onClose(); }}>
    <form className="r-form" onSubmit={(event) => void submit(event)}>
      <label>{dialog.type === "location" ? "Naziv lokala" : "Ime i prezime"}<input className="field-control" name="name" required maxLength={120} defaultValue={employee?.full_name} /></label>
      {dialog.type === "employee" ? <>
        <label>Uloga<input className="field-control" name="role" required maxLength={100} defaultValue={employee?.role} /></label>
        {pro ? <label>Satnica (din/h)<input className="field-control" name="rate" type="number" min="0" max="99999999" step="0.01" defaultValue={employee?.hourly_rate_rsd ?? undefined} /></label> : null}
        {team ? <label>Imejl za prijavu<input className="field-control" name="email" type="email" maxLength={254} defaultValue={employee?.login_email ?? undefined} /></label> : null}
      </> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="r-form-actions"><PrimaryButton variant="ghost" disabled={saving} onClick={onClose}>Otkaži</PrimaryButton><PrimaryButton type="submit" loading={saving}>Sačuvaj</PrimaryButton></div>
    </form>
  </BottomSheet>;
}
