import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useData } from "../../contexts/DataContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  computeYearStats,
  isAbsentOn,
  shouldWarnHighCarryover,
} from "../../lib/vacation.js";
import { ackWarning, isWarningAcked } from "../../lib/storage.js";
import { todayISO } from "../../lib/date.js";
import UsedVacationPopover from "./UsedVacationPopover.jsx";
import SwipeableRow from "./SwipeableRow.jsx";

function EmployeeRow({ emp, year, today, onOpen, onDelete, onPopover, popoverOpen }) {
  const { vacations, company } = useData();
  const stats = computeYearStats({ employee: emp, vacations, year });
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

  return (
    <div
      onClick={() => onOpen(emp.id)}
      className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-3 sm:px-4 py-3 text-sm cursor-pointer transition-colors group ${
        absent ? "bg-gold-absent" : "hover:bg-gold-softest"
      }`}
      style={
        absent
          ? { borderLeft: "3px solid #C8A96B" }
          : { borderLeft: "3px solid transparent" }
      }
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
        </div>
        <div className="text-xs text-black/50 truncate">
          {emp.weeklyHours} h/Woche
          {stats.prorated && (
            <> · anteilig {stats.annual} / {stats.annualFull} Tage</>
          )}
        </div>
      </div>

      {/* Anspruch */}
      <div className="text-right tabular-nums w-14">{stats.annual}</div>

      {/* Genommen (with popover) */}
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

      {/* Rest */}
      <div className="text-right tabular-nums w-16 font-medium">
        {stats.remaining}
      </div>

      {/* Vorjahr */}
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

      {/* Desktop hover trash */}
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-black/40 hover:text-red-sick p-1 hidden sm:inline-flex"
        title="Mitarbeiter löschen"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(emp);
        }}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function EmployeeTable({ employees, year, onOpen }) {
  const { canManage, company } = useAuth();
  const { deleteEmployee } = useData();
  const [popover, setPopover] = useState(null);
  const today = todayISO();

  function confirmDelete(emp) {
    if (!canManage) return;
    if (
      confirm(
        `Möchten Sie „${emp.fullName}" wirklich löschen? Alle zugehörigen Einträge werden mit gelöscht.`,
      )
    ) {
      deleteEmployee(emp.id);
    }
  }

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
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-3 sm:px-4 py-2 bg-gold-softer text-left text-xs text-black/60 uppercase tracking-wide">
        <div>Name</div>
        <div className="w-14 text-right">Anspruch</div>
        <div className="w-14 text-right">Genom.</div>
        <div className="w-16 text-right">Rest</div>
        <div className="w-24 text-right hidden sm:block">Vorjahr</div>
        <div className="w-6" />
      </div>

      {/* Rows */}
      <ul className="divide-y divide-black/5">
        {employees.map((emp) => (
          <li key={emp.id}>
            {canManage ? (
              <SwipeableRow onDelete={() => confirmDelete(emp)}>
                <EmployeeRow
                  emp={emp}
                  year={year}
                  today={today}
                  onOpen={onOpen}
                  onDelete={confirmDelete}
                  onPopover={setPopover}
                  popoverOpen={popover === emp.id}
                />
              </SwipeableRow>
            ) : (
              <EmployeeRow
                emp={emp}
                year={year}
                today={today}
                onOpen={onOpen}
                onDelete={confirmDelete}
                onPopover={setPopover}
                popoverOpen={popover === emp.id}
              />
            )}
          </li>
        ))}
      </ul>

      {/* Mobile hint */}
      {canManage && (
        <div className="text-[11px] text-black/40 px-3 sm:px-4 py-2 border-t border-black/5 sm:hidden">
          Tipp: Zeile nach links wischen, um zu löschen.
        </div>
      )}
    </div>
  );
}
