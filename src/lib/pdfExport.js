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
  sonderurlaubUsageByReason,
  birthdayISO as birthdayForYear,
} from "./vacation.js";
import { fmtDate, todayISO } from "./date.js";

// ---------------------------------------------------------------------------
// Palette (RGB triples). Chosen so print & screen stay readable side-by-side
// with the in-app calendar.
// ---------------------------------------------------------------------------
const C = {
  ink: [26, 26, 26],
  inkSoft: [80, 80, 80],
  inkMuted: [140, 140, 140],
  gold: [200, 169, 107],
  goldDark: [140, 110, 56],
  ruler: [225, 217, 194],
  urlaub: [200, 169, 107],
  betriebsurlaub: [94, 158, 160],
  krankheit: [214, 69, 69],
  sonderurlaub: [74, 144, 226],
  holiday: [237, 228, 211],
  weekend: [232, 224, 208],
  workday: [252, 250, 245],
  terminated: [51, 50, 45],
  today: [26, 26, 26],
  birthday: [247, 221, 227],
  warnBg: [251, 224, 224],
  warnBorder: [214, 69, 69],
  cardBg: [252, 250, 245],
};

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WEEKDAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const TYPE_LABEL = {
  [TYPE_URLAUB]: "Urlaub",
  [TYPE_BETRIEBSURLAUB]: "Betriebsurlaub",
  [TYPE_KRANKHEIT]: "Krankheit",
  [TYPE_SONDERURLAUB]: "Sonderurlaub",
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// German decimal ("5,5"), plus singular/plural noun handling.
function fmtNumDE(n) {
  if (n == null || Number.isNaN(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  const s = rounded.toString();
  return s.replace(".", ",");
}
function fmtDaysDE(n) {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const noun = v === 1 || v === -1 ? "Tag" : "Tage";
  return `${fmtNumDE(v)} ${noun}`;
}

// jsPDF's addImage() throws on the wrong `format` argument, so read the mime
// type out of the data URL and pass the matching value.
function imageFormatFromDataUrl(dataUrl) {
  const m = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl || "");
  if (!m) return null;
  const t = m[1].toLowerCase();
  if (t === "jpg" || t === "jpeg") return "JPEG";
  if (t === "webp") return "WEBP";
  return "PNG";
}

function colorForType(type) {
  if (type === TYPE_URLAUB) return C.urlaub;
  if (type === TYPE_BETRIEBSURLAUB) return C.betriebsurlaub;
  if (type === TYPE_KRANKHEIT) return C.krankheit;
  if (type === TYPE_SONDERURLAUB) return C.sonderurlaub;
  return C.workday;
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

// Expand entries into a per-day lookup: iso -> { entry, isHalf }.
// Employee-specific entries win over company-wide ones on the same day.
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

// ---------------------------------------------------------------------------
// Layout helper: encapsulates the current cursor, page metrics, and
// automatic pagination when a section runs out of room.
// ---------------------------------------------------------------------------
function newLayout(doc, ctx) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginTop = 40;
  const marginBottom = 42;
  const state = {
    doc,
    pageW,
    pageH,
    marginX,
    marginTop,
    marginBottom,
    contentW: pageW - marginX * 2,
    y: marginTop,
    ctx,
  };

  state.ensure = function ensure(space) {
    if (state.y + space > state.pageH - state.marginBottom) {
      state.newPage();
      return true;
    }
    return false;
  };

  state.newPage = function newPage() {
    doc.addPage();
    state.y = marginTop;
    drawPageHeader(state);
  };

  return state;
}

// Top-of-page header (logo + company block on the left; right-aligned
// "Mitarbeiter-Jahresübersicht · Year · Employee-Name"). Called on every
// page including the first one.
function drawPageHeader(L) {
  const { doc, marginX, pageW, ctx } = L;
  const { company, year, employee } = ctx;
  const y = L.marginTop;
  let logoH = 0;
  if (company?.logo) {
    const fmt = imageFormatFromDataUrl(company.logo);
    if (fmt) {
      try {
        doc.addImage(company.logo, fmt, marginX, y, 48, 48, undefined, "FAST");
        logoH = 48;
      } catch (err) {
        console.warn("PDF: Firmenlogo konnte nicht eingefügt werden:", err);
      }
    }
  }
  const textX = logoH > 0 ? marginX + 58 : marginX;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.ink);
  doc.text(company?.name || "Firma", textX, y + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.inkSoft);
  let addrY = y + 26;
  (company?.address || "").split(/\r?\n/).forEach((line) => {
    if (!line.trim()) return;
    doc.text(line, textX, addrY);
    addrY += 10;
  });
  if (company?.contact) {
    doc.text(`Ansprechpartner: ${company.contact}`, textX, addrY);
    addrY += 10;
  }

  const rightX = pageW - marginX;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.goldDark);
  doc.text("MITARBEITER-JAHRESÜBERSICHT", rightX, y + 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...C.ink);
  doc.text(String(year), rightX, y + 28, { align: "right" });
  if (employee?.fullName) {
    doc.setFontSize(9);
    doc.setTextColor(...C.inkSoft);
    doc.text(employee.fullName, rightX, y + 42, { align: "right" });
  }

  const blockBottom = Math.max(logoH, addrY - y);
  const ruleY = y + Math.max(blockBottom, 50) + 6;
  doc.setDrawColor(...C.ruler);
  doc.setLineWidth(0.5);
  doc.line(marginX, ruleY, pageW - marginX, ruleY);
  L.y = ruleY + 14;
}

