// A4-optimised print-ready HTML report. Opens in a new window and triggers
// the browser print dialog. Works everywhere PDFs might not — iPad Safari,
// Firefox on locked-down installs, corporate laptops with popup blockers
// disabled per-domain, etc.
import { addDays, getDay, getDaysInMonth, parseISO } from "date-fns";
import {
  TYPE_URLAUB,
  TYPE_KRANKHEIT,
  TYPE_BETRIEBSURLAUB,
  TYPE_SONDERURLAUB,
  collectYearEntries,
  computeYearStats,
  countWorkdaysInYear,
  getGermanHolidays,
  halfDayAdjustment,
  isProbationEndingSoon,
  sonderurlaubUsageByReason,
} from "./vacation.js";
import { fmtDate } from "./date.js";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const TYPE_LABEL = {
  [TYPE_URLAUB]: "Urlaub",
  [TYPE_BETRIEBSURLAUB]: "Betriebsurlaub",
  [TYPE_KRANKHEIT]: "Krankheit",
  [TYPE_SONDERURLAUB]: "Sonderurlaub",
};

const TYPE_COLOR = {
  [TYPE_URLAUB]: "#C8A96B",
  [TYPE_BETRIEBSURLAUB]: "#5E9EA0",
  [TYPE_KRANKHEIT]: "#D64545",
  [TYPE_SONDERURLAUB]: "#4A90E2",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function entriesByDay(entries) {
  const map = new Map();
  entries.forEach((e) => {
    const start = parseISO(e.startDate);
    const end = parseISO(e.endDate);
    let d = new Date(start);
    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      const isHalf =
        (e.halfDayStart && iso === e.startDate) ||
        (e.halfDayEnd && iso === e.endDate) ||
        ((e.halfDayStart || e.halfDayEnd) && e.startDate === e.endDate);
      const prev = map.get(iso);
      if (!prev || (prev.entry.employeeId == null && e.employeeId != null)) {
        map.set(iso, { entry: e, isHalf });
      }
      d = addDays(d, 1);
    }
  });
  return map;
}

