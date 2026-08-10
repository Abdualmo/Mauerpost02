// Jahresbericht — eine Ansicht INNERHALB der App.
//
// Bewusst keine zweite Datei und kein zweites Fenster: der Bericht ist eine
// Overlay-Ansicht, die aus denselben Daten und denselben Bausteinen gebaut
// wird wie die Mitarbeiterakte. Kalender und Eintragsliste sind wörtlich
// dieselben Komponenten (YearCalendar, EntryList) — dadurch kann der Bericht
// gar nicht erst von der App abweichen.

import { useEffect, useMemo } from "react";
import { X, Printer } from "lucide-react";
import {
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_SONDERURLAUB,
  TYPE_URLAUB,
  birthdayISO as birthdayForYear,
  collectYearEntries,
  computeYearStats,
  getGermanHolidays,
  sonderurlaubUsageByReason,
} from "../../lib/vacation.js";
import { fmtDate, todayISO } from "../../lib/date.js";
import YearCalendar from "./YearCalendar.jsx";
import EntryList from "./EntryList.jsx";

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const COLOR = {
  [TYPE_URLAUB]: "#C8A96B",
  [TYPE_SONDERURLAUB]: "#4A90E2",
  [TYPE_BETRIEBSURLAUB]: "#5E9EA0",
  [TYPE_KRANKHEIT]: "#D64545",
};

function fmtNumDE(n) {
  if (n == null || Number.isNaN(n)) return "0";
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

function fmtDaysDE(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return `${fmtNumDE(v)} ${v === 1 || v === -1 ? "Tag" : "Tage"}`;
}

function labelEmploymentType(v) {
  const map = {
    vollzeit: "Vollzeit",
    teilzeit: "Teilzeit",
    minijob: "Minijob",
    werkstudent: "Werkstudent",
    azubi: "Azubi",
    sonstige: "Sonstige",
  };
  return map[v] || v || "—";
}

// "Mo, Mi, Fr" — Altdatensätze ohne Arbeitstage gelten als volle Woche.
function labelWorkDays(employee) {
  const days = employee?.workDays;
  if (!Array.isArray(days) || days.length === 0) return "Mo – Fr (Standard)";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d - 1])
    .filter(Boolean)
    .join(", ");
}

function Section({ title, children }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-[11px] uppercase tracking-[0.14em] text-gold-dark font-semibold pb-1.5 mb-3 border-b border-black/10">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, value, danger }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-black/45">
        {label}
      </div>
      <div className={`text-[15px] ${danger ? "text-red-sick" : ""}`}>{value}</div>
    </div>
  );
}

function BalanceRow({ label, note, value, strong, total, negative }) {
  return (
    <tr className={total ? "bg-gold-softest" : ""}>
      <td
        className={`py-2 border-b border-black/10 ${total ? "border-y-2 border-y-gold text-base" : ""} ${
          strong || total ? "font-semibold" : ""
        }`}
      >
        {label}
        {note && <span className="ml-2 text-xs font-normal text-black/45">{note}</span>}
      </td>
      <td
        className={`py-2 text-right tabular-nums whitespace-nowrap border-b border-black/10 ${
          total ? "border-y-2 border-y-gold text-base" : ""
        } ${strong || total ? "font-semibold" : ""} ${negative ? "text-red-sick" : ""}`}
      >
        {value}
      </td>
    </tr>
  );
}