// Footer applied at the end (once total page count is known).
function drawPageFooter(doc, { pageNum, totalPages, marginX, pageW, pageH }) {
  doc.setDrawColor(...C.ruler);
  doc.setLineWidth(0.4);
  doc.line(marginX, pageH - 30, pageW - marginX, pageH - 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.inkMuted);
  doc.text("Erstellt mit VacationPlanner Gold", marginX, pageH - 18);
  doc.text(
    `Seite ${pageNum} von ${totalPages}`,
    pageW - marginX,
    pageH - 18,
    { align: "right" },
  );
}

// Section heading: gold uppercase title + hairline rule below.
function sectionHeading(L, label) {
  L.ensure(30);
  const { doc, marginX, pageW } = L;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...C.goldDark);
  doc.text(label.toUpperCase(), marginX, L.y);
  L.y += 6;
  doc.setDrawColor(...C.ruler);
  doc.setLineWidth(0.4);
  doc.line(marginX, L.y, pageW - marginX, L.y);
  L.y += 14;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

// Big employee title + primary metadata grid.
function drawEmployeeInfo(L, employee) {
  const { doc, marginX, pageW } = L;

  L.ensure(60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...C.ink);
  doc.text(employee.fullName || "—", marginX, L.y + 10);
  L.y += 18;

  if (employee.personalNumber) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.inkMuted);
    doc.text(`Personalnummer ${employee.personalNumber}`, marginX, L.y);
    L.y += 10;
  }
  L.y += 8;

  const cells = [
    { label: "Abteilung", value: employee.department || "—" },
    { label: "Beschäftigung", value: labelEmploymentType(employee.employmentType) },
    { label: "Wochenstunden", value: `${employee.weeklyHours || 0} h` },
    { label: "Eintritt", value: fmtDate(employee.hireDate) || "—" },
    {
      label: employee.contractStatus === "befristet" ? "Vertragsende" : "Austritt",
      value: employee.terminationDate ? fmtDate(employee.terminationDate) : "—",
      danger: Boolean(employee.terminationDate),
    },
    {
      label: "Vertrag",
      value: employee.contractStatus === "befristet" ? "Befristet" : "Unbefristet",
    },
    {
      label: "Probezeit",
      value: employee.probationEnd
        ? `${employee.probationStart ? fmtDate(employee.probationStart) + " – " : ""}${fmtDate(employee.probationEnd)}`
        : "—",
    },
    { label: "Geburtstag", value: fmtDate(employee.birthDate) || "—" },
    { label: "Bericht erstellt", value: fmtDate(todayISO()) },
  ];

  const cols = 3;
  const colW = (pageW - marginX * 2) / cols;
  const rowH = 30;
  const rowCount = Math.ceil(cells.length / cols);
  L.ensure(rowCount * rowH + 6);
  cells.forEach((cell, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = marginX + c * colW;
    const y = L.y + r * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.inkMuted);
    doc.text(cell.label.toUpperCase(), x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...(cell.danger ? C.krankheit : C.ink));
    doc.text(String(cell.value), x, y + 12);
  });
  L.y += rowCount * rowH + 6;
}