function renderCalendar({ entries, year, employee }) {
  const byDay = entriesByDay(entries);
  const holidays = new Map(getGermanHolidays(year).map((h) => [h.iso, h.name]));
  const term = employee?.terminationDate;

  let html = `<div class="cal-grid">`;
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(year, m, 1);
    const firstCol = (getDay(firstOfMonth) + 6) % 7;
    const daysInMonth = getDaysInMonth(firstOfMonth);
    let cells = "";
    for (let i = 0; i < firstCol; i++) cells += `<div class="cal-cell empty"></div>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const date = new Date(year, m, d);
      const dow = getDay(date);
      const weekend = dow === 0 || dow === 6;
      const holiday = holidays.get(iso);
      const past = term && iso > term;
      const entry = byDay.get(iso);
      const classes = ["cal-cell"];
      let style = "";
      let title = "";
      if (past) {
        classes.push("terminated");
        title = "Arbeitsverhältnis beendet";
      } else if (entry) {
        classes.push("has-entry");
        const color = TYPE_COLOR[entry.entry.type];
        style = `background:${color};color:${entry.entry.type === TYPE_URLAUB ? "#000" : "#fff"};`;
        title = TYPE_LABEL[entry.entry.type] + (entry.entry.reason ? ` · ${entry.entry.reason}` : "");
      } else if (holiday) {
        classes.push("holiday");
        title = holiday;
      } else if (weekend) {
        classes.push("weekend");
      }
      cells += `<div class="${classes.join(" ")}" style="${style}" title="${esc(title)}">${d}${entry?.isHalf ? '<span class="half">½</span>' : ""}</div>`;
    }
    html += `
      <div class="cal-month">
        <div class="cal-month-title">${MONTH_NAMES[m]}</div>
        <div class="cal-weekhdr">
          <div>Mo</div><div>Di</div><div>Mi</div><div>Do</div><div>Fr</div><div>Sa</div><div>So</div>
        </div>
        <div class="cal-days">${cells}</div>
      </div>`;
  }
  html += `</div>`;
  return html;
}

function renderSummaryTable(stats) {
  const rows = [
    ["Jahresanspruch", `${stats.annual} Tage` + (stats.prorated ? ` (anteilig, voll ${stats.annualFull})` : "")],
    ["Vorjahresübertrag",
      stats.carryoverTotal
        ? `${stats.carryoverTotal} Tage` +
          (stats.carryoverAvailable === 0 ? " (nach 31.03. verfallen)" : " (nutzbar bis 31.03.)")
        : "0 Tage"],
    ["Gesamt verfügbar", `${stats.annual + (stats.carryoverAvailable || 0)} Tage`],
    ["Bereits genommener Urlaub", `${stats.usedUrlaub ?? 0} Tage`],
    ["Angerechneter Betriebsurlaub", `${stats.usedCompany ?? 0} Tage`],
    ["Gesamt gegen Anspruch", `${stats.usedAgainstAnnual} Tage`],
    ["Verbleibender Urlaub",
      { text: `${stats.remaining} Tage`, danger: stats.negative }],
    ["Sonderurlaub (separat)", `${stats.sonderurlaubTotal || 0} Tage`],
    ["Krankheitstage", `${stats.sickTotal || 0} Tage`],
  ];
  return `
    <table class="summary-table">
      ${rows
        .map(([label, value]) => {
          const isObj = typeof value === "object";
          const cls = isObj && value.danger ? "danger" : "";
          const text = isObj ? value.text : value;
          return `<tr><th>${esc(label)}</th><td class="${cls}">${esc(text)}</td></tr>`;
        })
        .join("")}
    </table>`;
}

function renderEntryList({ entries, year }) {
  if (entries.length === 0)
    return `<p class="muted">Keine Abwesenheiten in ${year}.</p>`;
  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return `
    <table class="entries-table">
      <thead>
        <tr>
          <th>Zeitraum</th>
          <th>Art</th>
          <th class="num">Tage</th>
          <th>Grund / Notiz</th>
        </tr>
      </thead>
      <tbody>
        ${sorted
          .map((e) => {
            const days = Math.max(
              0,
              countWorkdaysInYear(e.startDate, e.endDate, year) +
                (e.type === TYPE_URLAUB ? halfDayAdjustment(e, year) : 0),
            );
            const meta = [];
            if (e.reason) meta.push(`Grund: ${e.reason}`);
            if (e.halfDayStart || e.halfDayEnd) meta.push("Halbtag");
            if (e.notes) meta.push(e.notes);
            if (e.recurring) meta.push("wiederkehrend");
            const color = TYPE_COLOR[e.type] || "#999";
            return `
              <tr>
                <td class="nowrap">${esc(fmtDate(e.startDate))} – ${esc(fmtDate(e.endDate))}</td>
                <td>
                  <span class="dot" style="background:${color}"></span>
                  ${esc(TYPE_LABEL[e.type] || e.type)}
                </td>
                <td class="num">${days}</td>
                <td class="muted">${esc(meta.join(" · "))}</td>
              </tr>`;
          })
          .join("")}
      </tbody>
    </table>`;
}

function renderSonderReasons({ vacations, employee, year }) {
  const usage = sonderurlaubUsageByReason(vacations, employee.id, year);
  if (usage.size === 0) return "";
  const rows = Array.from(usage.entries()).sort((a, b) => a[0].localeCompare(b[0], "de"));
  return `
    <h3>Sonderurlaub nach Grund</h3>
    <table class="reasons-table">
      <tbody>
        ${rows
          .map(
            ([reason, days]) =>
              `<tr><th>${esc(reason)}</th><td class="num">${days} Tag${days === 1 ? "" : "e"}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderWarnings({ employee, stats }) {
  const warnings = [];
  if (stats.negative)
    warnings.push(`Negative Urlaubsbilanz von ${stats.remaining} Tagen.`);
  if (stats.carryoverAvailable === 0 && stats.carryoverTotal > 0)
    warnings.push(`Vorjahresrest (${stats.carryoverTotal} Tage) ist nach dem 31.03. verfallen.`);
  if (employee.terminationDate)
    warnings.push(`Arbeitsverhältnis endet am ${fmtDate(employee.terminationDate)}.`);
  if (isProbationEndingSoon(employee))
    warnings.push(`Probezeit endet am ${fmtDate(employee.probationEnd)}.`);
  if (warnings.length === 0) return "";
  return `
    <div class="warnings">
      <h3>Hinweise</h3>
      <ul>${warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
    </div>`;
}

function renderHTML({ employee, vacations, company, year }) {
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

  const created = new Date();
  const createdStr = created.toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Jahresübersicht ${esc(employee.fullName)} ${year}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 18mm 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a;
    font-size: 10.5pt;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3 { margin: 0; font-weight: 600; }
  h1 { font-size: 18pt; }
  h2 { font-size: 13pt; margin-top: 16pt; margin-bottom: 6pt; color: #8C6E38; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10pt; border-bottom: 0.5pt solid #E3D9C2; padding-bottom: 4pt; }
  h3 { font-size: 11pt; margin-top: 12pt; margin-bottom: 4pt; }
  .muted { color: #6b6b6b; }
  .nowrap { white-space: nowrap; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .danger { color: #D64545; font-weight: 600; }

  header.report-header {
    display: flex; align-items: flex-start; gap: 12pt;
    padding-bottom: 10pt;
    border-bottom: 0.5pt solid #E3D9C2;
    margin-bottom: 10pt;
  }
  header.report-header .logo { max-height: 48pt; max-width: 120pt; }
  header.report-header .company { flex: 1; }
  header.report-header .company .name { font-weight: 600; font-size: 12pt; }
  header.report-header .company .meta { color: #6b6b6b; font-size: 9pt; white-space: pre-line; margin-top: 2pt; }
  header.report-header .title { text-align: right; }
  header.report-header .title .eyebrow { color: #8C6E38; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 600; }
  header.report-header .title .year { font-size: 14pt; font-weight: 600; margin-top: 2pt; }

  .employee-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8pt 16pt; margin-top: 8pt; }
  .employee-info .kv .label { font-size: 8pt; color: #8C6E38; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .employee-info .kv .value { font-size: 10.5pt; margin-top: 1pt; }
  .employee-info .kv .value.danger { color: #D64545; font-weight: 600; }
  .employee-info .name-block { grid-column: 1 / -1; }
  .employee-info .name-block .name { font-size: 14pt; font-weight: 600; }
  .employee-info .name-block .sub { color: #6b6b6b; font-size: 9pt; margin-top: 2pt; }

  table.summary-table, table.entries-table, table.reasons-table { width: 100%; border-collapse: collapse; }
  table.summary-table th { text-align: left; padding: 4pt 6pt; color: #4a4a4a; font-weight: normal; border-bottom: 0.25pt solid #EAE3D2; }
  table.summary-table td { text-align: right; padding: 4pt 6pt; font-weight: 600; border-bottom: 0.25pt solid #EAE3D2; }
  table.entries-table th, table.entries-table td { padding: 4pt 6pt; border-bottom: 0.25pt solid #EAE3D2; vertical-align: top; text-align: left; }
  table.entries-table th { color: #8C6E38; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; }
  table.entries-table .num { text-align: right; }
  table.reasons-table th { text-align: left; padding: 3pt 6pt; font-weight: normal; }
  table.reasons-table td { text-align: right; padding: 3pt 6pt; font-weight: 600; }
  .dot { display: inline-block; width: 7pt; height: 7pt; border-radius: 50%; vertical-align: middle; margin-right: 4pt; }

  .warnings { margin-top: 10pt; padding: 8pt 10pt; background: #FBE0E0; border-left: 3pt solid #D64545; border-radius: 3pt; }
  .warnings h3 { color: #D64545; margin: 0 0 4pt 0; font-size: 10pt; }
  .warnings ul { margin: 0; padding-left: 14pt; }

  .page-break { page-break-before: always; }

  .cal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6pt; margin-top: 4pt; }
  .cal-month { border: 0.25pt solid #EAE3D2; border-radius: 3pt; padding: 4pt; }
  .cal-month-title { font-weight: 600; font-size: 9pt; margin-bottom: 3pt; }
  .cal-weekhdr { display: grid; grid-template-columns: repeat(7, 1fr); font-size: 6.5pt; color: #8a8a8a; text-align: center; margin-bottom: 2pt; }
  .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1pt; }
  .cal-cell { position: relative; font-size: 7pt; text-align: center; padding: 2pt 0; border-radius: 2pt; background: #fcfaf5; color: #1a1a1a; }
  .cal-cell.empty { background: transparent; }
  .cal-cell.weekend { background: #f5f0e8; color: #8a8a8a; }
  .cal-cell.holiday { background: #EDE4D3; color: #4a3d1f; }
  .cal-cell.terminated { background: #33322D; color: #a8a498; }
  .cal-cell.has-entry { font-weight: 600; }
  .cal-cell .half { position: absolute; bottom: -1pt; right: 1pt; font-size: 5.5pt; }

  .legend { display: flex; flex-wrap: wrap; gap: 8pt 14pt; margin-top: 8pt; font-size: 8.5pt; }
  .legend-item { display: inline-flex; align-items: center; gap: 4pt; }
  .legend-swatch { display: inline-block; width: 9pt; height: 9pt; border-radius: 2pt; }

  .print-controls {
    position: fixed; top: 12pt; right: 12pt; z-index: 9999;
    display: flex; gap: 8pt; align-items: center;
    background: #ffffff; padding: 8pt 10pt;
    border: 1pt solid #E3D9C2; border-radius: 6pt;
    box-shadow: 0 4pt 12pt rgba(0,0,0,0.08);
    font-family: system-ui, sans-serif;
  }
  .print-controls button {
    font-family: inherit; font-size: 10pt; padding: 6pt 12pt;
    border-radius: 4pt; cursor: pointer; border: 0;
  }
  .print-controls .primary { background: #C8A96B; color: #000; }
  .print-controls .ghost { background: transparent; color: #4a4a4a; }
  .print-controls .hint { color: #6b6b6b; font-size: 8.5pt; }
  @media print { .print-controls { display: none !important; } }

  footer.report-footer {
    margin-top: 14pt;
    padding-top: 6pt;
    border-top: 0.25pt solid #EAE3D2;
    color: #8a8a8a;
    font-size: 8pt;
    display: flex; justify-content: space-between;
  }
</style>
</head>
<body>
<div class="print-controls">
  <span class="hint">Zum Speichern als PDF im Druck-Dialog „PDF" wählen.</span>
  <button class="ghost" onclick="window.close()">Schließen</button>
  <button class="primary" onclick="window.print()">Drucken / PDF</button>
</div>

<header class="report-header">
  ${company?.logo ? `<img class="logo" src="${esc(company.logo)}" alt="Logo">` : ""}
  <div class="company">
    <div class="name">${esc(company?.name || "Firma")}</div>
    ${company?.address ? `<div class="meta">${esc(company.address)}</div>` : ""}
    ${company?.contact ? `<div class="meta">Ansprechpartner: ${esc(company.contact)}</div>` : ""}
  </div>
  <div class="title">
    <div class="eyebrow">Mitarbeiter-Jahresübersicht</div>
    <div class="year">${year}</div>
  </div>
</header>

<section class="employee-info">
  <div class="name-block">
    <div class="name">${esc(employee.fullName)}</div>
    <div class="sub">${employee.personalNumber ? `Personalnummer ${esc(employee.personalNumber)}` : ""}</div>
  </div>
  <div class="kv"><div class="label">Abteilung</div><div class="value">${esc(employee.department || "—")}</div></div>
  <div class="kv"><div class="label">Beschäftigung</div><div class="value">${esc(labelEmploymentType(employee.employmentType))}</div></div>
  <div class="kv"><div class="label">Wochenstunden</div><div class="value">${esc(employee.weeklyHours || 0)} h</div></div>
  <div class="kv"><div class="label">Eintritt</div><div class="value">${esc(fmtDate(employee.hireDate) || "—")}</div></div>
  <div class="kv"><div class="label">Austritt</div><div class="value ${employee.terminationDate ? "danger" : ""}">${esc(employee.terminationDate ? fmtDate(employee.terminationDate) : "—")}</div></div>
  <div class="kv"><div class="label">Vertrag</div><div class="value">${employee.contractStatus === "befristet" ? "Befristet" : "Unbefristet"}</div></div>
  <div class="kv"><div class="label">Probezeit</div><div class="value">${employee.probationEnd ? `${employee.probationStart ? esc(fmtDate(employee.probationStart)) + " – " : ""}${esc(fmtDate(employee.probationEnd))}` : "—"}</div></div>
  <div class="kv"><div class="label">Geburtstag</div><div class="value">${employee.birthDate ? esc(fmtDate(employee.birthDate)) : "—"}</div></div>
  <div class="kv"><div class="label">Bericht erstellt</div><div class="value">${esc(createdStr)}</div></div>
</section>

<h2>Urlaubs- und Abwesenheitsbilanz</h2>
${renderSummaryTable(stats)}

${renderWarnings({ employee, stats })}

<div class="page-break"></div>

<header class="report-header">
  <div class="company"><div class="name">${esc(company?.name || "Firma")} · ${esc(employee.fullName)}</div></div>
  <div class="title"><div class="eyebrow">Jahreskalender</div><div class="year">${year}</div></div>
</header>

<h2>Jahreskalender</h2>
${renderCalendar({ entries, year, employee })}

<div class="legend">
  <span class="legend-item"><span class="legend-swatch" style="background:#C8A96B"></span>Urlaub</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#4A90E2"></span>Sonderurlaub</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#D64545"></span>Krankheit</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#5E9EA0"></span>Betriebsurlaub</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#EDE4D3"></span>Feiertag</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#fcfaf5;border:0.25pt solid #EAE3D2"></span>Arbeitstag</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#f5f0e8"></span>Wochenende</span>
  <span class="legend-item"><span class="legend-swatch" style="background:#33322D"></span>Nach Vertragsende</span>
</div>

<div class="page-break"></div>

<header class="report-header">
  <div class="company"><div class="name">${esc(company?.name || "Firma")} · ${esc(employee.fullName)}</div></div>
  <div class="title"><div class="eyebrow">Abwesenheiten im Detail</div><div class="year">${year}</div></div>
</header>

<h2>Detaillierte Abwesenheiten</h2>
${renderEntryList({ entries, year })}
${renderSonderReasons({ vacations, employee, year })}

<footer class="report-footer">
  <div>Erstellt mit VacationPlanner Gold</div>
  <div>${esc(company?.name || "")} · ${esc(employee.fullName)} · ${year}</div>
</footer>
</body>
</html>`;
}

// Public entry: open the print-ready report in a new window. Throws with a
// user-actionable message when the browser blocks the popup.
export function openPrintReport({ employee, vacations, company, year }) {
  const html = renderHTML({ employee, vacations, company, year });
  // Note: cannot use `noopener` here — with noopener, `window.open` returns
  // null and we can't write into the new document. Safari also blocks the
  // popup entirely if the click was not the immediately triggering gesture.
  const w = window.open("", "_blank");
  if (!w) {
    throw new Error(
      "Popup wurde vom Browser blockiert. Bitte erlaube Popups für diese Seite und versuche es erneut.",
    );
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the browser a beat to lay out the page before firing the print
  // dialog. On some Safari builds calling print() too early opens an empty
  // print preview.
  const trigger = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore — user can still use the visible button */
    }
  };
  if (w.document.readyState === "complete") {
    setTimeout(trigger, 400);
  } else {
    w.addEventListener("load", () => setTimeout(trigger, 400), { once: true });
  }
}
