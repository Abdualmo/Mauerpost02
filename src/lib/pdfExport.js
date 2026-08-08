import { jsPDF } from "jspdf";
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
  isPastTermination,
  sonderurlaubUsageByReason,
} from "./vacation.js";
import { fmtDate } from "./date.js";

// Colors chosen to match the app palette.
const COLORS = {
  gold: [200, 169, 107],
  goldDark: [140, 110, 56],
  ink: [26, 26, 26],
  inkSoft: [80, 80, 80],
  inkMuted: [140, 140, 140],
  ruler: [225, 217, 194],
  urlaub: [200, 169, 107],
  betriebsurlaub: [94, 158, 160],
  krankheit: [214, 69, 69],
  sonderurlaub: [74, 144, 226],
  holiday: [237, 228, 211],
  weekend: [245, 240, 232],
  terminated: [51, 50, 45],
  workday: [252, 250, 245],
};

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

function colorForType(type) {
  if (type === TYPE_URLAUB) return COLORS.urlaub;
  if (type === TYPE_BETRIEBSURLAUB) return COLORS.betriebsurlaub;
  if (type === TYPE_KRANKHEIT) return COLORS.krankheit;
  if (type === TYPE_SONDERURLAUB) return COLORS.sonderurlaub;
  return COLORS.workday;
}

// Build a fast lookup: dayISO -> { type, isHalf } for the year.
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
      // Employee-specific entries override company-wide ones on the same day.
      const prev = map.get(iso);
      if (!prev || (prev.entry.employeeId == null && e.employeeId != null)) {
        map.set(iso, { entry: e, isHalf });
      }
      d = addDays(d, 1);
    }
  });
  return map;
}

function drawHeader(doc, { company, employee, year, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 40;

  if (company?.logo) {
    try {
      // Add logo up to 45pt wide/tall
      doc.addImage(company.logo, "PNG", marginX, y, 55, 55, undefined, "FAST");
    } catch {
      // ignore corrupt data URLs
    }
  }
  const textX = company?.logo ? marginX + 65 : marginX;

  doc.setTextColor(...COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company?.name || "Firma", textX, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.inkSoft);
  if (company?.address) {
    company.address.split(/\r?\n/).forEach((line, i) => {
      doc.text(line, textX, y + 30 + i * 11);
    });
  }
  if (company?.contact) {
    doc.text(`Ansprechpartner: ${company.contact}`, textX, y + 30 + (company?.address?.split(/\r?\n/).length || 0) * 11);
  }

  // Right side: Mitarbeiter-Jahresübersicht
  const rightX = pageWidth - marginX;
  doc.setTextColor(...COLORS.goldDark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("MITARBEITER-JAHRESÜBERSICHT", rightX, y + 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(11);
  doc.text(String(year), rightX, y + 30, { align: "right" });

  y += 68;
  doc.setDrawColor(...COLORS.ruler);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  return y + 12;
}

function drawFooter(doc, { pageNum, totalPages, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLORS.ruler);
  doc.setLineWidth(0.4);
  doc.line(marginX, pageHeight - 32, pageWidth - marginX, pageHeight - 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.inkMuted);
  doc.text("Erstellt mit VacationPlanner Gold", marginX, pageHeight - 20);
  doc.text(
    `Seite ${pageNum} von ${totalPages}`,
    pageWidth - marginX,
    pageHeight - 20,
    { align: "right" },
  );
}

function keyValue(doc, x, y, label, value, options = {}) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.inkMuted);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(10);
  doc.setTextColor(...(options.color || COLORS.ink));
  doc.text(value ?? "—", x, y + 12);
}

function drawEmployeeInfo(doc, { employee, y, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colW = (pageWidth - marginX * 2) / 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(employee.fullName, marginX, y);
  if (employee.personalNumber) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.inkMuted);
    doc.text(`Personalnummer ${employee.personalNumber}`, marginX, y + 12);
  }
  let cursorY = y + 30;

  const rows = [
    [
      { label: "Abteilung", value: employee.department || "—" },
      { label: "Beschäftigung", value: labelEmploymentType(employee.employmentType) },
      { label: "Wochenstunden", value: `${employee.weeklyHours || 0} h` },
    ],
    [
      { label: "Eintritt", value: fmtDate(employee.hireDate) },
      {
        label: "Austritt",
        value: employee.terminationDate ? fmtDate(employee.terminationDate) : "—",
        bold: Boolean(employee.terminationDate),
        color: employee.terminationDate ? COLORS.krankheit : COLORS.ink,
      },
      {
        label: "Vertrag",
        value: employee.contractStatus === "befristet" ? "Befristet" : "Unbefristet",
      },
    ],
    [
      {
        label: "Probezeit",
        value: employee.probationEnd
          ? `${employee.probationStart ? fmtDate(employee.probationStart) + " – " : ""}${fmtDate(employee.probationEnd)}`
          : "—",
      },
      {
        label: "Geburtstag",
        value: employee.birthDate ? fmtDate(employee.birthDate) : "—",
      },
      { label: "", value: "" },
    ],
  ];

  rows.forEach((row) => {
    row.forEach((cell, i) => {
      if (cell.label) keyValue(doc, marginX + i * colW, cursorY, cell.label, cell.value, cell);
    });
    cursorY += 32;
  });

  return cursorY + 4;
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
  return map[v] || (v || "—");
}

