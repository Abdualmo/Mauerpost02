import {
  eachDayOfInterval,
  parseISO,
  isWeekend,
  isWithinInterval,
  isAfter,
  isBefore,
  startOfDay,
} from "date-fns";
import { toISO } from "./date.js";

export const TYPE_URLAUB = "urlaub";
export const TYPE_KRANKHEIT = "krankheit";
export const TYPE_BETRIEBSURLAUB = "betriebsurlaub";

// Prorated annual vacation quota:
// - Hired in a prior calendar year -> full annual quota
// - Hired in the current viewing year -> (annual / 12) * full months remaining
//   * Only whole calendar months count. Hire on the 1st -> that month counts;
//     any later day -> the month does NOT count.
// - Hired in a future year -> 0
// Rounding: half rounds up (Math.round on positive numbers).
export function proratedAnnual(employee, year) {
  const annual = Number(employee?.yearlyVacationDays) || 0;
  if (!employee?.hireDate) return annual;
  const hire = parseISO(employee.hireDate);
  const hireYear = hire.getFullYear();
  if (hireYear > year) return 0;
  if (hireYear < year) return annual;
  const firstFullMonth = hire.getDate() === 1 ? hire.getMonth() : hire.getMonth() + 1;
  const months = Math.max(0, 12 - firstFullMonth);
  if (months === 12) return annual;
  const raw = (annual / 12) * months;
  return Math.round(raw);
}

export function isProrated(employee, year) {
  if (!employee?.hireDate) return false;
  const hire = parseISO(employee.hireDate);
  return hire.getFullYear() === year && !(hire.getDate() === 1 && hire.getMonth() === 0);
}

export function isWorkday(date) {
  return !isWeekend(date);
}

export function countWorkdays(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  if (isAfter(start, end)) return 0;
  return eachDayOfInterval({ start, end }).filter(isWorkday).length;
}

export function countWorkdaysInYear(startISO, endISO, year) {
  if (!startISO || !endISO) return 0;
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const clippedStart = isBefore(start, yearStart) ? yearStart : start;
  const clippedEnd = isAfter(end, yearEnd) ? yearEnd : end;
  if (isAfter(clippedStart, clippedEnd)) return 0;
  return eachDayOfInterval({ start: clippedStart, end: clippedEnd }).filter(
    isWorkday,
  ).length;
}

export function countWorkdaysInRange(startISO, endISO, rangeStart, rangeEnd) {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const clippedStart = isBefore(start, rangeStart) ? rangeStart : start;
  const clippedEnd = isAfter(end, rangeEnd) ? rangeEnd : end;
  if (isAfter(clippedStart, clippedEnd)) return 0;
  return eachDayOfInterval({ start: clippedStart, end: clippedEnd }).filter(
    isWorkday,
  ).length;
}

// Materializes recurring company vacations for a given year.
// Rules store month-day pairs (MM-DD). A wrap around year end (e.g. 29.12 -> 02.01)
// is expanded into two entries so that both calendar years render correctly.
export function materializeRecurring(rules, year, companyId) {
  const out = [];
  if (!Array.isArray(rules)) return out;
  rules.forEach((rule, idx) => {
    if (!rule || !rule.start || !rule.end) return;
    const [sm, sd] = rule.start.split("-").map(Number);
    const [em, ed] = rule.end.split("-").map(Number);
    if (!sm || !sd || !em || !ed) return;
    const wraps = em < sm || (em === sm && ed < sd);
    if (!wraps) {
      out.push({
        id: `recurring-${idx}-${year}`,
        companyId,
        employeeId: null,
        startDate: toISO(new Date(year, sm - 1, sd)),
        endDate: toISO(new Date(year, em - 1, ed)),
        type: TYPE_BETRIEBSURLAUB,
        notes: rule.label || "Betriebsurlaub",
        recurring: true,
      });
    } else {
      // First part: from start until end of current year
      out.push({
        id: `recurring-${idx}-${year}-a`,
        companyId,
        employeeId: null,
        startDate: toISO(new Date(year, sm - 1, sd)),
        endDate: toISO(new Date(year, 11, 31)),
        type: TYPE_BETRIEBSURLAUB,
        notes: rule.label || "Betriebsurlaub",
        recurring: true,
      });
      // Second part: from start of current year until end date
      out.push({
        id: `recurring-${idx}-${year}-b`,
        companyId,
        employeeId: null,
        startDate: toISO(new Date(year, 0, 1)),
        endDate: toISO(new Date(year, em - 1, ed)),
        type: TYPE_BETRIEBSURLAUB,
        notes: rule.label || "Betriebsurlaub",
        recurring: true,
      });
    }
  });
  return out;
}

