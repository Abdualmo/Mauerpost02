// Builds a fully self-contained HTML year report for one employee.
//
// The result is a single string containing its own <style> block and no
// external references of any kind (no fonts, no scripts, no images beyond
// the company logo, which is already a data URL). It therefore renders
// identically offline, from a USB stick, opened via file://.
//
// The report deliberately reuses the very same functions the on-screen
// views use — computeYearStats, collectYearEntries, isWorkdayForEmployee —
// so the numbers in the file can never drift away from the numbers in the
// app.

import {
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_SONDERURLAUB,
  TYPE_URLAUB,
  birthdayISO as birthdayForYear,
  collectYearEntries,
  computeYearStats,
  countWorkdaysInYear,
  entryCoveringDay,
  getGermanHolidays,
  halfDayAdjustment,
  holidayName,
  isHalfDayFor,
  isWorkdayForEmployee,
  sonderurlaubUsageByReason,
} from "./vacation.js";
import { fmtDate, toISO, todayISO } from "./date.js";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WEEKDAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_LONG = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
];

const TYPE_LABEL = {
  [TYPE_URLAUB]: "Urlaub",
  [TYPE_BETRIEBSURLAUB]: "Betriebsurlaub",
  [TYPE_KRANKHEIT]: "Krankheit",
  [TYPE_SONDERURLAUB]: "Sonderurlaub",
};

// Same palette as the in-app calendar, so screen and report look alike.
const COLOR = {
  [TYPE_URLAUB]: "#C8A96B",
  [TYPE_BETRIEBSURLAUB]: "#5E9EA0",
  [TYPE_KRANKHEIT]: "#D64545",
  [TYPE_SONDERURLAUB]: "#4A90E2",
};
const FG = {
  [TYPE_URLAUB]: "#1A1A1A",
  [TYPE_BETRIEBSURLAUB]: "#FFFFFF",
  [TYPE_KRANKHEIT]: "#FFFFFF",
  [TYPE_SONDERURLAUB]: "#FFFFFF",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Everything that reaches the output goes through this. Names, notes and
// reasons are free text typed by the user; unescaped they would break the
// markup (or worse) as soon as someone types a < or a quote.
function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Preserve author line breaks in multi-line fields (company address).
function escMultiline(value) {
  return esc(value).replace(/\r?\n/g, "<br>");
}

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

// "Mo, Mi, Fr" — or a plain hint when the employee has no explicit
// working days stored (older records behave like a full Mon-Fri week).
function labelWorkDays(employee) {
  const days = employee?.workDays;
  if (!Array.isArray(days) || days.length === 0) return "Mo – Fr (Standard)";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d - 1])
    .filter(Boolean)
    .join(", ");
}

