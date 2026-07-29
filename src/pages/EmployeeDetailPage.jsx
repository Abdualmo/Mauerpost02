import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useData } from "../contexts/DataContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useConfirm } from "../contexts/ConfirmContext.jsx";
import {
  birthdayISO as birthdayForYear,
  collectYearEntries,
  computeYearStats,
  entryCoveringDay,
} from "../lib/vacation.js";
import { fmtDate, todayISO } from "../lib/date.js";
import SummaryCards from "../components/vacation/SummaryCards.jsx";
import YearCalendar from "../components/vacation/YearCalendar.jsx";
import EntryList from "../components/vacation/EntryList.jsx";
import TimeOffForm from "../components/vacation/TimeOffForm.jsx";
import EntryActionDialog from "../components/vacation/EntryActionDialog.jsx";
import EmployeeForm from "../components/vacation/EmployeeForm.jsx";

export default function EmployeeDetailPage({ employeeId, onBack }) {
  const { employees, vacations, company, deleteVacation } = useData();
  const { canManage } = useAuth();
  const confirm = useConfirm();
  const [year, setYear] = useState(new Date().getFullYear());
  const [draftStart, setDraftStart] = useState(null);
  const [draftRange, setDraftRange] = useState(null); // { startDate, endDate }
  const [actionEntry, setActionEntry] = useState(null); // { entry, dayISO }
  const [editEmp, setEditEmp] = useState(false);

  const employee = employees.find((e) => e.id === employeeId);
  const today = todayISO();

  const entries = useMemo(() => {
    if (!employee) return [];
    return collectYearEntries({
      employee,
      vacations,
      recurring: company?.recurringCompanyVacation,
      year,
      companyId: company?.id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, vacations, company, year]);

  const stats = useMemo(() => {
    if (!employee) return null;
    return computeYearStats({ employee, vacations, year });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, vacations, year]);

  if (!employee) {
    return (
      <div className="card p-6">
        <button className="btn-ghost mb-4" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>
        <div className="text-black/60">Mitarbeiter nicht gefunden.</div>
      </div>
    );
  }

  function onDayClick(iso, entry) {
    if (entry) {
      setActionEntry({ entry, dayISO: iso });
      setDraftStart(null);
      return;
    }
    if (!canManage) return;
    if (!draftStart) {
      setDraftStart(iso);
      return;
    }
    const s = iso < draftStart ? iso : draftStart;
    const e = iso < draftStart ? draftStart : iso;
    setDraftRange({ startDate: s, endDate: e });
    setDraftStart(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <button className="btn-ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost bg-white shadow-soft"
            onClick={() => setYear((y) => y - 1)}
            title="Vorheriges Jahr"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-lg font-semibold tabular-nums">{year}</div>
          <button
            className="btn-ghost bg-white shadow-soft"
            onClick={() => setYear((y) => y + 1)}
            title="Nächstes Jahr"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-6 mb-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-black/50">
              Mitarbeiter
            </div>
            <div className="text-2xl sm:text-3xl font-semibold">
              {employee.fullName}
            </div>
            <div className="text-sm text-black/60 mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>{employee.weeklyHours} h/Woche</span>
              {employee.hireDate && (
                <span>Eintritt: {fmtDate(employee.hireDate)}</span>
              )}
              {employee.birthDate && (
                <span>Geburtstag: {fmtDate(employee.birthDate)}</span>
              )}
              <span>Heute: {fmtDate(today)}</span>
            </div>
          </div>
          {canManage && (
            <button className="btn-ghost bg-black/[0.03]" onClick={() => setEditEmp(true)}>
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <SummaryCards stats={stats} year={year} />
      </div>

      <div className="rounded-xl bg-gold-tint p-3 sm:p-4 text-sm text-black/70 mb-4">
        {canManage ? (
          <>
            Tipp: Klicke einen freien Tag im Kalender an, um den Starttag zu
            markieren, und danach einen weiteren Tag, um das Enddatum zu
            wählen. Belegte Tage öffnen ein Aktionsmenü.
          </>
        ) : (
          <>
            Übersicht deiner Abwesenheiten. Änderungen können nur Administratoren
            vornehmen.
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs mb-4">
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: "#C8A96B" }} />
          Urlaub
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: "#5E9EA0" }} />
          Betriebsurlaub
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: "#D64545" }} />
          Krankheit
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm ring-1 ring-black/60" />
          Heute
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-black/10" />
          Wochenende
        </span>
        {employee.birthDate && (
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: "#F7DDE3" }} />
            Geburtstag 🎂
          </span>
        )}
      </div>

      <YearCalendar
        year={year}
        entries={entries}
        draftStartISO={draftStart}
        today={today}
        birthdayISO={birthdayForYear(employee.birthDate, year)}
        onDayClick={onDayClick}
      />

      <div className="mt-6">
        <div className="text-sm font-semibold text-black/70 mb-2">
          Einträge {year}
        </div>
        <EntryList
          entries={entries}
          year={year}
          canManage={canManage}
          onDelete={async (e) => {
            if (e.recurring) return;
            const ok = await confirm({
              title: "Eintrag löschen?",
              message: "Möchtest du diesen Urlaubs-/Krankheits-Eintrag wirklich löschen?",
              confirmLabel: "Löschen",
              danger: true,
            });
            if (!ok) return;
            deleteVacation(e.id);
          }}
        />
      </div>

      {draftRange && canManage && (
        <TimeOffForm
          mode="employee"
          employeeId={employee.id}
          initialStart={draftRange.startDate}
          initialEnd={draftRange.endDate}
          onClose={() => setDraftRange(null)}
        />
      )}

      {actionEntry && (
        <EntryActionDialog
          entry={actionEntry.entry}
          dayISO={actionEntry.dayISO}
          onClose={() => setActionEntry(null)}
        />
      )}

      {editEmp && (
        <EmployeeForm
          employee={employee}
          onClose={() => setEditEmp(false)}
          onDeleted={onBack}
        />
      )}
    </div>
  );
}
