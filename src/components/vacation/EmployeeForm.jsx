import { useState } from "react";
import { X } from "lucide-react";
import { useData } from "../../contexts/DataContext.jsx";

export default function EmployeeForm({
  employee,
  defaultVacationDays = 30,
  onClose,
  onDeleted,
}) {
  const { createEmployee, updateEmployee, deleteEmployee } = useData();
  const isEdit = Boolean(employee);

  const [fullName, setFullName] = useState(employee?.fullName || "");
  const [yearlyVacationDays, setYearly] = useState(
    employee?.yearlyVacationDays ?? defaultVacationDays,
  );
  const [weeklyHours, setWeekly] = useState(employee?.weeklyHours ?? 40);
  const [hireDate, setHireDate] = useState(employee?.hireDate || "");
  const [birthDate, setBirthDate] = useState(employee?.birthDate || "");
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
    const data = {
      fullName,
      yearlyVacationDays: num,
      weeklyHours: Number(weeklyHours) || 0,
      hireDate,
      birthDate,
      role,
      userId,
    };
    if (isEdit) updateEmployee(employee.id, data);
    else createEmployee(data);
    onClose();
  }

  function remove() {
    if (!isEdit) return;
    if (
      !confirm(
        `Mitarbeiter „${employee.fullName}" und alle zugehörigen Einträge löschen?`,
      )
    )
      return;
    deleteEmployee(employee.id);
    onClose();
    onDeleted && onDeleted();
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
              <label className="label">Geburtsdatum</label>
              <input
                className="input"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>
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
            {isEdit ? (
              <button type="button" className="btn-danger" onClick={remove}>
                Löschen
              </button>
            ) : (
              <span />
            )}
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