function safeFileNamePart(value, fallback) {
  const cleaned = String(value || "").replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

// ---------------------------------------------------------------------------
// Stylesheet — inlined into the document
// ---------------------------------------------------------------------------

const STYLES = `
:root {
  --bg: #F5F0E8;
  --card: #FFFFFF;
  --ink: #1A1A1A;
  --ink-soft: #505050;
  --ink-muted: #8C8C8C;
  --gold: #C8A96B;
  --gold-dark: #8C6E38;
  --rule: #E1D9C2;
  --holiday: #EDE4D3;
  --weekend: #ECE7DC;
  --birthday: #F7DDE3;
  --terminated: #33322D;
  --danger: #D64545;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 32px 20px 64px;
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sheet { max-width: 1080px; margin: 0 auto; }

.masthead {
  display: flex; gap: 20px; align-items: flex-start;
  padding-bottom: 16px; border-bottom: 2px solid var(--gold); margin-bottom: 28px;
}
.masthead img { max-height: 64px; max-width: 180px; }
.masthead .company { flex: 1 1 auto; min-width: 0; }
.masthead .company h1 { margin: 0 0 4px; font-size: 20px; }
.masthead .company .meta { color: var(--ink-soft); font-size: 12px; }
.masthead .doc { text-align: right; flex: 0 0 auto; }
.masthead .doc .kicker {
  font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--gold-dark); font-weight: 700;
}
.masthead .doc .year { font-size: 30px; font-weight: 700; line-height: 1.1; }
.masthead .doc .who { color: var(--ink-soft); font-size: 13px; }

h2.section {
  font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--gold-dark); margin: 36px 0 10px; padding-bottom: 6px;
  border-bottom: 1px solid var(--rule);
}
.employee-name { font-size: 28px; font-weight: 700; margin: 0; }
.employee-sub { color: var(--ink-muted); font-size: 13px; margin: 2px 0 0; }

.facts {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px 20px; margin-top: 18px;
}
.facts .k {
  font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-muted);
}
.facts .v { font-size: 15px; }
.facts .v.danger { color: var(--danger); }

table.balance { width: 100%; border-collapse: collapse; }
table.balance td { padding: 7px 0; border-bottom: 1px solid var(--rule); }
table.balance td.v { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
table.balance tr.strong td { font-weight: 700; }
table.balance tr.total td {
  background: #FCFAF5; font-weight: 700; font-size: 16px;
  border-top: 2px solid var(--gold); border-bottom: 2px solid var(--gold);
}
table.balance tr.total td.v.negative { color: var(--danger); }
table.balance td .note { color: var(--ink-muted); font-weight: 400; font-size: 12px; }

.notices { margin-top: 18px; border-left: 4px solid var(--danger); background: #FBE0E0; padding: 12px 16px; }
.notices .t {
  font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: var(--danger); font-weight: 700; margin-bottom: 4px;
}
.notices ul { margin: 0; padding-left: 18px; }

.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 4px 0 18px; font-size: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 7px; }
.legend i { width: 13px; height: 13px; border-radius: 3px; display: inline-block; flex: 0 0 auto; }

.months { display: grid; grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 16px; }
.month { background: var(--card); border-radius: 12px; padding: 12px; break-inside: avoid; }
.month h3 { margin: 0 0 8px; font-size: 15px; }
.month table { width: 100%; border-collapse: separate; border-spacing: 2px; table-layout: fixed; }
.month th {
  font-size: 10px; font-weight: 500; color: var(--ink-muted); padding-bottom: 2px;
}
.month td {
  height: 26px; text-align: center; font-size: 12px; border-radius: 5px;
  font-variant-numeric: tabular-nums; position: relative;
}
.month td.pad { visibility: hidden; }
.month td.work { background: #FCFAF5; }
.month td.weekend { background: var(--weekend); color: #A9A296; }
.month td.holiday { background: var(--holiday); color: #4A3D1F; }
.month td.birthday { background: var(--birthday); }
.month td.gone { background: var(--terminated); color: #8A857A; }
.month td.today { outline: 2px solid var(--ink); outline-offset: -2px; font-weight: 700; }
.month td .half {
  position: absolute; right: 2px; bottom: 0; font-size: 9px; font-weight: 700;
}

table.entries { width: 100%; border-collapse: collapse; }
table.entries th {
  text-align: left; font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
  color: var(--gold-dark); border-bottom: 1px solid var(--rule); padding: 0 8px 6px 0;
}
table.entries td { padding: 8px 8px 8px 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
table.entries td.days { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
table.entries .dot {
  width: 9px; height: 9px; border-radius: 50%; display: inline-block; margin-right: 8px;
}
table.entries .muted { color: var(--ink-muted); }
.empty { color: var(--ink-muted); font-style: italic; }

footer {
  margin-top: 40px; padding-top: 12px; border-top: 1px solid var(--rule);
  display: flex; justify-content: space-between; gap: 16px;
  font-size: 11px; color: var(--ink-muted);
}

@media print {
  body { background: #FFF; padding: 0; font-size: 12px; }
  .month, .sheet { break-inside: auto; }
  h2.section { break-after: avoid; }
  .months { grid-template-columns: repeat(3, 1fr); }
  @page { margin: 14mm; }
}
`;

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function renderMasthead(company, employee, year) {
  const logo = company?.logo
    ? `<img src="${esc(company.logo)}" alt="Firmenlogo">`
    : "";
  const address = company?.address ? `<div>${escMultiline(company.address)}</div>` : "";
  const contact = company?.contact
    ? `<div>Ansprechpartner: ${esc(company.contact)}</div>`
    : "";
  return `
<header class="masthead">
  ${logo}
  <div class="company">
    <h1>${esc(company?.name || "Firma")}</h1>
    <div class="meta">${address}${contact}</div>
  </div>
  <div class="doc">
    <div class="kicker">Mitarbeiter-Jahresübersicht</div>
    <div class="year">${esc(year)}</div>
    <div class="who">${esc(employee.fullName || "")}</div>
  </div>
</header>`;
}

function renderFacts(employee) {
  const facts = [
    { k: "Abteilung", v: employee.department || "—" },
    { k: "Beschäftigung", v: labelEmploymentType(employee.employmentType) },
    { k: "Arbeitstage", v: labelWorkDays(employee) },
    { k: "Wochenstunden", v: `${fmtNumDE(employee.weeklyHours || 0)} h` },
    { k: "Eintritt", v: fmtDate(employee.hireDate) || "—" },
    {
      k: employee.contractStatus === "befristet" ? "Vertragsende" : "Austritt",
      v: employee.terminationDate ? fmtDate(employee.terminationDate) : "—",
      danger: Boolean(employee.terminationDate),
    },
    {
      k: "Vertrag",
      v: employee.contractStatus === "befristet" ? "Befristet" : "Unbefristet",
    },
    {
      k: "Probezeit",
      v: employee.probationEnd
        ? `${employee.probationStart ? fmtDate(employee.probationStart) + " – " : ""}${fmtDate(employee.probationEnd)}`
        : "—",
    },
    { k: "Geburtstag", v: fmtDate(employee.birthDate) || "—" },
    { k: "Bericht erstellt", v: fmtDate(todayISO()) },
  ];

  const cells = facts
    .map(
      (f) => `<div>
      <div class="k">${esc(f.k)}</div>
      <div class="v${f.danger ? " danger" : ""}">${esc(f.v)}</div>
    </div>`,
    )
    .join("");

  return `
<h2 class="section">Stammdaten</h2>
<p class="employee-name">${esc(employee.fullName || "—")}</p>
${employee.personalNumber ? `<p class="employee-sub">Personalnummer ${esc(employee.personalNumber)}</p>` : ""}
<div class="facts">${cells}</div>`;
}

function renderBalance(stats) {
  const row = (label, value, opts = {}) => {
    const cls = [opts.strong ? "strong" : "", opts.total ? "total" : ""]
      .filter(Boolean)
      .join(" ");
    const vCls = ["v", opts.negative ? "negative" : ""].filter(Boolean).join(" ");
    return `<tr${cls ? ` class="${cls}"` : ""}>
      <td>${esc(label)}${opts.note ? ` <span class="note">${esc(opts.note)}</span>` : ""}</td>
      <td class="${vCls}">${esc(value)}</td>
    </tr>`;
  };

  const carryNote = stats.carryoverTotal
    ? stats.carryoverAvailable > 0
      ? "nutzbar bis 31.03."
      : "nach dem 31.03. verfallen"
    : "";

  return `
<h2 class="section">Urlaubs- und Abwesenheitsbilanz</h2>
<table class="balance">
  ${row("Jahresanspruch", fmtDaysDE(stats.annual), {
    note: stats.prorated ? `anteilig · voller Anspruch ${fmtNumDE(stats.annualFull)}` : "",
  })}
  ${row("Vorjahresübertrag", fmtDaysDE(stats.carryoverTotal), { note: carryNote })}
  ${row("Gesamt verfügbar", fmtDaysDE(stats.annual + (stats.carryoverAvailable || 0)), { strong: true })}
  ${row("Genommener Urlaub", fmtDaysDE(stats.usedUrlaub))}
  ${row("Angerechneter Betriebsurlaub", fmtDaysDE(stats.usedCompany))}
  ${row("Gesamt gegen den Anspruch", fmtDaysDE(stats.usedAgainstAnnual), { strong: true })}
  ${row("Verbleibender Urlaub", fmtDaysDE(stats.remaining), {
    total: true,
    negative: stats.negative,
  })}
  ${row("Sonderurlaub", fmtDaysDE(stats.sonderurlaubTotal || 0), {
    note: "separat gezählt, nicht vom Anspruch abgezogen",
  })}
  ${row("Krankheitstage", fmtDaysDE(stats.sickTotal || 0), {
    note: "separat gezählt, nicht vom Anspruch abgezogen",
  })}
</table>`;
}

function renderNotices(employee, stats) {
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
  if (notices.length === 0) return "";
  return `
<div class="notices">
  <div class="t">Hinweise</div>
  <ul>${notices.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
</div>`;
}

function renderLegend(employee) {
  const items = [
    { c: COLOR[TYPE_URLAUB], l: "Urlaub" },
    { c: COLOR[TYPE_SONDERURLAUB], l: "Sonderurlaub" },
    { c: COLOR[TYPE_BETRIEBSURLAUB], l: "Betriebsurlaub" },
    { c: COLOR[TYPE_KRANKHEIT], l: "Krankheit" },
    { c: "#FCFAF5", l: "Arbeitstag" },
    { c: "#ECE7DC", l: "Kein Arbeitstag / Wochenende" },
    { c: "#EDE4D3", l: "Feiertag" },
  ];
  if (employee.birthDate) items.push({ c: "#F7DDE3", l: "Geburtstag" });
  if (employee.terminationDate) items.push({ c: "#33322D", l: "Nach Vertragsende" });
  return `<div class="legend">${items
    .map(
      (i) =>
        `<span><i style="background:${esc(i.c)};border:1px solid rgba(0,0,0,.12)"></i>${esc(i.l)}</span>`,
    )
    .join("")}<span><i style="background:linear-gradient(135deg,${COLOR[TYPE_URLAUB]} 50%,#fff 50%);border:1px solid rgba(0,0,0,.12)"></i>Halbtag ½</span></div>`;
}

// One month grid, Monday-first, matching the on-screen calendar cell for cell.
function renderMonth(monthIdx, year, entries, employee, today, birthday) {
  const first = new Date(year, monthIdx, 1);
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  // JS getDay(): 0 = Sunday. Shift so Monday starts the row.
  const lead = (first.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<td class="pad"></td>');

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, monthIdx, d);
    const iso = toISO(date);
    const isWorkday = isWorkdayForEmployee(iso, employee);
    // Identical rule to MonthCalendar: an absence only shows on a day the
    // employee actually works, so display and arithmetic stay in sync.
    const raw = entryCoveringDay(entries, iso);
    const entry = raw && isWorkday ? raw : null;
    const holiday = holidayName(iso);
    const gone = employee.terminationDate && iso > employee.terminationDate;
    const isBirthday = birthday && iso === birthday;
    const half = entry ? isHalfDayFor(entry, iso) : false;

    const cls = [];
    let style = "";
    let title = [];

    if (gone && !entry) {
      cls.push("gone");
      title.push("Nach Vertragsende");
    } else if (entry) {
      const bg = COLOR[entry.type] || "#DDD";
      style = half
        ? `background:linear-gradient(135deg,${bg} 50%,rgba(255,255,255,.85) 50%);color:${FG[entry.type] || "#000"}`
        : `background:${bg};color:${FG[entry.type] || "#000"}`;
      title.push(TYPE_LABEL[entry.type] || entry.type);
      if (entry.reason) title.push(`Grund: ${entry.reason}`);
      if (entry.notes) title.push(entry.notes);
      if (half) title.push("Halbtag");
    } else if (holiday) {
      cls.push("holiday");
      title.push(holiday);
    } else if (isBirthday) {
      cls.push("birthday");
      title.push("Geburtstag");
    } else if (isWorkday) {
      cls.push("work");
    } else {
      cls.push("weekend");
    }

    if (today === iso) cls.push("today");

    cells.push(
      `<td class="${cls.join(" ")}"${style ? ` style="${style}"` : ""}${
        title.length ? ` title="${esc(title.join(" · "))}"` : ""
      }>${d}${half ? '<span class="half">½</span>' : ""}</td>`,
    );
  }

  while (cells.length % 7 !== 0) cells.push('<td class="pad"></td>');

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(`<tr>${cells.slice(i, i + 7).join("")}</tr>`);
  }

  return `
<div class="month">
  <h3>${esc(MONTH_NAMES[monthIdx])}</h3>
  <table>
    <thead><tr>${WEEKDAY_SHORT.map((w) => `<th>${w}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>
