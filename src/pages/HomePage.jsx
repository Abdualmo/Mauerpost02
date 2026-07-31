import { useEffect, useState } from "react";
import { Plus, Palmtree, FolderOpen, Upload, X, Archive, ArchiveRestore, ShieldCheck } from "lucide-react";
import { useData } from "../contexts/DataContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { usePortable } from "../contexts/PortableContext.jsx";
import EmployeeTable from "../components/vacation/EmployeeTable.jsx";
import EmployeeForm from "../components/vacation/EmployeeForm.jsx";
import TimeOffForm from "../components/vacation/TimeOffForm.jsx";
import { isProbationEndingSoon } from "../lib/vacation.js";
import { fmtDate } from "../lib/date.js";

export default function HomePage({ onOpenEmployee }) {
  const { employees, archivedEmployees } = useData();
  const { canManage, company } = useAuth();
  const portable = usePortable();
  const [openNew, setOpenNew] = useState(false);
  const [openCompanyVac, setOpenCompanyVac] = useState(false);
  const [dismissHint, setDismissHint] = useState(false);
  const [view, setView] = useState("active"); // 'active' | 'archive'

  const year = new Date().getFullYear();

  // Auto-return to active view when the archive becomes empty.
  useEffect(() => {
    if (view === "archive" && archivedEmployees.length === 0) {
      setView("active");
    }
  }, [view, archivedEmployees.length]);
  const showPortableHint =
    !portable.isPortable && !dismissHint && employees.length === 0 && archivedEmployees.length === 0;

  const probationSoonList = employees.filter((e) => isProbationEndingSoon(e));

  const list = view === "archive" ? archivedEmployees : employees;

  return (
    <div>
      {showPortableHint && (
        <div className="mb-4 card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 border border-gold/40">
          <div className="flex-1 text-sm">
            <div className="font-medium">Von USB-Stick nutzen?</div>
            <div className="text-black/60">
              Verknüpfe die App mit einer Datei — jede Änderung wird automatisch
              dort gespeichert und wandert mit dem Stick.
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {portable.supportsFS && (
              <>
                <button
                  className="btn-primary !py-1.5"
                  onClick={() => portable.createNew()}
                >
                  <Plus className="w-4 h-4" /> Neue Datei
                </button>
                <button
                  className="btn-ghost bg-white shadow-soft !py-1.5"
                  onClick={() => portable.openExisting()}
                >
                  <FolderOpen className="w-4 h-4" /> Datei öffnen
                </button>
              </>
            )}
            <button
              className="btn-ghost bg-white shadow-soft !py-1.5"
              onClick={() => portable.importClassic()}
            >
              <Upload className="w-4 h-4" /> Importieren
            </button>
            <button
              className="btn-ghost !p-2"
              onClick={() => setDismissHint(true)}
              title="Ausblenden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {probationSoonList.length > 0 && view === "active" && (
        <div
          className="mb-4 card p-4 sm:p-5 border-l-4"
          style={{ borderLeftColor: "#C8A96B", background: "#FBF3DF" }}
        >
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 mt-0.5 text-gold-dark shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-black/80 mb-1">
                {probationSoonList.length === 1
                  ? "Probezeit endet bald"
                  : "Probezeiten enden bald"}
              </div>
              <ul className="space-y-1">
                {probationSoonList.map((e) => (
                  <li key={e.id}>
                    Die Probezeit von{" "}
                    <button
                      className="underline decoration-dotted underline-offset-2 font-medium"
                      onClick={() => onOpenEmployee(e.id)}
                    >
                      {e.fullName}
                    </button>{" "}
                    endet nächsten Monat (
                    <span className="tabular-nums">{fmtDate(e.probationEnd)}</span>).
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            {view === "archive" ? "Archiv" : "Mitarbeiterübersicht"}
          </h1>
          <p className="text-sm text-black/60 mt-1">
            {list.length}
            {list.length === 1 ? " Mitarbeiter" : " Mitarbeiter"} · Jahr {year}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {archivedEmployees.length > 0 && (
            <button
              className="btn-ghost bg-white shadow-soft"
              onClick={() => setView(view === "archive" ? "active" : "archive")}
              title={view === "archive" ? "Zur aktiven Übersicht" : "Archiv anzeigen"}
            >
              {view === "archive" ? (
                <>
                  <ArchiveRestore className="w-4 h-4" />
                  Aktive Mitarbeiter
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  Archiv ({archivedEmployees.length})
                </>
              )}
            </button>
          )}
          {canManage && view === "active" && (
            <>
              <button className="btn-ghost bg-white shadow-soft" onClick={() => setOpenCompanyVac(true)}>
                <Palmtree className="w-4 h-4 text-teal-company" />
                Betriebsurlaub
              </button>
              <button className="btn-primary" onClick={() => setOpenNew(true)}>
                <Plus className="w-4 h-4" />
                Mitarbeiter anlegen
              </button>
            </>
          )}
        </div>
      </div>

      <EmployeeTable
        employees={list}
        year={year}
        onOpen={onOpenEmployee}
        archive={view === "archive"}
      />

      {openNew && (
        <EmployeeForm
          defaultVacationDays={company?.defaultVacationDays ?? 30}
          onClose={() => setOpenNew(false)}
        />
      )}
      {openCompanyVac && (
        <TimeOffForm
          mode="company"
          onClose={() => setOpenCompanyVac(false)}
        />
      )}
    </div>
  );
}
