import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

export function fmtDate(iso, pattern = "dd.MM.yyyy") {
  if (!iso) return "";
  try {
    return format(parseISO(iso), pattern, { locale: de });
  } catch {
    return "";
  }
}

export function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toISO(d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameISO(a, b) {
  return a && b && a === b;
}

export function monthLabel(monthIdx) {
  const names = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  return names[monthIdx];
}
