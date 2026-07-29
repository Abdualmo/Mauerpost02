import { Trash2 } from "lucide-react";
import {
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_URLAUB,
  countWorkdaysInYear,
} from "../../lib/vacation.js";
import { fmtDate } from "../../lib/date.js";

const meta = {
  [TYPE_URLAUB]: { color: "#C8A96B", label: "Urlaub" },
  [TYPE_BETRIEBSURLAUB]: { color: "#5E9EA0", label: "Betriebsurlaub" },
  [TYPE_KRANKHEIT]: { color: "#D64545", label: "Krankheit" },
};

export default function EntryList({ entries, year, canManage, onDelete }) {
  if (entries.length === 0) {
    return (
      <div className="card p-6 text-sm text-black/50 text-center">
        Keine Einträge in {year}.
      </div>
    );
  }
  const sorted = [...entries].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  );
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-black/5">
        {sorted.map((e) => {
          const m = meta[e.type] || { color: "#999", label: e.type };
          const days = countWorkdaysInYear(e.startDate, e.endDate, year);
          const isRecurring = Boolean(e.recurring);
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gold-softest"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: m.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-black/60">
                    {" "}
                    · {fmtDate(e.startDate)} – {fmtDate(e.endDate)}
                  </span>
                </div>
                <div className="text-xs text-black/50 truncate">
                  {days} Arbeitstag{days === 1 ? "" : "e"}
                  {e.notes ? ` · ${e.notes}` : ""}
                  {isRecurring ? " · wiederkehrend" : ""}
                </div>
              </div>
              {canManage && !isRecurring && (
                <button
                  className="btn-ghost !p-2 text-black/50 hover:text-red-sick"
                  title="Eintrag löschen"
                  onClick={() => onDelete && onDelete(e)}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