// Balance section — the numbers the user cares about most.
function drawSummary(L, stats) {
  const { doc, marginX, pageW } = L;
  sectionHeading(L, "Urlaubs- und Abwesenheitsbilanz");

  const rows = [
    { label: "Jahresanspruch", value: fmtDaysDE(stats.annual) + (stats.prorated ? `  (anteilig · voll ${fmtNumDE(stats.annualFull)})` : "") },
    { label: "Vorjahresübertrag",
      value: stats.carryoverTotal
        ? `${fmtDaysDE(stats.carryoverTotal)}  (${stats.carryoverAvailable > 0 ? "nutzbar bis 31.03." : "verfallen"})`
        : fmtDaysDE(0),
    },
    { label: "Gesamt verfügbar", value: fmtDaysDE(stats.annual + (stats.carryoverAvailable || 0)) },
    { spacer: true },
    { label: "Bereits genommener Urlaub", value: fmtDaysDE(stats.usedUrlaub) },
    { label: "Angerechneter Betriebsurlaub", value: fmtDaysDE(stats.usedCompany) },
    { label: "Gesamt gegen Anspruch", value: fmtDaysDE(stats.usedAgainstAnnual), bold: true },
    { spacer: true },
    { label: "Verbleibender Urlaub", value: fmtDaysDE(stats.remaining), bold: true, danger: stats.negative, highlight: true },
    { spacer: true },
    { label: "Sonderurlaub (separat gezählt)", value: fmtDaysDE(stats.sonderurlaubTotal || 0) },
    { label: "Krankheitstage", value: fmtDaysDE(stats.sickTotal || 0) },
  ];

  const rowH = 16;
  rows.forEach((r) => {
    if (r.spacer) {
      L.y += 4;
      return;
    }
    L.ensure(rowH + 2);
    if (r.highlight) {
      doc.setFillColor(...C.cardBg);
      doc.rect(marginX - 4, L.y - 11, pageW - marginX * 2 + 8, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.inkSoft);
    doc.text(r.label, marginX, L.y);

    doc.setFont("helvetica", r.bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.setTextColor(...(r.danger ? C.krankheit : C.ink));
    doc.text(String(r.value), pageW - marginX, L.y, { align: "right" });

    L.y += rowH;
  });
}

function drawWarnings(L, employee, stats) {
  const warnings = [];
  if (stats.negative)
    warnings.push(`Negative Urlaubsbilanz: ${fmtDaysDE(stats.remaining)}. Es wurde mehr Urlaub eingetragen als der Jahresanspruch zulässt.`);
  if (stats.carryoverAvailable === 0 && stats.carryoverTotal > 0)
    warnings.push(`Vorjahresrest (${fmtDaysDE(stats.carryoverTotal)}) ist nach dem 31.03. verfallen.`);
  if (employee.terminationDate)
    warnings.push(`Arbeitsverhältnis endet am ${fmtDate(employee.terminationDate)}.`);
  if (warnings.length === 0) return;

  const { doc, marginX, pageW } = L;
  const totalH = 18 + warnings.length * 14 + 8;
  L.ensure(totalH + 20);
  L.y += 6;

  const boxY = L.y - 10;
  doc.setFillColor(...C.warnBg);
  doc.rect(marginX - 4, boxY, pageW - marginX * 2 + 8, totalH, "F");
  doc.setDrawColor(...C.warnBorder);
  doc.setLineWidth(1.2);
  doc.line(marginX - 4, boxY, marginX - 4, boxY + totalH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.warnBorder);
  doc.text("HINWEISE", marginX + 4, L.y);
  L.y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...C.ink);
  warnings.forEach((w) => {
    const lines = doc.splitTextToSize(`• ${w}`, pageW - marginX * 2 - 8);
    lines.forEach((line) => {
      doc.text(line, marginX + 4, L.y);
      L.y += 12;
    });
  });
  L.y += 6;
}

// Full-year calendar as a 4×3 grid of small months.
function drawYearCalendar(L, entries, employee, year) {
  const { doc, marginX, pageW } = L;
  sectionHeading(L, "Jahreskalender");

  const byDay = entriesByDay(entries);
  const holidays = new Map(getGermanHolidays(year).map((h) => [h.iso, h.name]));
  const today = todayISO();
  const bday = birthdayForYear(employee.birthDate, year);
  const term = employee?.terminationDate;

  const cols = 4;
  const rows = 3;
  const gutter = 10;
  const monthW = (pageW - marginX * 2 - gutter * (cols - 1)) / cols;
  const monthH = 130;

  L.ensure(monthH * rows + (rows - 1) * 10 + 20);
  const baseY = L.y;

  for (let m = 0; m < 12; m++) {
    const col = m % cols;
    const row = Math.floor(m / cols);
    const mx = marginX + col * (monthW + gutter);
    const my = baseY + row * (monthH + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.ink);
    doc.text(MONTH_NAMES[m], mx, my);

    // Weekday header (Mo–So)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.inkMuted);
    const dayW = monthW / 7;
    WEEKDAY_HEADERS.forEach((w, i) => {
      doc.text(w, mx + i * dayW + dayW / 2, my + 12, { align: "center" });
    });

    const firstOfMonth = new Date(year, m, 1);
    const firstCol = (getDay(firstOfMonth) + 6) % 7; // Mon=0
    const daysInMonth = getDaysInMonth(firstOfMonth);
    const cellH = 13.5;
    const cellPad = 0.5;

    for (let d = 1; d <= daysInMonth; d++) {
      const cellIdx = firstCol + d - 1;
      const cCol = cellIdx % 7;
      const cRow = Math.floor(cellIdx / 7);
      const cx = mx + cCol * dayW;
      const cy = my + 16 + cRow * cellH;
      const iso = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const date = new Date(year, m, d);
      const dow = getDay(date);
      const weekend = dow === 0 || dow === 6;
      const isHoliday = holidays.has(iso);
      const past = term && iso > term;
      const entryInfo = byDay.get(iso);
      const isToday = iso === today;
      const isBday = bday && iso === bday;

      let bg;
      if (past) bg = C.terminated;
      else if (entryInfo) bg = colorForType(entryInfo.entry.type);
      else if (isHoliday) bg = C.holiday;
      else if (weekend) bg = C.weekend;
      else if (isBday) bg = C.birthday;
      else bg = C.workday;

      const rectX = cx + cellPad;
      const rectY = cy - cellH + 2;
      const rectW = dayW - cellPad * 2;
      const rectH = cellH - 1;

      doc.setFillColor(...bg);
      doc.rect(rectX, rectY, rectW, rectH, "F");

      // Half-day: draw a diagonal white triangle over the right half so the
      // cell reads as half-coloured, matching the on-screen calendar.
      if (entryInfo?.isHalf) {
        doc.setFillColor(255, 255, 255);
        doc.triangle(
          rectX + rectW, rectY,
          rectX + rectW, rectY + rectH,
          rectX, rectY + rectH,
          "F",
        );
      }

      // Today marker: thin dark border.
      if (isToday) {
        doc.setDrawColor(...C.today);
        doc.setLineWidth(0.7);
        doc.rect(rectX, rectY, rectW, rectH);
      }

      // Day number
      doc.setFontSize(6.5);
      const isDarkBg = past || (entryInfo && entryInfo.entry.type !== TYPE_URLAUB);
      doc.setTextColor(...(past ? [180, 180, 180] : isDarkBg && !entryInfo?.isHalf ? [255, 255, 255] : C.ink));
      doc.text(String(d), cx + dayW / 2, cy - 2, { align: "center" });
    }
  }

  L.y = baseY + monthH * rows + (rows - 1) * 10 + 8;
}

function drawLegend(L, employee) {
  const { doc, marginX, pageW } = L;
  L.ensure(48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.goldDark);
  doc.text("LEGENDE", marginX, L.y);
  L.y += 10;

  const items = [
    { color: C.urlaub, label: "Urlaub" },
    { color: C.sonderurlaub, label: "Sonderurlaub" },
    { color: C.krankheit, label: "Krankheit" },
    { color: C.betriebsurlaub, label: "Betriebsurlaub" },
    { color: C.holiday, label: "Feiertag" },
    { color: C.workday, label: "Arbeitstag" },
    { color: C.weekend, label: "Wochenende" },
    { color: null, label: "Halbtag ½ (halbtransparent)" },
  ];
  if (employee.terminationDate) items.push({ color: C.terminated, label: "Nach Vertragsende" });
  if (employee.birthDate) items.push({ color: C.birthday, label: "Geburtstag" });
  items.push({ color: null, label: "Heute (dünner Rahmen)" });

  const cols = 4;
  const cellW = (pageW - marginX * 2) / cols;
  const rowH = 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = marginX + col * cellW;
    const yy = L.y + row * rowH;
    if (it.color) {
      doc.setFillColor(...it.color);
      doc.rect(x, yy - 7, 9, 9, "F");
    } else {
      doc.setDrawColor(...C.inkMuted);
      doc.setLineWidth(0.5);
      doc.rect(x, yy - 7, 9, 9);
    }
    doc.setTextColor(...C.ink);
    doc.text(it.label, x + 13, yy);
  });
  L.y += Math.ceil(items.length / cols) * rowH + 4;
}