// Returns all entries relevant for an employee in a given year:
// - all their own entries touching the year
// - all recurring company vacations materialized for the year
export function collectYearEntries({
  employee,
  vacations,
  recurring,
  year,
  companyId,
}) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  // Include the employee's own entries AND any company-wide entries
  // (employeeId === null), e.g. one-off Betriebsurlaub for everyone.
  const own = vacations.filter((v) => {
    const belongsToEmployee = v.employeeId === employee.id;
    const companyWide = v.employeeId === null || v.employeeId === undefined;
    if (!belongsToEmployee && !companyWide) return false;
    const s = parseISO(v.startDate);
    const e = parseISO(v.endDate);
    return !(isAfter(s, yearEnd) || isBefore(e, yearStart));
  });
  const mat = materializeRecurring(recurring || [], year, companyId).filter(
    (r) => {
      const s = parseISO(r.startDate);
      const e = parseISO(r.endDate);
      return !(isAfter(s, yearEnd) || isBefore(e, yearStart));
    },
  );
  return [...own, ...mat];
}

// Sum urlaub workdays taken in a given calendar year (by employee)
export function urlaubWorkdaysInYear(vacations, employeeId, year) {
  return vacations
    .filter((v) => v.employeeId === employeeId && v.type === TYPE_URLAUB)
    .reduce((sum, v) => sum + countWorkdaysInYear(v.startDate, v.endDate, year), 0);
}

// Urlaub workdays taken between Jan 1 and Mar 31 of a given year
export function urlaubWorkdaysInQ1(vacations, employeeId, year) {
  const q1Start = new Date(year, 0, 1);
  const q1End = new Date(year, 2, 31);
  return vacations
    .filter((v) => v.employeeId === employeeId && v.type === TYPE_URLAUB)
    .reduce(
      (sum, v) =>
        sum + countWorkdaysInRange(v.startDate, v.endDate, q1Start, q1End),
      0,
    );
}

// Compute the leftover from the previous year (workdays unused).
// If the employee joined the company in the viewed year (or later), no carryover.
export function computeCarryover(employee, vacations, viewYear) {
  const hire = employee.hireDate ? parseISO(employee.hireDate) : null;
  if (hire && hire.getFullYear() >= viewYear) return 0;
  const prevYear = viewYear - 1;
  const usedPrev = urlaubWorkdaysInYear(vacations, employee.id, prevYear);
  const prevCarryover = viewYear - 1 > (hire ? hire.getFullYear() : viewYear - 1)
    ? computeCarryoverRaw(employee, vacations, prevYear)
    : 0;
  const q1PrevUsed = urlaubWorkdaysInQ1(vacations, employee.id, prevYear);
  const q1PrevAgainstCarryover = Math.min(prevCarryover, q1PrevUsed);
  const usedAgainstPrevAnnual = usedPrev - q1PrevAgainstCarryover;
  const remainingPrev = Math.max(
    0,
    proratedAnnual(employee, prevYear) - usedAgainstPrevAnnual,
  );
  return remainingPrev;
}

