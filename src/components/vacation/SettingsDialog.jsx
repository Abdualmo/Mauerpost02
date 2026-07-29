import { useEffect, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  FolderOpen,
  Download,
  Upload,
  Unlink,
  HardDrive,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useData } from "../../contexts/DataContext.jsx";
import { usePortable } from "../../contexts/PortableContext.jsx";
import { useConfirm } from "../../contexts/ConfirmContext.jsx";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function DayPicker({ value, onChange }) {
  // value is 'MM-DD' or ''
  const [m, d] = (value || "").split("-").map((x) => x || "");
  return (
    <div className="grid grid-cols-2 gap-1">
      <select
        className="input !py-1.5 !px-2 text-sm"
        value={m || ""}
        onChange={(e) => onChange(`${e.target.value}-${d || "01"}`)}
      >
        <option value="">Monat</option>
        {MONTH_NAMES.map((n, i) => (
          <option key={n} value={String(i + 1).padStart(2, "0")}>
            {n}
          </option>
        ))}
      </select>
      <input
        className="input !py-1.5 !px-2 text-sm"
        type="number"
        min="1"
        max="31"
        placeholder="Tag"
        value={d || ""}
        onChange={(e) => {
          const dd = String(Number(e.target.value) || 1).padStart(2, "0");
          onChange(`${m || "01"}-${dd}`);
        }}
      />
    </div>
  );
}

