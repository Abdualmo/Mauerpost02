import { useState } from "react";
import { Plus, Palmtree, FolderOpen, Upload, X } from "lucide-react";
import { useData } from "../contexts/DataContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { usePortable } from "../contexts/PortableContext.jsx";
import EmployeeTable from "../components/vacation/EmployeeTable.jsx";
import EmployeeForm from "../components/vacation/EmployeeForm.jsx";
import TimeOffForm from "../components/vacation/TimeOffForm.jsx";

export default function HomePage({ onOpenEmployee }) {
  const { employees } = useData();
  const { canManage, company } = useAuth();
  const portable = usePortable();
  const [openNew, setOpenNew] = useState(false);
  const [openCompanyVac, setOpenCompanyVac] = useState(false);
  const [dismissHint, setDismissHint] = useState(false);

  const year = new Date().getFullYear();
  const showPortableHint =
    !portable.isPortable && !dismissHint && employees.length === 0;

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
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            Mitarbeiterübersicht
          </h1>
          <p className="text-sm text-black/60 mt-1">
            {employees.length}
            {employees.length === 1 ? " Mitarbeiter" : " Mitarbeiter"} · Jahr{" "}
            {year}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost bg-white shadow-soft" onClick={() => setOpenCompanyVac(true)}>
              <Palmtree className="w-4 h-4 text-teal-company" />
              Betriebsurlaub
            </button>
            <button className="btn-primary" onClick={() => setOpenNew(true)}>
              <Plus className="w-4 h-4" />
              Mitarbeiter anlegen
            </button>
          </div>
        )}
      </div>

      <EmployeeTable
        employees={employees}
        year={year}
        onOpen={onOpenEmployee}
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
