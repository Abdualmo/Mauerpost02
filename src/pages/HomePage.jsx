import { useMemo, useState } from "react";
import { Plus, Palmtree } from "lucide-react";
import { useData } from "../contexts/DataContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import EmployeeTable from "../components/vacation/EmployeeTable.jsx";
import EmployeeForm from "../components/vacation/EmployeeForm.jsx";
import TimeOffForm from "../components/vacation/TimeOffForm.jsx";

export default function HomePage({ onOpenEmployee }) {
  const { employees } = useData();
  const { canManage, company } = useAuth();
  const [openNew, setOpenNew] = useState(false);
  const [openCompanyVac, setOpenCompanyVac] = useState(false);

  const year = new Date().getFullYear();

  return (
    <div>
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