// Table of every absence entry in the year, sorted by start date.
function drawEntryList(L, entries, year, employee) {
  const { doc, marginX, pageW } = L;
  sectionHeading(L, "Detaillierte Abwesenheiten");

  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sorted.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.inkMuted);
    doc.text(`Keine Abwesenheiten in ${year}.`, marginX, L.y);
    L.y += 20;
    return;
  }

  // Column layout
  const colX = {
    dot: marginX + 4,
    art: marginX + 14,
    range: marginX + 110,
    days: pageW - marginX - 130,
    notes: pageW - marginX - 130 + 42,
  };
  // Header row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.goldDark);
  doc.text("ART", colX.art, L.y);
  doc.text("ZEITRAUM", colX.range, L.y);
  doc.text("TAGE", colX.days, L.y, { align: "right" });
  doc.text("GRUND / NOTIZ", colX.notes, L.y);
  L.y += 4;
  doc.setDrawColor(...C.ruler);
  doc.setLineWidth(0.3);
  doc.line(marginX, L.y, pageW - marginX, L.y);
  L.y += 10;

  doc.setFontSize(9.5);
  sorted.forEach((e) => {
    // Estimate row height based on wrapped notes.
    const noteParts = [];
    if (e.reason) noteParts.push(`Grund: ${e.reason}`);
    if (e.halfDayStart || e.halfDayEnd) noteParts.push("Halbtag");
    if (e.notes) noteParts.push(e.notes);
    if (e.recurring) noteParts.push("wiederkehrend");
    const notesText = noteParts.join(" · ") || "—";
    const notesLines = doc.splitTextToSize(notesText, pageW - marginX - colX.notes);
    const rowH = Math.max(16, notesLines.length * 11 + 4);

    L.ensure(rowH + 4);

    const days = Math.max(
      0,
      countWorkdaysInYear(e.startDate, e.endDate, year, employee) +
        (e.type === TYPE_URLAUB ? halfDayAdjustment(e, year, employee) : 0),
    );
    const [r, g, b] = colorForType(e.type);
    doc.setFillColor(r, g, b);
    doc.circle(colX.dot, L.y - 3, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...C.ink);
    doc.text(TYPE_LABEL[e.type] || e.type, colX.art, L.y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...C.inkSoft);
    doc.text(`${fmtDate(e.startDate)} – ${fmtDate(e.endDate)}`, colX.range, L.y);
    doc.setTextColor(...C.ink);
    doc.text(fmtDaysDE(days), colX.days, L.y, { align: "right" });

    doc.setTextColor(...C.inkSoft);
    notesLines.forEach((line, i) => {
      doc.text(line, colX.notes, L.y + i * 11);
    });

    L.y += rowH;

    doc.setDrawColor(...C.ruler);
    doc.setLineWidth(0.2);
    doc.line(marginX, L.y - 6, pageW - marginX, L.y - 6);
  });
  L.y += 8;
}