</div>`;
}

function renderCalendar(entries, employee, year) {
  const today = todayISO();
  const birthday = birthdayForYear(employee.birthDate, year);
  const months = Array.from({ length: 12 }, (_, m) =>
    renderMonth(m, year, entries, employee, today, birthday),
  ).join("");
  return `
<h2 class="section">Jahreskalender ${esc(year)}</h2>
${renderLegend(employee)}
<div class="months">${months}</div>`;
}

function renderEntries(entries, employee, year) {
  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sorted.length === 0) {
    return `
<h2 class="section">Abwesenheiten im Detail</h2>
<p class="empty">Keine Einträge in ${esc(year)}.</p>`;
  }

  const rows = sorted
    .map((e) => {
      const base = countWorkdaysInYear(e.startDate, e.endDate, year, employee);
      const days =
        e.type === TYPE_URLAUB
          ? Math.max(0, base + halfDayAdjustment(e, year, employee))
          : base;
      const notes = [];
      if (e.reason) notes.push(`Grund: ${e.reason}`);
      if (e.halfDayStart || e.halfDayEnd) notes.push("Halbtag");
      if (e.notes) notes.push(e.notes);
      if (e.recurring) notes.push("wiederkehrend");
      return `<tr>
      <td><span class="dot" style="background:${esc(COLOR[e.type] || "#999")}"></span>${esc(TYPE_LABEL[e.type] || e.type)}</td>
      <td>${esc(fmtDate(e.startDate))} – ${esc(fmtDate(e.endDate))}</td>
      <td class="days">${esc(fmtDaysDE(days))}</td>
      <td class="muted">${notes.length ? esc(notes.join(" · ")) : "—"}</td>
    </tr>`;
    })
    .join("");

  return `
