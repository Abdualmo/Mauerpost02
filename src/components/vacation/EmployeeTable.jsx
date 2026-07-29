import { useState } from "react";
import { useData } from "../../contexts/DataContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  computeYearStats,
  isAbsentOn,
} from "../../lib/vacation.js";
import { todayISO } from "../../lib/date.js";
import UsedVacationPopover from "./UsedVacationPopover.jsx";

export default function EmployeeTable({ employees, year, onOpen }) {
  const { vacations, company } = useData();
  const { canManage } = useAuth();
  const [popover, setPopover] = useState(null); // { employeeId, anchor }
  const today = todayISO();

  if (employees.length === 0) {
    return (
      <div className="card p-8 text-center text-black/60">
        Noch keine Mitarbeiter angelegt.
        {canManage && (
          <div className="mt-2 text-sm">
            Lege oben deinen ersten Mitarbeiter an.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gold-softer text-left text-black/70">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium text-right">Anspruch</th>
              <th className="px-4 py-3 font-medium text-right">Genommen</th>
              <th className="px-4 py-3 font-medium text-right">Resturlaub</th>
              <th className="px-4 py-3 font-medium text-right">Vorjahr</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const stats = computeYearStats({
                employee: emp,
                vacations,
                year,
              });
              const absent = isAbsentOn({
                employee: emp,
                vacations,
                recurring: company?.recurringCompanyVacation,
                dateISO: today,
                companyId: company?.id,
              });
              return (
                <tr
                  key={emp.id}
                  onClick={() => onOpen(emp.id)}
                  className={`cursor-pointer transition-colors border-t border-black/5 hover:bg-gold-softest ${
                    absent ? "bg-gold-absent" : ""
                  }`}
                  style={
                    absent
                      ? { borderLeft: "3px solid #C8A96B" }
                      : { borderLeft: "3px solid transparent" }
                  }
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{emp.fullName}</span>
                      {absent && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold text-black font-medium">
                          im Urlaub
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-black/50">
                      {emp.weeklyHours} h/Woche
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {stats.annual}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopover({ employeeId: emp.id });
                    }}
                    title="Alle Abwesenheiten anzeigen"
                  >
                    <span className="underline decoration-dotted underline-offset-4">
                      {stats.usedAgainstAnnual}
                    </span>
                    {popover?.employeeId === emp.id && (
                      <UsedVacationPopover
                        employeeId={emp.id}
                        year={year}
                        onClose={() => setPopover(null)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {stats.remaining}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {stats.carryoverTotal > 0 ? (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          stats.carryoverAvailable === 0
                            ? "bg-black/5 text-black/50 line-through"
                            : "bg-gold-past text-black/80"
                        }`}
                        title={
                          stats.carryoverAvailable === 0
                            ? "Verfallen (nach 31.03.)"
                            : `Nutzbar bis 31.03.${year}`
                        }
                      >
                        {stats.carryoverAvailable === 0
                          ? `${stats.carryoverTotal} · verfallen`
                          : `${stats.carryoverRemaining} / ${stats.carryoverAvailable}`}
                      </span>
                    ) : (
                      <span className="text-black/40">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