function drawSummary(doc, { stats, y, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.goldDark);
  doc.text("URLAUBS- UND ABWESENHEITSBILANZ", marginX, y);
  y += 12;
  doc.setDrawColor(...COLORS.ruler);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 14;

  const rows = [
    ["Jahresanspruch", `${stats.annual} Tage${stats.prorated ? ` (anteilig, voll ${stats.annualFull})` : ""}`],
    ["Vorjahresübertrag", stats.carryoverTotal ? `${stats.carryoverTotal} Tage (${stats.carryoverAvailable > 0 ? `nutzbar bis 31.03.` : "verfallen"})` : "0 Tage"],
    ["Bereits genommener Urlaub", `${stats.usedUrlaub ?? 0} Tage`],
    ["Angerechneter Betriebsurlaub", `${stats.usedCompany ?? 0} Tage`],
    ["Gesamt gegen Anspruch", `${stats.usedAgainstAnnual} Tage`],
    ["Verbleibender Urlaub", { text: `${stats.remaining} Tage`, danger: stats.negative }],
    ["Sonderurlaub (separat)", `${stats.sonderurlaubTotal || 0} Tage`],
    ["Krankheitstage", `${stats.sickTotal || 0} Tage`],
  ];

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const rowH = 18;
  rows.forEach((r, i) => {
    doc.setTextColor(...COLORS.inkSoft);
    doc.text(r[0], marginX, y + i * rowH);
    const value = r[1];
    if (typeof value === "object") {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(value.danger ? COLORS.krankheit : COLORS.ink));
      doc.text(value.text, pageWidth - marginX, y + i * rowH, { align: "right" });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.ink);
      doc.text(String(value), pageWidth - marginX, y + i * rowH, { align: "right" });
    }
  });
  y += rows.length * rowH + 2;
  return y;
}

function drawWarnings(doc, { employee, stats, y, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const warnings = [];
  if (stats.negative)
    warnings.push(`Negative Urlaubsbilanz von ${stats.remaining} Tagen.`);
  if (stats.carryoverAvailable === 0 && stats.carryoverTotal > 0)
    warnings.push(`Vorjahresrest (${stats.carryoverTotal} Tage) ist nach dem 31.03. verfallen.`);
  if (employee.terminationDate)
    warnings.push(`Arbeitsverhältnis endet am ${fmtDate(employee.terminationDate)}.`);
  if (warnings.length === 0) return y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.krankheit);
  doc.text("HINWEISE", marginX, y);
  y += 12;
  doc.setDrawColor(...COLORS.ruler);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  warnings.forEach((w) => {
    doc.text(`• ${w}`, marginX, y);
    y += 14;
  });
  return y + 4;
}