<h2 class="section">Abwesenheiten im Detail</h2>
<table class="entries">
  <thead><tr><th>Art</th><th>Zeitraum</th><th style="text-align:right">Tage</th><th>Grund / Notiz</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function renderSonderReasons(vacations, employee, year, company) {
  const usage = sonderurlaubUsageByReason(vacations, employee, year);
  if (usage.size === 0) return "";

  const limits = new Map(
    (company?.specialLeaveTypes || []).map((t) => [t.label, Number(t.days) || 0]),
  );

  const rows = Array.from(usage.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .map(([reason, days]) => {
      const max = limits.get(reason);
      const quota =
        max > 0
          ? `${fmtNumDE(days)} von ${fmtNumDE(max)} · noch ${fmtNumDE(Math.max(0, max - days))}`
          : "kein Kontingent hinterlegt";
      return `<tr>
      <td>${esc(reason)}</td>
      <td class="days">${esc(fmtDaysDE(days))}</td>
      <td class="muted">${esc(quota)}</td>
    </tr>`;
    })
    .join("");

  return `
<h2 class="section">Sonderurlaub nach Grund</h2>
<table class="entries">
  <thead><tr><th>Grund</th><th style="text-align:right">Genommen</th><th>Kontingent</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Assemble the complete standalone document for one employee and year.
export function buildYearReportHTML({ employee, vacations, company, year }) {
  if (!employee || !employee.id) {
    throw new Error("Kein Mitarbeiter ausgewählt.");
  }

  const entries = collectYearEntries({
    employee,
    vacations,
    recurring: company?.recurringCompanyVacation,
    year,
    companyId: company?.id,
  });
  const stats = computeYearStats({
    employee,
    vacations,
    recurring: company?.recurringCompanyVacation,
    year,
  });

  const holidays = getGermanHolidays(year)
    .map((h) => `${fmtDate(h.iso)} ${h.name}`)
    .join(" · ");

  const title = `Jahresübersicht ${employee.fullName || "Mitarbeiter"} ${year}`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="sheet">
${renderMasthead(company, employee, year)}
${renderFacts(employee)}
${renderBalance(stats)}
${renderNotices(employee, stats)}
${renderCalendar(entries, employee, year)}
${renderEntries(entries, employee, year)}
${renderSonderReasons(vacations, employee, year, company)}
<h2 class="section">Gesetzliche Feiertage ${esc(year)}</h2>
<p class="muted" style="color:var(--ink-soft);font-size:12px">${esc(holidays)}</p>
<footer>
  <span>Erstellt mit VacationPlanner Gold${company?.name ? ` · ${esc(company.name)}` : ""}</span>
  <span>Stand: ${esc(fmtDate(todayISO()))}</span>
</footer>
</div>
</body>
</html>`;
}

// File name used for the download, e.g. Jahresbericht_Max_Mustermann_2026.html
export function yearReportFileName(employee, year) {
  return `Jahresbericht_${safeFileNamePart(employee?.fullName, "Mitarbeiter")}_${year}.html`;
}

// Saves the report through the browser's native download mechanism:
// a Blob plus an invisible <a download> click. No popup is requested, so
// this also works on iOS Safari and under file://.
export function downloadYearReportHTML({ employee, vacations, company, year }) {
  const html = buildYearReportHTML({ employee, vacations, company, year });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = yearReportFileName(employee, year);
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Revoke late; some browsers still read the blob after the click returns.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 4000);
  return html;
}

// Opens the report in a new tab. The markup is written straight into the
// fresh window instead of navigating to a blob: URL, because Chrome blocks
// blob: navigations that originate from a file:// page — which is exactly
// how this app runs from a USB stick.
export function openYearReportHTML({ employee, vacations, company, year }) {
  const html = buildYearReportHTML({ employee, vacations, company, year });
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error(
      "Das Fenster konnte nicht geöffnet werden. Bitte Pop-ups für diese Seite erlauben oder den Bericht stattdessen herunterladen.",
    );
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  try {
    win.document.title = `Jahresübersicht ${employee.fullName || ""} ${year}`.trim();
  } catch {
    /* title is cosmetic — never let it break the export */
  }
  return html;
}
