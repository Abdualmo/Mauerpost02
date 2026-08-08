import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useData } from "../../contexts/DataContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_SONDERURLAUB,
  TYPE_URLAUB,
  crossesTermination,
  isPastTermination,
} from "../../lib/vacation.js";
import { fmtDate } from "../../lib/date.js";

export default function TimeOffForm({
  mode = "employee",
  employeeId,
  employee: employeeProp,
  initialStart,
  initialEnd,
  onClose,
}) {
  const { createVacation, employees } = useData();
  const { company } = useAuth();
  const employee = employeeProp || employees.find((e) => e.id === employeeId);
  const specialTypes = (company?.specialLeaveTypes || []).filter((t) => t.active !== false);

  const [startDate, setStartDate] = useState(initialStart || "");
  const [endDate, setEndDate] = useState(initialEnd || initialStart || "");
  const [type, setType] = useState(
    mode === "company" ? TYPE_BETRIEBSURLAUB : TYPE_URLAUB,
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [halfDayStart, setHalfDayStart] = useState(false);
  const [halfDayEnd, setHalfDayEnd] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "company") setType(TYPE_BETRIEBSURLAUB);
  }, [mode]);

  // Preselect first available Sonderurlaub reason when the type switches.
  useEffect(() => {
    if (type === TYPE_SONDERURLAUB && !reason && specialTypes.length > 0) {
      setReason(specialTypes[0].label);
    }
    if (type !== TYPE_SONDERURLAUB && reason) setReason("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const singleDay = startDate && endDate && startDate === endDate;
  const showHalfDayOptions = mode !== "company" && type === TYPE_URLAUB && startDate && endDate;

  useEffect(() => {
    if (!showHalfDayOptions) {
      setHalfDayStart(false);
      setHalfDayEnd(false);
    }
  }, [showHalfDayOptions]);

  const terminationBlocked = useMemo(() => {
    if (mode === "company" || !employee?.terminationDate || !startDate || !endDate) return null;
    if (isPastTermination(employee, startDate)) {
      return `Das Arbeitsverhältnis endet am ${fmtDate(employee.terminationDate)}. Für diesen Zeitraum kann keine Abwesenheit eingetragen werden.`;
    }
    if (crossesTermination(employee, startDate, endDate)) {
      return `Das Arbeitsverhältnis endet am ${fmtDate(employee.terminationDate)} — der gewählte Zeitraum überschreitet dieses Datum.`;
    }
    return null;
  }, [mode, employee, startDate, endDate]);

  function submit(e) {
    e.preventDefault();
    setError("");
    if (!startDate || !endDate) return setError("Bitte Von und Bis angeben.");
    if (endDate < startDate) return setError("Enddatum liegt vor Startdatum.");
    if (terminationBlocked) return setError(terminationBlocked);
    if (type === TYPE_SONDERURLAUB && !reason)
      return setError("Bitte einen Grund für den Sonderurlaub wählen.");
    createVacation({
      employeeId: mode === "company" ? null : employeeId,
      startDate,
      endDate,
      type,
      reason: type === TYPE_SONDERURLAUB ? reason : "",
      notes,
      halfDayStart: showHalfDayOptions && halfDayStart,
      halfDayEnd: showHalfDayOptions && !singleDay && halfDayEnd,
    });
    onClose();
  }

  const title =
    mode === "company" ? "Betriebsurlaub eintragen" : "Abwesenheit eintragen";

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog-panel p-5 sm:p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-black/50">
              {mode === "company" ? "Firma" : "Mitarbeiter"}
            </div>
            <div className="font-semibold text-lg">{title}</div>
          </div>
          <button className="btn-ghost !p-2" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Von</label>
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={employee?.terminationDate || undefined}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Bis</label>
              <input
                className="input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                max={employee?.terminationDate || undefined}
              />
            </div>
          </div>

          {mode !== "company" && (
            <div>
              <label className="label">Art</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType(TYPE_URLAUB)}
                  className={`rounded-xl py-2 text-sm font-medium border transition-colors ${
                    type === TYPE_URLAUB
                      ? "bg-gold text-black border-gold"
                      : "border-black/10 hover:bg-gold-softest"
                  }`}
                >
                  Urlaub
                </button>
                <button
                  type="button"
                  onClick={() => setType(TYPE_KRANKHEIT)}
                  className={`rounded-xl py-2 text-sm font-medium border transition-colors ${
                    type === TYPE_KRANKHEIT
                      ? "bg-red-sick text-white border-red-sick"
                      : "border-black/10 hover:bg-red-50"
                  }`}
                >
                  Krankheit
                </button>
                <button
                  type="button"
                  onClick={() => setType(TYPE_SONDERURLAUB)}
                  className={`rounded-xl py-2 text-sm font-medium border transition-colors col-span-2 sm:col-span-1 ${
                    type === TYPE_SONDERURLAUB
                      ? "text-white border-transparent"
                      : "border-black/10 hover:bg-blue-50"
                  }`}
                  style={type === TYPE_SONDERURLAUB ? { backgroundColor: "#4A90E2" } : undefined}
                >
                  Sonderurlaub
                </button>
              </div>
            </div>
          )}

          {type === TYPE_SONDERURLAUB && (
            <div>
              <label className="label">Grund</label>
              {specialTypes.length === 0 ? (
                <div className="text-xs text-black/60 bg-gold-softer rounded-xl px-3 py-2">
                  Es sind keine Sonderurlaubsarten hinterlegt. Bitte in den
                  Einstellungen unter „Sonderurlaub" mindestens eine Kategorie
                  anlegen.
                </div>
              ) : (
                <select
                  className="input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {specialTypes.map((t) => (
                    <option key={t.id} value={t.label}>
                      {t.label}
                      {t.days ? ` (max. ${t.days} Tage)` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {showHalfDayOptions && (
            <fieldset className="border border-black/10 rounded-xl px-3 pt-2 pb-3">
              <legend className="text-xs text-black/50 px-1">
                Halbtagsurlaub (optional)
              </legend>
              {singleDay ? (
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={halfDayStart}
                    onChange={(e) => setHalfDayStart(e.target.checked)}
                  />
                  Dieser Tag zählt als halber Urlaubstag (0,5)
                </label>
              ) : (
                <div className="space-y-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={halfDayStart}
                      onChange={(e) => setHalfDayStart(e.target.checked)}
                    />
                    Erster Tag ist ein halber Tag
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={halfDayEnd}
                      onChange={(e) => setHalfDayEnd(e.target.checked)}
                    />
                    Letzter Tag ist ein halber Tag
                  </label>
                </div>
              )}
            </fieldset>
          )}

          <div>
            <label className="label">Notiz</label>
            <textarea
              className="input min-h-[70px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionale Notiz"
            />
          </div>

          {(error || terminationBlocked) && (
            <div className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
              {error || terminationBlocked}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={Boolean(terminationBlocked)}
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