export default function SettingsDialog({ onClose }) {
  const { company, resetAll } = useAuth();
  const { updateCompany } = useData();
  const portable = usePortable();
  const confirmDialog = useConfirm();
  const [name, setName] = useState(company?.name || "");
  const [defaultVacationDays, setDefaults] = useState(
    company?.defaultVacationDays ?? 30,
  );
  const [rules, setRules] = useState(
    company?.recurringCompanyVacation
      ? [...company.recurringCompanyVacation]
      : [],
  );
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(company?.name || "");
    setDefaults(company?.defaultVacationDays ?? 30);
    setRules(company?.recurringCompanyVacation || []);
  }, [company]);

  function save() {
    setError("");
    if (!name.trim()) return setError("Firmenname darf nicht leer sein.");
    // Validate rules: each must have start and end
    for (const r of rules) {
      if (!r.start || !r.end)
        return setError("Alle Betriebsurlaubs-Regeln benötigen Start und Ende.");
    }
    updateCompany({
      name: name.trim(),
      defaultVacationDays: Number(defaultVacationDays) || 0,
      recurringCompanyVacation: rules,
    });
    setSavedMsg("Gespeichert.");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  function addRule() {
    setRules((r) => [...r, { start: "01-01", end: "01-01", label: "" }]);
  }

  function updateRule(i, patch) {
    setRules((r) => r.map((rr, ii) => (ii === i ? { ...rr, ...patch } : rr)));
  }

  function removeRule(i) {
    setRules((r) => r.filter((_, ii) => ii !== i));
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog-panel p-5 sm:p-6 max-w-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-black/50">
              Einstellungen
            </div>
            <div className="font-semibold text-lg">Firma & Standardwerte</div>
          </div>
          <button className="btn-ghost !p-2" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Firmenname</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Standard-Urlaubsanspruch (Tage)</label>
              <input
                className="input"
                type="number"
                min="0"
                value={defaultVacationDays}
                onChange={(e) => setDefaults(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-medium">
                  Wiederkehrender Betriebsurlaub
                </div>
                <div className="text-xs text-black/50">
                  Wird jedes Jahr automatisch für alle Mitarbeiter übernommen.
                  Zeiträume über den Jahreswechsel werden korrekt dargestellt.
                </div>
              </div>
              <button className="btn-ghost bg-black/[0.03]" onClick={addRule}>
                <Plus className="w-4 h-4" />
                Hinzufügen
              </button>
            </div>

            {rules.length === 0 ? (
              <div className="text-sm text-black/50 bg-gold-softer rounded-xl p-3">
                Noch keine wiederkehrenden Zeiträume.
              </div>
            ) : (
              <ul className="space-y-2">
                {rules.map((r, i) => (
                  <li
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-end bg-white border border-black/5 rounded-xl p-3"
                  >
                    <div>
                      <label className="label">Von</label>
                      <DayPicker
                        value={r.start}
                        onChange={(v) => updateRule(i, { start: v })}
                      />
                    </div>
                    <div>
                      <label className="label">Bis</label>
                      <DayPicker
                        value={r.end}
                        onChange={(v) => updateRule(i, { end: v })}
                      />
                    </div>
                    <div>
                      <label className="label">Bezeichnung</label>
                      <input
                        className="input"
                        value={r.label || ""}
                        onChange={(e) =>
                          updateRule(i, { label: e.target.value })
                        }
                        placeholder="z. B. Betriebsurlaub Weihnachten"
                      />
                    </div>
                    <button
                      className="btn-ghost !p-2 text-black/50 hover:text-red-sick"
                      onClick={() => removeRule(i)}
                      title="Entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-black/5 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-black/60" />
              <div className="font-medium">Datei-Speicher (z. B. USB-Stick)</div>
            </div>
            <div className="text-xs text-black/60 mb-3">
              Verbinde die App mit einer Datei — z. B. auf deinem USB-Stick.
              Jede Änderung wird dann automatisch dort gespeichert und wandert
              mit dem Stick von Rechner zu Rechner. Export/Import funktioniert
              in jedem Browser.
            </div>

            {portable.isPortable ? (
              <div className="rounded-xl bg-gold-softer p-3 flex flex-col gap-2 mb-3">
                <div className="text-sm">
                  <span className="font-medium">Verbunden mit:</span>{" "}
                  <span className="tabular-nums">{portable.handleName}</span>
                </div>
                <div className="text-xs text-black/60">
                  Status:{" "}
                  {portable.status === "saving"
                    ? "Speichert…"
                    : portable.status === "saved"
                      ? "Gespeichert"
                      : portable.status === "error"
                        ? "Fehler"
                        : "Bereit"}
                </div>
                {portable.error && (
                  <div className="text-xs text-red-700">{portable.error}</div>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    className="btn-ghost bg-white !py-1.5"
                    onClick={() => portable.saveNow()}
                  >
                    <Save className="w-4 h-4" /> Jetzt speichern
                  </button>
                  <button
                    className="btn-ghost !py-1.5"
                    onClick={() => portable.detach()}
                  >
                    <Unlink className="w-4 h-4" /> Verbindung trennen
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-gold-softer p-3 mb-3">
                {portable.supportsFS ? (
                  <>
                    <div className="text-sm mb-2">
                      Auto-Speichern in eine Datei (empfohlen, Chrome/Edge):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-primary !py-1.5"
                        onClick={() => portable.openExisting()}
                      >
                        <FolderOpen className="w-4 h-4" /> Vorhandene Datei öffnen
                      </button>
                      <button
                        className="btn-ghost bg-white !py-1.5"
                        onClick={() => portable.createNew()}
                      >
                        <Plus className="w-4 h-4" /> Neue Datei anlegen
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-black/70">
                    Dein Browser unterstützt kein automatisches Datei-Speichern.
                    Nutze stattdessen Export/Import unten — funktioniert überall.
                  </div>
                )}
                {portable.error && (
                  <div className="text-xs text-red-700 mt-2">
                    {portable.error}
                  </div>
                )}
              </div>
            )}

            <div className="text-xs text-black/60 mb-2">
              Immer verfügbar — für Backups oder wenn dein Browser kein
              Auto-Speichern kann:
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-ghost bg-white shadow-soft !py-1.5"
                onClick={() => portable.exportDownload()}
              >
                <Download className="w-4 h-4" /> Exportieren (Download)
              </button>
              <button
                className="btn-ghost bg-white shadow-soft !py-1.5"
                onClick={() => portable.importClassic()}
              >
                <Upload className="w-4 h-4" /> Importieren (Datei wählen)
              </button>
            </div>
          </div>

          <div className="text-xs text-black/60 bg-gold-softer rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex-1">
              Alle Daten werden lokal in diesem Browser gespeichert.
              {portable.isPortable && " Zusätzlich in der verbundenen Datei."}
            </span>
            <button
              type="button"
              className="btn-ghost !py-1.5 text-red-sick hover:bg-red-50 self-start sm:self-center"
              onClick={async () => {
                const ok = await confirmDialog({
                  title: "Alles zurücksetzen?",
                  message:
                    "Wirklich alle Daten (Firma, Mitarbeiter, Urlaube) löschen? Dies kann nicht rückgängig gemacht werden.",
                  confirmLabel: "Zurücksetzen",
                  danger: true,
                });
                if (!ok) return;
                resetAll();
                onClose();
              }}
            >
              Alles zurücksetzen
            </button>
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            {savedMsg && (
              <span className="text-xs text-emerald-700 self-center mr-auto">
                {savedMsg}
              </span>
            )}
            <button className="btn-ghost" onClick={onClose}>
              Schließen
            </button>
            <button className="btn-primary" onClick={save}>
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
