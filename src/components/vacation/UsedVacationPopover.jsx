import { useEffect, useRef } from "react";
import { useData } from "../../contexts/DataContext.jsx";
import {
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_SONDERURLAUB,
  TYPE_URLAUB,
  collectYearEntries,
  countWorkdaysInYear,
} from "../../lib/vacation.js";
import { fmtDate } from "../../lib/date.js";

const dotFor = (t) =>
  t === TYPE_URLAUB
    ? { color: "#C8A96B", label: "Urlaub" }
    : t === TYPE_BETRIEBSURLAUB
      ? { color: "#5E9EA0", label: "Betriebsurlaub" }
      : t === TYPE_KRANKHEIT
        ? { color: "#D64545", label: "Krankheit" }
        : t === TYPE_SONDERURLAUB
          ? { color: "#4A90E2", label: "Sonderurlaub" }
          : { color: "#999", label: t };

export default function UsedVacationPopover({ employeeId, year, onClose }) {
  const { vacations, company, employees } = useData();
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onEsc(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const employee = employees.find((e) => e.id === employeeId);
  if (!employee) return null;

  const entries = collectYearEntries({
    employee,
    vacations,
    recurring: company?.recurringCompanyVacation,
    year,
    companyId: company?.id,
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div
      ref={ref}
      className="absolute right-2 top-full mt-1 z-30 card p-3 w-72 text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs uppercase tracking-wide text-black/50 mb-2">
        Abwesenheiten {year}
      </div>
      {entries.length === 0 ? (
        <div className="text-sm text-black/50">Keine Einträge in {year}.</div>
      ) : (
        <ul className="max-h-64 overflow-y-auto scrollbar-thin divide-y divide-black/5">
          {entries.map((e) => {
            const days = countWorkdaysInYear(e.startDate, e.endDate, year, employee);
            const dot = dotFor(e.type);
            return (
              <li key={e.id} className="py-2 flex items-start gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: dot.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    {fmtDate(e.startDate)} – {fmtDate(e.endDate)}
                  </div>
                  <div className="text-xs text-black/50">
                    {days} Arbeitstag{days === 1 ? "" : "e"}
                    {e.type !== TYPE_URLAUB && ` · ${dot.label}`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
