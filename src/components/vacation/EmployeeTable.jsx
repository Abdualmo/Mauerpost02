import { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useData } from "../../contexts/DataContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useConfirm } from "../../contexts/ConfirmContext.jsx";
import {
  computeYearStats,
  isAbsentOn,
  isProbationEndingSoon,
  shouldWarnHighCarryover,
} from "../../lib/vacation.js";
import { fmtDate } from "../../lib/date.js";
import { ackWarning, isWarningAcked } from "../../lib/storage.js";
import { todayISO } from "../../lib/date.js";
import UsedVacationPopover from "./UsedVacationPopover.jsx";
import SwipeableRow from "./SwipeableRow.jsx";

const EMPLOYMENT_LABEL = {
  vollzeit: "Vollzeit",
  teilzeit: "Teilzeit",
  minijob: "Minijob",
  sonstige: "Sonstige",
};

function EmployeeRow({ emp, year, today, onOpen, onPopover, popoverOpen, archived = false }) {
  const { vacations, company } = useData();
  const stats = computeYearStats({
    employee: emp,
    vacations,
    recurring: company?.recurringCompanyVacation,
    year,
  });
  const absent = isAbsentOn({
    employee: emp,
    vacations,
    recurring: company?.recurringCompanyVacation,
    dateISO: today,
    companyId: company?.id,
  });
  const warn =
    shouldWarnHighCarryover({
      remaining: stats.remaining,
      viewYear: year,
    }) && !isWarningAcked(emp.id, year);
  const probationSoon = isProbationEndingSoon(emp);
  const negative = stats.negative;

  const bgClass = negative
    ? "bg-red-50"
    : absent
      ? "bg-gold-absent"
      : "hover:bg-gold-softest";
  const borderColor = negative ? "#D64545" : absent ? "#C8A96B" : "transparent";

  return (
    <div
      onClick={() => onOpen(emp.id)}
      className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-3 sm:px-4 py-3 text-sm cursor-pointer transition-colors ${bgClass}`}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Name + hints */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{emp.fullName}</span>
          {absent && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gold text-black font-medium">
              im Urlaub
            </span>
          )}
          {negative && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-sick text-white font-medium">
              <AlertTriangle className="w-3 h-3" />
              negativ ({stats.remaining})
            </span>
          )}
          {archived && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/10 text-black/60">
              archiviert
            </span>
          )}
          {warn && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-sick text-white font-medium hover:brightness-110"
              title={`Mehr als 10 Resturlaubstage übrig (${stats.remaining}). Antippen zum Ausblenden.`}
              onClick={(e) => {
                e.stopPropagation();
                ackWarning(emp.id, year);
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              {stats.remaining} Resttage
            </button>
          )}
          {probationSoon && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#F0DDB4] text-black/80 font-medium"
              title={`Probezeit endet am ${fmtDate(emp.probationEnd)}`}
            >
              <ShieldCheck className="w-3 h-3" />
              Probezeit endet {fmtDate(emp.probationEnd)}
            </span>
          )}
        </div>
        <div className="text-xs text-black/50 truncate">
          {emp.employmentType && (
            <>{EMPLOYMENT_LABEL[emp.employmentType] || emp.employmentType} · </>
          )}
          {emp.weeklyHours} h/Woche
          {stats.prorated && (
            <> · anteilig {stats.annual} / {stats.annualFull} Tage</>
          )}
          {stats.sickTotal > 0 && (
            <> · {stats.sickTotal} Krankheitstage</>
          )}
        </div>
      </div>

      <div className="text-right tabular-nums w-14">{stats.annual}</div>

      <div
        className="text-right tabular-nums w-14 relative"
        onClick={(e) => {
          e.stopPropagation();
          onPopover(emp.id);
        }}
        title="Alle Abwesenheiten anzeigen"
      >
        <span className="underline decoration-dotted underline-offset-4">
          {stats.usedAgainstAnnual}
        </span>
        {popoverOpen && (
          <UsedVacationPopover
            employeeId={emp.id}
            year={year}
            onClose={() => onPopover(null)}
          />
        )}
      </div>

      <div
        className={`text-right tabular-nums w-16 font-medium ${negative ? "text-red-sick" : ""}`}
      >
        {stats.remaining}
      </div>

      <div className="text-right w-24 hidden sm:block">
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
      </div>
    </div>
  );
}

export default function EmployeeTable({ employees, year, onOpen, archive = false }) {
  const { canManage } = useAuth();
  const { deleteEmployee, unarchiveEmployee } = useData();
  const confirm = useConfirm();
  const [popover, setPopover] = useState(null);
  const today = todayISO();

  async function askAndDelete(emp) {
    if (!canManage) return false;
    const ok = await confirm({
      title: "Mitarbeiter löschen?",
      message: `Möchtest du „${emp.fullName}" wirklich löschen? Alle zugehörigen Urlaubseinträge werden ebenfalls entfernt.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return false;
    deleteEmployee(emp.id);
    return true;
  }

  if (employees.length === 0) {
    return (
      <div className="card p-8 text-center text-black/60">
        {archive ? (
          <>Keine archivierten Mitarbeiter.</>
        ) : (
          <>
            Noch keine Mitarbeiter angelegt.
            {canManage && (
              <div className="mt-2 text-sm">
                Lege oben deinen ersten Mitarbeiter an.
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center px-3 sm:px-4 py-2 bg-gold-softer text-left text-xs text-black/60 uppercase tracking-wide">
        <div>Name</div>
        <div className="w-14 text-right">Anspruch</div>
        <div className="w-14 text-right">Genom.</div>
        <div className="w-16 text-right">Rest</div>
        <div className="w-24 text-right hidden sm:block">Vorjahr</div>
      </div>

      <ul className="divide-y divide-black/5">
        {employees.map((emp) => (
          <li key={emp.id} className="relative">
            {canManage && !archive ? (
              <SwipeableRow onDelete={() => askAndDelete(emp)}>
                <EmployeeRow
                  emp={emp}
                  year={year}
                  today={today}
                  onOpen={onOpen}
                  onPopover={setPopover}
                  popoverOpen={popover === emp.id}
                />
              </SwipeableRow>
            ) : (
              <div className="flex items-center gap-2 pr-3">
                <div className="flex-1">
                  <EmployeeRow
                    emp={emp}
                    year={year}
                    today={today}
                    onOpen={onOpen}
                    onPopover={setPopover}
                    popoverOpen={popover === emp.id}
                    archived={archive}
                  />
                </div>
                {archive && canManage && (
                  <button
                    className="btn-ghost bg-white shadow-soft !py-1.5 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      unarchiveEmployee(emp.id);
                    }}
                    title="Wiederherstellen"
                  >
                    Wiederherstellen
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {canManage && !archive && (
        <div className="text-[11px] text-black/40 px-3 sm:px-4 py-2 border-t border-black/5">
          Tipp: Zeile nach links wischen, um zu löschen.
        </div>
      )}
    </div>
  );
}