function drawSonderReasons(L, vacations, employee, year) {
  const { doc, marginX, pageW } = L;
  const usage = sonderurlaubUsageByReason(vacations, employee, year);
  if (usage.size === 0) return;

  L.y += 12;
  sectionHeading(L, "Sonderurlaub nach Grund");

  const rowH = 16;
  const rows = Array.from(usage.entries()).sort((a, b) => a[0].localeCompare(b[0], "de"));
  rows.forEach(([reason, days]) => {
    L.ensure(rowH + 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C.ink);
    doc.text(reason, marginX, L.y);
    doc.text(fmtDaysDE(days), pageW - marginX, L.y, { align: "right" });
    L.y += rowH;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Build the full yearly report and return the jsPDF document. Kept as an
// export so tests / callers can post-process it.
export function generateEmployeePDF({ employee, vacations, company, year }) {
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });

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

  const L = newLayout(doc, { company, employee, year });

  // Page 1 — Stammdaten + Bilanz + Hinweise
  drawPageHeader(L);
  drawEmployeeInfo(L, employee);
  drawSummary(L, stats);
  drawWarnings(L, employee, stats);

  // Page 2 — Kalender + Legende
  L.newPage();
  drawYearCalendar(L, entries, employee, year);
  drawLegend(L, employee);

  // Page 3+ — Detaillierte Abwesenheiten + Sonderurlaub nach Grund
  L.newPage();
  drawEntryList(L, entries, year, employee);
  drawSonderReasons(L, vacations, employee, year);

  doc.setProperties({
    title: `Jahresübersicht ${employee.fullName} ${year}`,
    subject: "Mitarbeiter-Jahresübersicht",
    author: company?.name || "VacationPlanner Gold",
    creator: "VacationPlanner Gold",
    keywords: `Urlaub, Jahresübersicht, ${year}`,
  });

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawPageFooter(doc, {
      pageNum: p,
      totalPages: total,
      marginX: L.marginX,
      pageW: L.pageW,
      pageH: L.pageH,
    });
  }
  return doc;
}

// Generates the PDF and triggers a save via the browser's native download
// mechanism: a Blob + an invisible <a download> click. Works on desktop
// Chrome/Firefox/Safari and on Mobile Safari / Chrome-for-iOS without a
// popup ever being requested.
export function downloadEmployeePDF({ employee, vacations, company, year }) {
  if (!employee || !employee.id) {
    throw new Error("Kein Mitarbeiter ausgewählt.");
  }
  const doc = generateEmployeePDF({ employee, vacations, company, year });
  const safeName = (employee.fullName || "Mitarbeiter").replace(/[^\p{L}\p{N}_-]+/gu, "_");
  const filename = `Jahresuebersicht_${safeName}_${year}.pdf`;

  const blob = doc.output("blob");
  if (!blob || blob.size === 0) {
    throw new Error("Die erzeugte PDF-Datei ist leer.");
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.position = "fixed";
  a.style.opacity = "0";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke a little later — revoking immediately can race with the browser
  // still reading the blob on some WebKit builds.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
