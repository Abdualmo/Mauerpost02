import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Palmtree,
  FolderOpen,
  Upload,
  X,
  Archive,
  ArchiveRestore,
  ShieldCheck,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useData } from "../contexts/DataContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { usePortable } from "../contexts/PortableContext.jsx";
import EmployeeTable from "../components/vacation/EmployeeTable.jsx";
import EmployeeForm from "../components/vacation/EmployeeForm.jsx";
import TimeOffForm from "../components/vacation/TimeOffForm.jsx";
import { isProbationEndingSoon } from "../lib/vacation.js";
import { fmtDate } from "../lib/date.js";

const EMPLOYMENT_LABEL = {
  vollzeit: "Vollzeit",
  teilzeit: "Teilzeit",
  minijob: "Minijob",
  werkstudent: "Werkstudent",
  azubi: "Azubi",
  sonstige: "Sonstige",
};

const STATUS_OPTIONS = [
  { value: "aktiv", label: "Aktiv" },
  { value: "befristet", label: "Befristet" },
  { value: "probezeit", label: "Probezeit" },
];

function matchStatus(emp, statuses) {
  if (!statuses.length) return true;
  return statuses.every((s) => {
    if (s === "aktiv") return !emp.archived && !emp.deletedAt;
    if (s === "befristet") return emp.contractStatus === "befristet";
    if (s === "probezeit") return Boolean(emp.probationEnd);
    return true;
  });
}

export default function HomePage({ onOpenEmployee }) {
  const { employees, archivedEmployees, trashedEmployees } = useData();
  const { canManage, company } = useAuth();
  const portable = usePortable();
  const [openNew, setOpenNew] = useState(false);
  const [openCompanyVac, setOpenCompanyVac] = useState(false);
  const [dismissHint, setDismissHint] = useState(false);
  const [view, setView] = useState("active"); // 'active' | 'archive' | 'trash'
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("__alle__");
  const [selectedType, setSelectedType] = useState(new Set());
  const [selectedStatus, setSelectedStatus] = useState(new Set());

  const year = new Date().getFullYear();

  // Auto-return to active view when the current view has no items.
  useEffect(() => {
    if (view === "archive" && archivedEmployees.length === 0) setView("active");
    if (view === "trash" && trashedEmployees.length === 0) setView("active");
  }, [view, archivedEmployees.length, trashedEmployees.length]);

  const showPortableHint =
    !portable.isPortable && !dismissHint && employees.length === 0 && archivedEmployees.length === 0 && trashedEmployees.length === 0;

  const probationSoonList = employees.filter((e) => isProbationEndingSoon(e));

  const rawList =
    view === "archive"
      ? archivedEmployees
      : view === "trash"
        ? trashedEmployees
        : employees;

  // Departments derived from the current source set — always includes "Alle".
  const departments = useMemo(() => {
    const set = new Set();
    rawList.forEach((e) => e.department && set.add(e.department));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [rawList]);

  // Employment types actually present in the source set — for chip UI.
  const presentTypes = useMemo(() => {
    const set = new Set();
    rawList.forEach((e) => e.employmentType && set.add(e.employmentType));
    return Array.from(set).sort();
  }, [rawList]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawList.filter((emp) => {
      if (q) {
        const hay = `${emp.fullName || ""} ${emp.firstName || ""} ${emp.lastName || ""} ${emp.personalNumber || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (selectedDept !== "__alle__" && emp.department !== selectedDept) return false;
      if (selectedType.size > 0 && !selectedType.has(emp.employmentType || ""))
        return false;
      if (!matchStatus(emp, [...selectedStatus])) return false;
      return true;
    });
  }, [rawList, search, selectedDept, selectedType, selectedStatus]);

  function toggle(setState, value) {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setSelectedDept("__alle__");
    setSelectedType(new Set());
    setSelectedStatus(new Set());
  }

  const anyFilter =
    search ||
    selectedDept !== "__alle__" ||
    selectedType.size > 0 ||
    selectedStatus.size > 0;

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

      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            {view === "trash"
              ? "Papierkorb"
              : view === "archive"
                ? "Archiv"
                : "Mitarbeiterübersicht"}
          </h1>
          <p className="text-sm text-black/60 mt-1">
            {list.length} von {rawList.length}
            {list.length === 1 ? " Mitarbeiter" : " Mitarbeiter"} · Jahr {year}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(archivedEmployees.length > 0 || view === "archive") && (
            <button
              className={`btn-ghost !py-1.5 ${view === "archive" ? "bg-gold text-black" : "bg-white shadow-soft"}`}
              onClick={() => setView(view === "archive" ? "active" : "archive")}
            >
              <Archive className="w-4 h-4" />
              Archiv ({archivedEmployees.length})
            </button>
          )}
          {(trashedEmployees.length > 0 || view === "trash") && (
            <button
              className={`btn-ghost !py-1.5 ${view === "trash" ? "bg-red-sick text-white" : "bg-white shadow-soft text-red-sick"}`}
              onClick={() => setView(view === "trash" ? "active" : "trash")}
            >
              <Trash2 className="w-4 h-4" />
              Papierkorb ({trashedEmployees.length})
            </button>
          )}
          {view !== "active" && (
            <button
              className="btn-ghost bg-white shadow-soft !py-1.5"
              onClick={() => setView("active")}
            >
              <ArchiveRestore className="w-4 h-4" />
              Aktive Mitarbeiter
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

      {/* Search + filter row */}
      {rawList.length > 0 && (
        <div className="card p-3 sm:p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-black/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                className="input !pl-9"
                placeholder="Suche nach Name oder Personalnummer…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {anyFilter && (
              <button className="btn-ghost !py-1.5" onClick={clearFilters}>
                Zurücksetzen
              </button>
            )}
          </div>

          {(departments.length > 0 || presentTypes.length > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              {departments.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/45 mb-1 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Abteilung
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <FilterChip
                      active={selectedDept === "__alle__"}
                      onClick={() => setSelectedDept("__alle__")}
                    >
                      Alle
                    </FilterChip>
                    {departments.map((d) => (
                      <FilterChip
                        key={d}
                        active={selectedDept === d}
                        onClick={() => setSelectedDept(d)}
                      >
                        {d}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              )}
              {presentTypes.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-black/45 mb-1">
                    Beschäftigungsart
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {presentTypes.map((t) => (
                      <FilterChip
                        key={t}
                        active={selectedType.has(t)}
                        onClick={() => toggle(setSelectedType, t)}
                      >
                        {EMPLOYMENT_LABEL[t] || t}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-black/45 mb-1">
                  Status
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <FilterChip
                      key={s.value}
                      active={selectedStatus.has(s.value)}
                      onClick={() => toggle(setSelectedStatus, s.value)}
                    >
                      {s.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <EmployeeTable
        employees={list}
        year={year}
        onOpen={onOpenEmployee}
        archive={view === "archive"}
        trash={view === "trash"}
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

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
        active
          ? "bg-gold text-black border-gold"
          : "bg-white text-black/70 border-black/10 hover:bg-gold-softest"
      }`}
    >
      {children}
    </button>
  );
}
