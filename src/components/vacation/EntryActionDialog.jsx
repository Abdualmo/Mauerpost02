import { useState } from "react";
import { X, Trash2, StickyNote, Scissors } from "lucide-react";
import { fmtDate } from "../../lib/date.js";
import {
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_URLAUB,
} from "../../lib/vacation.js";
import { addDays, parseISO } from "date-fns";
import { toISO } from "../../lib/date.js";
import { useData } from "../../contexts/DataContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

const meta = {
  [TYPE_URLAUB]: { color: "#C8A96B", label: "Urlaub" },
  [TYPE_BETRIEBSURLAUB]: { color: "#5E9EA0", label: "Betriebsurlaub" },
  [TYPE_KRANKHEIT]: { color: "#D64545", label: "Krankheit" },
};

export default function EntryActionDialog({ entry, dayISO, onClose }) {
  const { updateVacation, deleteVacation, createVacation } = useData();
  const { canManage } = useAuth();
  const [notes, setNotes] = useState(entry.notes || "");
  const [savedMsg, setSavedMsg] = useState("");
  const isRecurring = Boolean(entry.recurring);
  const m = meta[entry.type] || { color: "#999", label: entry.type };

  function saveNotes() {
    if (!canManage || isRecurring) return;
    updateVacation(entry.id, { notes });
    setSavedMsg("Notiz gespeichert.");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  function deleteEntire() {
    if (!canManage || isRecurring) return;
    if (!confirm("Kompletten Zeitraum wirklich löschen?")) return;
    deleteVacation(entry.id);
    onClose();
  }

  function removeSingleDay() {
    if (!canManage || isRecurring) return;
    const day = parseISO(dayISO);
    const start = parseISO(entry.startDate);
    const end = parseISO(entry.endDate);
    if (day < start || day > end) return;

    const sameDay = entry.startDate === entry.endDate;
    if (sameDay) {
      deleteVacation(entry.id);
      onClose();
      return;
    }
    if (dayISO === entry.startDate) {
      // Shorten from start
      const newStart = toISO(addDays(day, 1));
      updateVacation(entry.id, { startDate: newStart });
      onClose();
      return;
    }
    if (dayISO === entry.endDate) {
      const newEnd = toISO(addDays(day, -1));
      updateVacation(entry.id, { endDate: newEnd });
      onClose();
      return;
    }
    // Middle day: split into two entries
    const firstEnd = toISO(addDays(day, -1));
    const secondStart = toISO(addDays(day, 1));
    updateVacation(entry.id, { endDate: firstEnd });
    createVacation({
      employeeId: entry.employeeId,
      startDate: secondStart,
      endDate: entry.endDate,
      type: entry.type,
      notes: entry.notes || "",
    });
    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div className="dialog-panel p-5 sm:p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <span
            className="w-3 h-3 rounded-full mt-1.5"
            style={{ backgroundColor: m.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-black/50 uppercase tracking-wide">
              {m.label}
              {isRecurring && " · wiederkehrend"}
            </div>
            <div className="font-medium">
              {fmtDate(entry.startDate)} – {fmtDate(entry.endDate)}
            </div>
            <div className="text-xs text-black/50">
              Angeklickter Tag: {fmtDate(dayISO)}
            </div>
          </div>
          <button className="btn-ghost !p-2" onClick={onClose} title="Schließen">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isRecurring ? (
          <div className="text-sm text-black/60 bg-gold-softer rounded-xl p-3">
            Dies ist ein wiederkehrender Betriebsurlaub. Er kann hier nicht
            bearbeitet oder gelöscht werden — verwalte ihn in den Einstellungen.
          </div>
        ) : (
          <>
            <div>
              <label className="label">Notiz</label>
              <textarea
                className="input min-h-[80px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optionale Notiz"
                disabled={!canManage}
              />
              {canManage && (
                <div className="mt-2 flex items-center gap-2">
                  <button className="btn-primary" onClick={saveNotes}>
                    <StickyNote className="w-4 h-4" />
                    Notiz speichern
                  </button>
                  {savedMsg && (
                    <span className="text-xs text-emerald-700">{savedMsg}</span>
                  )}
                </div>
              )}
            </div>

            {canManage && (
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button className="btn-ghost bg-black/[0.03] justify-center" onClick={removeSingleDay}>
                  <Scissors className="w-4 h-4" />
                  Nur diesen Tag entfernen
                </button>
                <button className="btn-danger justify-center" onClick={deleteEntire}>
                  <Trash2 className="w-4 h-4" />
                  Kompletten Zeitraum löschen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