function computeCarryoverRaw(employee, vacations, year) {
  const hire = employee.hireDate ? parseISO(employee.hireDate) : null;
  if (hire && hire.getFullYear() >= year) return 0;
  const prev = year - 1;
  const usedPrev = urlaubWorkdaysInYear(vacations, employee.id, prev);
  const remaining = Math.max(0, proratedAnnual(employee, prev) - usedPrev);
  return remaining;
}

// Whether the previous year's carryover is still usable (before Apr 1 of viewYear)
export function isCarryoverAvailable(viewYear, today = new Date()) {
  const cutoff = new Date(viewYear, 3, 1); // April 1
  return isBefore(startOfDay(today), cutoff);
}

// Yearly stats for an employee viewed in `year`:
// - annual: yearlyVacationDays
// - carryoverTotal: unused from previous year
// - carryoverAvailable: 0 if past Mar 31 of viewYear, else carryoverTotal
// - usedTotal: total urlaub workdays in year
// - usedAgainstCarryover: min(carryoverTotal, urlaub used in Q1)
// - usedAgainstAnnual: usedTotal - usedAgainstCarryover
// - remaining: max(0, annual - usedAgainstAnnual)
// - carryoverRemaining: carryoverAvailable - usedAgainstCarryover
export function computeYearStats({ employee, vacations, year, today }) {
  const annual = proratedAnnual(employee, year);
  const annualFull = Number(employee.yearlyVacationDays) || 0;
  const prorated = isProrated(employee, year);
  const carryoverTotal = computeCarryover(employee, vacations, year);
  const available = isCarryoverAvailable(year, today || new Date())
    ? carryoverTotal
    : 0;
  const usedTotal = urlaubWorkdaysInYear(vacations, employee.id, year);
  const usedQ1 = urlaubWorkdaysInQ1(vacations, employee.id, year);
  const usedAgainstCarryover = Math.min(available, usedQ1);
  const usedAgainstAnnual = Math.max(0, usedTotal - usedAgainstCarryover);
  const remaining = Math.max(0, annual - usedAgainstAnnual);
  const carryoverRemaining = Math.max(0, available - usedAgainstCarryover);
  const expired = !isCarryoverAvailable(year, today || new Date())
    ? carryoverTotal
    : 0;
  return {
    annual,
    annualFull,
    prorated,
    carryoverTotal,
    carryoverAvailable: available,
    carryoverExpired: expired,
    carryoverRemaining,
    usedTotal,
    usedAgainstAnnual,
    remaining,
  };
}

// Is the given ISO date covered by any entry in the given list?
export function entryCoveringDay(entries, dayISO) {
  const day = parseISO(dayISO);
  return entries.find((e) => {
    const s = parseISO(e.startDate);
    const en = parseISO(e.endDate);
    return isWithinInterval(day, { start: s, end: en });
  }) || null;
}

// Given a birthDate ISO (any year) and a target year, return the ISO for that
// birthday in the target year, or null if no valid birthDate.
export function birthdayISO(birthDateISO, year) {
  if (!birthDateISO) return null;
  const parts = birthDateISO.split("-");
  if (parts.length !== 3) return null;
  const month = parts[1];
  const day = parts[2];
  if (!month || !day) return null;
  return `${year}-${month}-${day}`;
}

// From Nov 1 of the current year, warn when more than 10 remaining days.
// Only relevant for the current calendar year.
export function shouldWarnHighCarryover({ remaining, viewYear, today = new Date() }) {
  const thisYear = today.getFullYear();
  if (viewYear !== thisYear) return false;
  const cutoff = new Date(thisYear, 10, 1); // Nov 1
  if (today < cutoff) return false;
  return remaining > 10;
}

// Is the employee absent today (any relevant entry)?
export function isAbsentOn({ employee, vacations, recurring, dateISO, companyId }) {
  const year = parseISO(dateISO).getFullYear();
  const all = collectYearEntries({
    employee,
    vacations,
    recurring,
    year,
    companyId,
  });
  return Boolean(entryCoveringDay(all, dateISO));
}