function drawLegend(doc, { y, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.goldDark);
  doc.text("LEGENDE", marginX, y);
  y += 10;

  const items = [
    { color: COLORS.urlaub, label: "Urlaub" },
    { color: COLORS.sonderurlaub, label: "Sonderurlaub" },
    { color: COLORS.krankheit, label: "Krankheit" },
    { color: COLORS.betriebsurlaub, label: "Betriebsurlaub" },
    { color: COLORS.holiday, label: "Feiertag" },
    { color: COLORS.workday, label: "Arbeitstag" },
    { color: COLORS.weekend, label: "Wochenende" },
    { color: COLORS.terminated, label: "Nach Vertragsende" },
  ];
  const boxW = 10;
  const cellW = (pageWidth - marginX * 2) / 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  items.forEach((it, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = marginX + col * cellW;
    const yy = y + row * 14;
    doc.setFillColor(...it.color);
    doc.rect(x, yy - 8, boxW, boxW, "F");
    doc.text(it.label, x + boxW + 4, yy);
  });
  return y + Math.ceil(items.length / 4) * 14 + 4;
}

function drawYearCalendar(doc, { employee, entries, year, y, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - marginX * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.goldDark);
  doc.text("JAHRESKALENDER", marginX, y);
  y += 12;
  doc.setDrawColor(...COLORS.ruler);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 10;

  const byDay = entriesByDay(entries);
  const holidayMap = new Map(getGermanHolidays(year).map((h) => [h.iso, h.name]));

  const cols = 4;
  const rows = 3;
  const gutter = 10;
  const monthW = (availableWidth - gutter * (cols - 1)) / cols;
  const monthH = 118;

  for (let m = 0; m < 12; m++) {
    const col = m % cols;
    const row = Math.floor(m / cols);
    const mx = marginX + col * (monthW + gutter);
    const my = y + row * (monthH + 10);

    // Month title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.ink);
    doc.text(MONTH_NAMES[m], mx, my);

    // Weekday header
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.inkMuted);
    const dayW = monthW / 7;
    ["M", "D", "M", "D", "F", "S", "S"].forEach((w, i) => {
      doc.text(w, mx + i * dayW + dayW / 2, my + 10, { align: "center" });
    });

    // Days
    const firstOfMonth = new Date(year, m, 1);
    const firstCol = (getDay(firstOfMonth) + 6) % 7; // Mon = 0
    const daysInMonth = getDaysInMonth(firstOfMonth);
    const cellH = 12;
    for (let d = 1; d <= daysInMonth; d++) {
      const cellIdx = firstCol + d - 1;
      const cCol = cellIdx % 7;
      const cRow = Math.floor(cellIdx / 7);
      const cx = mx + cCol * dayW;
      const cy = my + 14 + cRow * cellH;
      const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const date = new Date(year, m, d);
      const dow = getDay(date); // 0=Sun,6=Sat
      const weekend = dow === 0 || dow === 6;
      const holiday = holidayMap.has(iso);
      const past = employee?.terminationDate && iso > employee.terminationDate;
      const entryInfo = byDay.get(iso);

      let bg;
      if (past) bg = COLORS.terminated;
      else if (entryInfo) bg = colorForType(entryInfo.entry.type);
      else if (holiday) bg = COLORS.holiday;
      else if (weekend) bg = COLORS.weekend;
      else bg = COLORS.workday;

      doc.setFillColor(...bg);
      doc.rect(cx, cy - cellH + 2, dayW - 0.5, cellH - 0.5, "F");
      doc.setFontSize(6);
      const textColor = past
        ? [180, 180, 180]
        : entryInfo &&
            (entryInfo.entry.type === TYPE_BETRIEBSURLAUB ||
              entryInfo.entry.type === TYPE_KRANKHEIT ||
              entryInfo.entry.type === TYPE_SONDERURLAUB)
          ? [255, 255, 255]
          : COLORS.ink;
      doc.setTextColor(...textColor);
      doc.text(String(d), cx + dayW / 2, cy - 1, { align: "center" });
      if (entryInfo?.isHalf) {
        doc.setFontSize(5);
        doc.text("½", cx + dayW - 2, cy - cellH + 6, { align: "right" });
      }
    }
  }

  y += monthH * rows + 10 * (rows - 1) + 8;
  return y;
}

