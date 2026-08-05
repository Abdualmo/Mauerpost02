import { useState } from "react";
import { X, Archive, ArchiveRestore } from "lucide-react";
import { useData } from "../../contexts/DataContext.jsx";
import { useConfirm } from "../../contexts/ConfirmContext.jsx";

const EMPLOYMENT_TYPES = [
  { value: "", label: "— keine Angabe —" },
  { value: "vollzeit", label: "Vollzeit" },
  { value: "teilzeit", label: "Teilzeit" },
  { value: "minijob", label: "Minijob" },
  { value: "sonstige", label: "Sonstige" },
];

export default function EmployeeForm({
  employee,
  defaultVacationDays = 30,
  onClose,
  onDeleted,
  onArchived,
}) {
  const { createEmployee, updateEmployee, deleteEmployee, archiveEmployee, unarchiveEmployee } =
    useData();
  const confirm = useConfirm();
  const isEdit = Boolean(employee);

  const [fullName, setFullName] = useState(employee?.fullName || "");
  const [yearlyVacationDays, setYearly] = useState(
    employee?.yearlyVacationDays ?? defaultVacationDays,
  );
  const [weeklyHours, setWeekly] = useState(employee?.weeklyHours ?? 40);
  const [hireDate, setHireDate] = useState(employee?.hireDate || "");
  const [terminationDate, setTerminationDate] = useState(employee?.terminationDate || "");
  const [birthDate, setBirthDate] = useState(employee?.birthDate || "");
  const [probationStart, setProbStart] = useState(employee?.probationStart || "");
  const [probationEnd, setProbEnd] = useState(employee?.probationEnd || "");
  const [employmentType, setEmploymentType] = useState(employee?.employmentType || "");
  const [role, setRole] = useState(employee?.role || "employee");
  const [userId, setUserId] = useState(employee?.userId || "");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError("Name ist erforderlich.");
    if (!hireDate) return setError("Eintrittsdatum ist erforderlich.");
    const num = Number(yearlyVacationDays);
    if (Number.isNaN(num) || num < 0)
      return setError("Urlaubstage müssen eine positive Zahl sein.");
    if (probationStart && probationEnd && probationEnd < probationStart)
      return setError("Probezeit-Ende darf nicht vor dem Start liegen.");
    if (terminationDate && terminationDate < hireDate)
      return setError("Austrittsdatum darf nicht vor dem Eintritt liegen.");
    const data = {
      fullName,
      yearlyVacationDays: num,
      weeklyHours: Number(weeklyHours) || 0,
      hireDate,
      terminationDate,
      birthDate,
      probationStart,
      probationEnd,
      employmentType,
      role,
      userId,
    };
    if (isEdit) updateEmployee(employee.id, data);
    else createEmployee(data);
    onClose();
  }

  async function remove() {
    if (!isEdit) return;
    const ok = await confirm({
      title: "Mitarbeiter löschen?",
      message: `Möchtest du „${employee.fullName}" wirklich löschen? Alle zugehörigen Urlaubseinträge werden ebenfalls entfernt.`,
      confirmLabel: "Löschen",
      danger: true,
    });
    if (!ok) return;
    deleteEmployee(employee.id);
    onClose();
    onDeleted && onDeleted();
  }

  async function toggleArchive() {
    if (!isEdit) return;
    if (employee.archived) {
      unarchiveEmployee(employee.id);
      onClose();
      return;
    }
    const ok = await confirm({
      title: "Mitarbeiter archivieren?",
      message: `„${employee.fullName}" wird aus der aktiven Übersicht ausgeblendet. Alle Daten bleiben erhalten und können jederzeit wiederhergestellt werden.`,
      confirmLabel: "Archivieren",
      danger: false,
    });
    if (!ok) return;
    archiveEmployee(employee.id);
    onClose();
    onArchived && onArchived();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog-panel p-5 sm:p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-black/50">
              {isEdit ? "Mitarbeiter bearbeiten" : "Neuer Mitarbeiter"}
            </div>
            <div className="font-semibold text-lg">
              {isEdit ? employee.fullName : "Neuen Mitarbeiter anlegen"}
              {isEdit && employee.archived && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-black/10 text-black/60 align-middle">
                  archiviert
                </span>
              )}
            </div>
          </div>
          <button className="btn-ghost !p-2" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Urlaubstage / Jahr *</label>
              <input
                className="input"
                type="number"
                min="0"
                value={yearlyVacationDays}
                onChange={(e) => setYearly(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Wochenstunden</label>
              <input
                className="input"
                type="number"
                min="0"
                value={weeklyHours}
                onChange={(e) => setWeekly(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Eintrittsdatum *</label>
              <input
                className="input"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Austrittsdatum (optional)</label>
              <input
                className="input"
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                placeholder=""
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Geburtsdatum</label>
              <input
                className="input"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div />
          </div>

          <div>
            <label className="label">Arbeitszeitmodell (optional)</label>
            <select
              className="input"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="border border-black/10 rounded-xl px-3 pt-2 pb-3">
            <legend className="text-xs text-black/50 px-1">
              Probezeit (optional)
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Von</label>
                <input
                  className="input"
                  type="date"
                  value={probationStart}
                  onChange={(e) => setProbStart(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Bis</label>
                <input
                  className="input"
                  type="date"
                  value={probationEnd}
                  onChange={(e) => setProbEnd(e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Rolle</label>
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="employee">Mitarbeiter</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Benutzer-ID (optional)</label>
              <input
                className="input"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              {isEdit && (
                <button type="button" className="btn-ghost bg-black/[0.03]" onClick={toggleArchive}>
                  {employee.archived ? (
                    <>
                      <ArchiveRestore className="w-4 h-4" />
                      Wiederherstellen
                    </>
                  ) : (
                    <>
                      <Archive className="w-4 h-4" />
                      Archivieren
                    </>
                  )}
                </button>
              )}
              {isEdit && (
                <button type="button" className="btn-danger" onClick={remove}>
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary">
                Speichern
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
