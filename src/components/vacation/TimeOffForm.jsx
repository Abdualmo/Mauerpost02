import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useData } from "../../contexts/DataContext.jsx";
import {
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_URLAUB,
} from "../../lib/vacation.js";

export default function TimeOffForm({
  mode = "employee", // 'employee' | 'company'
  employeeId,
  initialStart,
  initialEnd,
  onClose,
}) {
  const { createVacation } = useData();
  const [startDate, setStartDate] = useState(initialStart || "");
  const [endDate, setEndDate] = useState(initialEnd || initialStart || "");
  const [type, setType] = useState(
    mode === "company" ? TYPE_BETRIEBSURLAUB : TYPE_URLAUB,
  );
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode === "company") setType(TYPE_BETRIEBSURLAUB);
  }, [mode]);

  function submit(e) {
    e.preventDefault();
    setError("");
    if (!startDate || !endDate) return setError("Bitte Von und Bis angeben.");
    if (endDate < startDate) return setError("Enddatum liegt vor Startdatum.");
    createVacation({
      employeeId: mode === "company" ? null : employeeId,
      startDate,
      endDate,
      type,
      notes,
    });
    onClose();
  }

  const title =
    mode === "company"
      ? "Betriebsurlaub eintragen"
      : "Abwesenheit eintragen";

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
              />
            </div>
          </div>

          {mode !== "company" && (
            <div>
              <label className="label">Art</label>
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            </div>
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

          {error && (
            <div className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary">
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