function drawEntryList(doc, { entries, year, y, marginX }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.goldDark);
  doc.text("DETAILLIERTE ABWESENHEITEN", marginX, y);
  y += 12;
  doc.setDrawColor(...COLORS.ruler);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sorted.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.inkMuted);
    doc.text("Keine Abwesenheiten im Jahr.", marginX, y);
    return y + 20;
  }

  doc.setFontSize(9);
  const rowH = 16;
  sorted.forEach((e, i) => {
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = 60;
    }
    const days = Math.max(
      0,
      countWorkdaysInYear(e.startDate, e.endDate, year) +
        (e.type === TYPE_URLAUB ? halfDayAdjustment(e, year) : 0),
    );
    const [r, g, b] = colorForType(e.type);
    doc.setFillColor(r, g, b);
    doc.circle(marginX + 4, y - 3, 3, "F");
    doc.setTextColor(...COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.text(TYPE_LABEL[e.type] || e.type, marginX + 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.inkSoft);
    doc.text(
      `${fmtDate(e.startDate)} – ${fmtDate(e.endDate)}   ·   ${days} Arbeitstag${days === 1 ? "" : "e"}${e.halfDayStart || e.halfDayEnd ? " · Halbtag" : ""}${e.reason ? ` · Grund: ${e.reason}` : ""}${e.notes ? ` · ${e.notes}` : ""}`,
      marginX + 14,
      y + 10,
      { maxWidth: pageWidth - marginX * 2 - 14 },
    );
    y += rowH + 10;
  });
  return y;
}

function drawSonderurlaubSummary(doc, { vacations, employee, year, y, marginX }) {
  const usage = sonderurlaubUsageByReason(vacations, employee.id, year);
  if (usage.size === 0) return y;

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.goldDark);
  doc.text("SONDERURLAUB NACH GRUND", marginX, y);
  y += 12;
  doc.setDrawColor(...COLORS.ruler);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  Array.from(usage.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "de"))
    .forEach(([reason, days]) => {
      doc.text(reason, marginX, y);
      doc.text(`${days} Tag${days === 1 ? "" : "e"}`, pageWidth - marginX, y, { align: "right" });
      y += 14;
    });
  return y + 4;
}

/**
 * Generate a professional yearly report PDF for an employee.
 * Returns a Blob for saving or download.
 */
export function generateEmployeePDF({ employee, vacations, company, year }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 40;

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

  // Page 1 — header + employee info + summary + warnings
  let y = drawHeader(doc, { company, employee, year, marginX });
  y = drawEmployeeInfo(doc, { employee, y, marginX });
  y = drawSummary(doc, { stats, y, marginX });
  y = drawWarnings(doc, { employee, stats, y, marginX });

  // Page 2 — calendar + legend
  doc.addPage();
  y = drawHeader(doc, { company, employee, year, marginX });
  y = drawYearCalendar(doc, { employee, entries, year, y, marginX });
  y = drawLegend(doc, { y, marginX });

  // Page 3 — entries list (multi-page as needed)
  doc.addPage();
  y = drawHeader(doc, { company, employee, year, marginX });
  y = drawEntryList(doc, { entries, year, y, marginX });
  y = drawSonderurlaubSummary(doc, { vacations, employee, year, y, marginX });

  // Metadata + footers
  doc.setProperties({
    title: `Jahresübersicht ${employee.fullName} ${year}`,
    subject: "Mitarbeiter-Jahresübersicht",
    author: company?.name || "VacationPlanner Gold",
    creator: "VacationPlanner Gold",
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, { pageNum: p, totalPages: total, marginX });
  }

  return doc;
}

export function downloadEmployeePDF({ employee, vacations, company, year }) {
  const doc = generateEmployeePDF({ employee, vacations, company, year });
  const safeName = (employee.fullName || "Mitarbeiter").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  doc.save(`Jahresuebersicht_${safeName}_${year}.pdf`);
}