export default function YearReport({ employee, vacations, company, year, onClose }) {
  useEffect(() => {
    function onEsc(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const entries = useMemo(
    () =>
      collectYearEntries({
        employee,
        vacations,
        recurring: company?.recurringCompanyVacation,
        year,
        companyId: company?.id,
      }),
    [employee, vacations, company, year],
  );

  const stats = useMemo(
    () =>
      computeYearStats({
        employee,
        vacations,
        recurring: company?.recurringCompanyVacation,
        year,
      }),
    [employee, vacations, company, year],
  );

  const sonderRows = useMemo(() => {
    const usage = sonderurlaubUsageByReason(vacations, employee, year);
    const limits = new Map(
      (company?.specialLeaveTypes || []).map((t) => [t.label, Number(t.days) || 0]),
    );
    return Array.from(usage.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "de"))
      .map(([reason, days]) => ({
        reason,
        days,
        max: limits.get(reason) || 0,
      }));
  }, [vacations, employee, year, company]);

  const holidays = useMemo(() => getGermanHolidays(year), [year]);

  const notices = [];
  if (stats.negative) {
    notices.push(
      `Negative Urlaubsbilanz: ${fmtDaysDE(stats.remaining)}. Es wurde mehr Urlaub eingetragen, als der Jahresanspruch zulässt.`,
    );
  }
  if (stats.carryoverAvailable === 0 && stats.carryoverTotal > 0) {
    notices.push(
      `Der Vorjahresrest (${fmtDaysDE(stats.carryoverTotal)}) ist nach dem 31.03. verfallen.`,
    );
  }
  if (employee.terminationDate) {
    notices.push(`Das Arbeitsverhältnis endet am ${fmtDate(employee.terminationDate)}.`);
  }

  const legend = [
    { c: COLOR[TYPE_URLAUB], l: "Urlaub" },
    { c: COLOR[TYPE_SONDERURLAUB], l: "Sonderurlaub" },
    { c: COLOR[TYPE_BETRIEBSURLAUB], l: "Betriebsurlaub" },
    { c: COLOR[TYPE_KRANKHEIT], l: "Krankheit" },
    { c: "#EDE4D3", l: "Feiertag" },
    { c: "rgba(0,0,0,0.06)", l: "Wochenende" },
  ];
  if (employee.birthDate) legend.push({ c: "#F7DDE3", l: "Geburtstag" });
  if (employee.terminationDate) legend.push({ c: "#33322D", l: "Nach Vertragsende" });

  return (
    <div className="report-overlay">
      <div className="report-bar report-noprint">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 sm:px-6 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.14em] text-black/50 font-semibold">
              Jahresbericht {year}
            </div>
            <div className="font-semibold truncate">{employee.fullName}</div>
          </div>
          <button className="btn-ghost bg-white shadow-soft" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Drucken</span>
          </button>
          <button className="btn-ghost bg-black/[0.04]" onClick={onClose}>
            <X className="w-4 h-4" />
            Schließen
          </button>
        </div>
      </div>

      <div className="report-root max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Kopf */}
        <header className="flex gap-5 items-start pb-4 mb-7 border-b-2 border-gold flex-wrap">
          {company?.logo && (
            <img
              src={company.logo}
              alt="Firmenlogo"
              className="max-h-16 max-w-[180px] object-contain"
            />
          )}
          <div className="flex-1 min-w-[200px]">
            <div className="text-xl font-semibold">{company?.name || "Firma"}</div>
            <div className="text-xs text-black/55 whitespace-pre-line">
              {company?.address}
            </div>
            {company?.contact && (
              <div className="text-xs text-black/55">
                Ansprechpartner: {company.contact}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.14em] text-gold-dark font-bold">
              Mitarbeiter-Jahresübersicht
            </div>
            <div className="text-3xl font-bold leading-tight">{year}</div>
            <div className="text-sm text-black/55">{employee.fullName}</div>
          </div>
        </header>

        <Section title="Stammdaten">
          <div className="text-2xl sm:text-[28px] font-bold">{employee.fullName}</div>
          {employee.personalNumber && (
            <div className="text-xs text-black/45 mt-0.5">
              Personalnummer {employee.personalNumber}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-3.5 mt-4">
            <Fact label="Abteilung" value={employee.department || "—"} />
            <Fact
              label="Beschäftigung"
              value={labelEmploymentType(employee.employmentType)}
            />
            <Fact label="Arbeitstage" value={labelWorkDays(employee)} />
            <Fact label="Wochenstunden" value={`${fmtNumDE(employee.weeklyHours || 0)} h`} />
            <Fact label="Eintritt" value={fmtDate(employee.hireDate) || "—"} />
            <Fact
              label={employee.contractStatus === "befristet" ? "Vertragsende" : "Austritt"}
              value={employee.terminationDate ? fmtDate(employee.terminationDate) : "—"}
              danger={Boolean(employee.terminationDate)}
            />
            <Fact
              label="Vertrag"
              value={employee.contractStatus === "befristet" ? "Befristet" : "Unbefristet"}
            />
            <Fact
              label="Probezeit"
              value={
                employee.probationEnd
                  ? `${employee.probationStart ? fmtDate(employee.probationStart) + " – " : ""}${fmtDate(employee.probationEnd)}`
                  : "—"
              }
            />
            <Fact label="Geburtstag" value={fmtDate(employee.birthDate) || "—"} />
            <Fact label="Bericht erstellt" value={fmtDate(todayISO())} />
          </div>
        </Section>

        <Section title="Urlaubs- und Abwesenheitsbilanz">
          <table className="w-full border-collapse">
            <tbody>
              <BalanceRow
                label="Jahresanspruch"
                note={
                  stats.prorated
                    ? `anteilig · voller Anspruch ${fmtNumDE(stats.annualFull)}`
                    : ""
                }
                value={fmtDaysDE(stats.annual)}
              />
              <BalanceRow
                label="Vorjahresübertrag"
                note={
                  stats.carryoverTotal
                    ? stats.carryoverAvailable > 0
                      ? "nutzbar bis 31.03."
                      : "nach dem 31.03. verfallen"
                    : ""
                }
                value={fmtDaysDE(stats.carryoverTotal)}
              />
              <BalanceRow
                label="Gesamt verfügbar"
                value={fmtDaysDE(stats.annual + (stats.carryoverAvailable || 0))}
                strong
              />
              <BalanceRow
                label="Genommener Urlaub"
                value={fmtDaysDE(stats.usedUrlaub)}
              />
              <BalanceRow
                label="Angerechneter Betriebsurlaub"
                value={fmtDaysDE(stats.usedCompany)}
              />
              <BalanceRow
                label="Gesamt gegen den Anspruch"
                value={fmtDaysDE(stats.usedAgainstAnnual)}
                strong
              />
              <BalanceRow
                label="Verbleibender Urlaub"
                value={fmtDaysDE(stats.remaining)}
                total
                negative={stats.negative}
              />
              <BalanceRow
                label="Sonderurlaub"
                note="separat gezählt, nicht vom Anspruch abgezogen"
                value={fmtDaysDE(stats.sonderurlaubTotal || 0)}
              />
              <BalanceRow
                label="Krankheitstage"
                note="separat gezählt, nicht vom Anspruch abgezogen"
                value={fmtDaysDE(stats.sickTotal || 0)}
              />
            </tbody>
          </table>
        </Section>

        {notices.length > 0 && (
          <div className="mt-5 border-l-4 border-red-sick bg-red-50 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.12em] text-red-sick font-bold mb-1">
              Hinweise
            </div>
            <ul className="list-disc pl-5 text-sm space-y-0.5">
              {notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <Section title={`Jahreskalender ${year}`}>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs mb-4">
            {legend.map((i) => (
              <span key={i.l} className="inline-flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm ring-1 ring-black/10"
                  style={{ background: i.c }}
                />
                {i.l}
              </span>
            ))}
            <span className="inline-flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm ring-1 ring-black/10"
                style={{
                  background: `linear-gradient(135deg, ${COLOR[TYPE_URLAUB]} 50%, rgba(255,255,255,0.85) 50%)`,
                }}
              />
              Halbtag ½
            </span>
          </div>
          {/* Exakt die Kalender-Komponente der Mitarbeiterakte, nur ohne Klick. */}
          <YearCalendar
            year={year}
            entries={entries}
            draftStartISO={null}
            today={todayISO()}
            birthdayISO={birthdayForYear(employee.birthDate, year)}
            terminationISO={employee.terminationDate || null}
            employee={employee}
          />
        </Section>

        <Section title="Abwesenheiten im Detail">
          {/* Ebenfalls die Liste aus der Akte — gleiche Tageszahlen, nur ohne
              Löschen-Knöpfe. */}
          <EntryList entries={entries} year={year} employee={employee} canManage={false} />
        </Section>

        {sonderRows.length > 0 && (
          <Section title="Sonderurlaub nach Grund">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.08em] text-gold-dark">
                  <th className="text-left pb-1.5 border-b border-black/10">Grund</th>
                  <th className="text-right pb-1.5 border-b border-black/10">Genommen</th>
                  <th className="text-left pb-1.5 pl-6 border-b border-black/10">
                    Kontingent
                  </th>
                </tr>
              </thead>
              <tbody>
                {sonderRows.map((r) => (
                  <tr key={r.reason}>
                    <td className="py-2 border-b border-black/10">{r.reason}</td>
                    <td className="py-2 text-right tabular-nums border-b border-black/10">
                      {fmtDaysDE(r.days)}
                    </td>
                    <td className="py-2 pl-6 text-black/50 border-b border-black/10">
                      {r.max > 0
                        ? `${fmtNumDE(r.days)} von ${fmtNumDE(r.max)} · noch ${fmtNumDE(Math.max(0, r.max - r.days))}`
                        : "kein Kontingent hinterlegt"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Section title={`Gesetzliche Feiertage ${year}`}>
          <div className="text-sm text-black/60">
            {holidays.map((h) => `${fmtDate(h.iso)} ${h.name}`).join(" · ")}
          </div>
        </Section>

        <footer className="mt-10 pt-3 border-t border-black/10 flex justify-between gap-4 text-xs text-black/45 flex-wrap">
          <span>
            Erstellt mit VacationPlanner Gold{company?.name ? ` · ${company.name}` : ""}
          </span>
          <span>Stand: {fmtDate(todayISO())}</span>
        </footer>
      </div>
    </div>
  );
}
