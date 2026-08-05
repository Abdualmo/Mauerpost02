import { useEffect, useMemo, useState } from "react";
import {
  X,
  Building2,
  Palmtree,
  HardDrive,
  Save,
  Unlink,
  FolderOpen,
  Plus,
  Download,
  Upload,
  Trash2,
  Check,
  AlertOctagon,
  FileWarning,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useData } from "../../contexts/DataContext.jsx";
import { usePortable } from "../../contexts/PortableContext.jsx";
import { useConfirm } from "../../contexts/ConfirmContext.jsx";

const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/* ─── Layout building blocks ────────────────────────────────────────── */

function SectionHeader({ icon: Icon, label, description }) {
  return (
    <div className="mt-8 first:mt-0 mb-2 px-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-black/45" />}
        <div className="text-[11px] uppercase tracking-[0.14em] text-black/50 font-semibold">
          {label}
        </div>
      </div>
      {description && (
        <div className="text-xs text-black/50 mt-1 pl-6">{description}</div>
      )}
    </div>
  );
}

function SectionCard({ children }) {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-black/[0.04] divide-y divide-black/[0.06]">
      {children}
    </div>
  );
}

function Row({ icon: Icon, title, description, control, danger }) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      {Icon && (
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            danger
              ? "bg-red-50 text-red-sick"
              : "bg-gold-softer text-gold-dark"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${danger ? "text-red-sick" : ""}`}>{title}</div>
        {description && (
          <div className="text-xs text-black/55 mt-0.5">{description}</div>
        )}
        {control && <div className="mt-3">{control}</div>}
      </div>
    </div>
  );
}

function SavedChip({ show }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] text-emerald-700 transition-opacity ${
        show ? "opacity-100" : "opacity-0"
      }`}
      aria-live="polite"
    >
      <Check className="w-3 h-3" />
      Gespeichert
    </span>
  );
}

function MonthDayPicker({ value, onChange, disabled }) {
  const [m, d] = (value || "01-01").split("-");
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <select
        className="input !py-1.5 !px-2 text-sm"
        value={m}
        onChange={(e) => onChange(`${e.target.value}-${d}`)}
        disabled={disabled}
        aria-label="Monat"
      >
        {MONTH_NAMES.map((n, i) => (
          <option key={n} value={String(i + 1).padStart(2, "0")}>
            {n}
          </option>
        ))}
      </select>
      <input
        className="input !py-1.5 !px-2 text-sm w-16 text-center"
        type="number"
        min="1"
        max="31"
        value={Number(d)}
        onChange={(e) => {
          const dd = String(
            Math.max(1, Math.min(31, Number(e.target.value) || 1)),
          ).padStart(2, "0");
          onChange(`${m}-${dd}`);
        }}
        disabled={disabled}
        aria-label="Tag"
      />
    </div>
  );
}

/* ─── The panel ────────────────────────────────────────────────────── */

export default function SettingsPanel({ onClose }) {
  const { company, resetAll } = useAuth();
  const { updateCompany } = useData();
  const portable = usePortable();
  const confirm = useConfirm();

  // Local mirrored state so text inputs stay smooth; commit to the store on blur.
  const [companyName, setCompanyName] = useState(company?.name || "");
  const [defaults, setDefaults] = useState(company?.defaultVacationDays ?? 30);
  const [savedKey, setSavedKey] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setCompanyName(company?.name || "");
    setDefaults(company?.defaultVacationDays ?? 30);
  }, [company]);

  const rules = useMemo(
    () => company?.recurringCompanyVacation || [],
    [company],
  );

  function flash(key) {
    setSavedKey(key);
    setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1400);
  }

  function commitName() {
    const trimmed = companyName.trim();
    if (!trimmed) {
      setError("Firmenname darf nicht leer sein.");
      setCompanyName(company?.name || "");
      return;
    }
    setError("");
    if (trimmed === company?.name) return;
    updateCompany({ name: trimmed });
    flash("name");
  }

  function commitDefaults() {
    const n = Math.max(0, Math.round(Number(defaults) || 0));
    setDefaults(n);
    if (n === company?.defaultVacationDays) return;
    updateCompany({ defaultVacationDays: n });
    flash("defaults");
  }

  function updateRules(next) {
    updateCompany({ recurringCompanyVacation: next });
    flash("rules");
  }

  function addRule() {
    updateRules([
      ...rules,
      { start: "01-01", end: "01-01", label: "" },
    ]);
  }

  function editRule(i, patch) {
    updateRules(rules.map((r, ii) => (ii === i ? { ...r, ...patch } : r)));
  }

  async function removeRule(i) {
    const r = rules[i];
    const ok = await confirm({
      title: "Regel entfernen?",
      message: `Wiederkehrender Betriebsurlaub „${r.label || "ohne Bezeichnung"}" wird dauerhaft aus allen Jahren entfernt.`,
      confirmLabel: "Entfernen",
      danger: true,
    });
    if (!ok) return;
    updateRules(rules.filter((_, ii) => ii !== i));
  }

  async function doResetAll() {
    const ok = await confirm({
      title: "Alle Daten löschen?",
      message:
        "Firma, Mitarbeiter, Urlaube, Archiv und alle Einstellungen werden unwiderruflich gelöscht.",
      confirmLabel: "Alles löschen",
      danger: true,
    });
    if (!ok) return;
    resetAll();
    onClose();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog-panel p-0 max-w-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white rounded-t-2xl px-5 sm:px-6 py-4 border-b border-black/[0.06] flex items-center gap-3">
          <div className="flex-1">
            <div className="text-[11px] uppercase tracking-[0.14em] text-black/50 font-semibold">
              Einstellungen
            </div>
            <div className="font-semibold text-lg leading-tight">
              {company?.name || "Firma"}
            </div>
          </div>
          <button
            className="btn-ghost !p-2"
            onClick={onClose}
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 pb-6 pt-1">
          {/* ─── Firma ───────────────────────────────────────── */}
          <SectionHeader icon={Building2} label="Firma" />
          <SectionCard>
            <Row
              icon={Building2}
              title="Firmenname"
              description="Wird oben im Header und in Sicherungen verwendet."
              control={
                <div className="flex items-center gap-3">
                  <input
                    className="input flex-1"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    placeholder="Firmenname"
                  />
                  <SavedChip show={savedKey === "name"} />
                </div>
              }
            />
            <Row
              icon={Palmtree}
              title="Standard-Urlaubsanspruch"
              description="Vorschlag beim Anlegen neuer Mitarbeiter (Tage pro Jahr)."
              control={
                <div className="flex items-center gap-3">
                  <input
                    className="input w-28"
                    type="number"
                    min="0"
                    value={defaults}
                    onChange={(e) => setDefaults(e.target.value)}
                    onBlur={commitDefaults}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                  />
                  <span className="text-sm text-black/50">Tage</span>
                  <SavedChip show={savedKey === "defaults"} />
                </div>
              }
            />
          </SectionCard>

          {error && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* ─── Betriebsurlaub ──────────────────────────────── */}
          <SectionHeader
            icon={Palmtree}
            label="Wiederkehrender Betriebsurlaub"
            description="Zeiträume, die jedes Jahr automatisch für alle Mitarbeiter gelten. Jahreswechsel-Zeiträume werden korrekt aufgeteilt."
          />
          <SectionCard>
            {rules.length === 0 ? (
              <div className="px-4 py-6 text-sm text-black/50 text-center">
                Noch keine Zeiträume angelegt.
              </div>
            ) : (
              rules.map((r, i) => (
                <div key={i} className="px-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr_auto] gap-3 items-end">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-black/45 mb-1">
                        Von
                      </div>
                      <MonthDayPicker
                        value={r.start}
                        onChange={(v) => editRule(i, { start: v })}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-black/45 mb-1">
                        Bis
                      </div>
                      <MonthDayPicker
                        value={r.end}
                        onChange={(v) => editRule(i, { end: v })}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-black/45 mb-1">
                        Bezeichnung
                      </div>
                      <input
                        className="input !py-1.5 text-sm"
                        placeholder="z. B. Werksferien Weihnachten"
                        value={r.label || ""}
                        onChange={(e) =>
                          editRule(i, { label: e.target.value })
                        }
                      />
                    </div>
                    <button
                      className="btn-ghost !p-2 self-center text-black/45 hover:text-red-sick"
                      onClick={() => removeRule(i)}
                      title="Regel entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="px-4 py-3 flex items-center justify-between gap-2">
              <SavedChip show={savedKey === "rules"} />
              <button className="btn-ghost bg-white shadow-soft !py-1.5" onClick={addRule}>
                <Plus className="w-4 h-4" />
                Zeitraum hinzufügen
              </button>
            </div>
          </SectionCard>

          {/* ─── Daten & Speicher ────────────────────────────── */}
          <SectionHeader
            icon={HardDrive}
            label="Daten & Speicher"
            description="Wo werden deine Daten gespeichert und wie kannst du sie sichern?"
          />
          <SectionCard>
            <Row
              icon={HardDrive}
              title={portable.isPortable ? "Mit Datei verbunden" : "Nur in diesem Browser"}
              description={
                portable.isPortable
                  ? `Änderungen werden automatisch in „${portable.handleName}" gespeichert.`
                  : "Daten liegen ausschließlich im lokalen Browser-Speicher."
              }
              control={
                portable.isPortable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="btn-primary !py-1.5"
                      onClick={() => portable.saveNow()}
                    >
                      <Save className="w-4 h-4" />
                      Jetzt speichern
                    </button>
                    <button
                      className="btn-ghost bg-white shadow-soft !py-1.5"
                      onClick={() => portable.detach()}
                    >
                      <Unlink className="w-4 h-4" />
                      Verbindung trennen
                    </button>
                    <span className="text-[11px] text-black/50 tabular-nums">
                      {portable.status === "saving"
                        ? "speichert…"
                        : portable.status === "error"
                          ? "Fehler"
                          : "gespeichert"}
                    </span>
                  </div>
                ) : portable.supportsFS ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-primary !py-1.5"
                      onClick={() => portable.openExisting()}
                    >
                      <FolderOpen className="w-4 h-4" />
                      Vorhandene Datei öffnen
                    </button>
                    <button
                      className="btn-ghost bg-white shadow-soft !py-1.5"
                      onClick={() => portable.createNew()}
                    >
                      <Plus className="w-4 h-4" />
                      Neue Datei anlegen
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-black/60">
                    Dein Browser unterstützt kein direktes Datei-Speichern —
                    nutze Export und Import unten.
                  </div>
                )
              }
            />
            {portable.error && (
              <div className="px-4 pb-3 -mt-2 text-xs text-red-700">
                {portable.error}
              </div>
            )}
            <Row
              icon={Download}
              title="Sicherung als Datei speichern"
              description="Lädt eine JSON-Datei mit allen Daten deiner Firma herunter."
              control={
                <button
                  className="btn-ghost bg-white shadow-soft !py-1.5"
                  onClick={() => portable.exportDownload()}
                >
                  <Download className="w-4 h-4" />
                  Sicherung herunterladen
                </button>
              }
            />
            <Row
              icon={Upload}
              title="Sicherung wiederherstellen"
              description="Ersetzt die aktuellen Daten durch den Inhalt einer JSON-Datei."
              control={
                <button
                  className="btn-ghost bg-white shadow-soft !py-1.5"
                  onClick={() => portable.importClassic()}
                >
                  <Upload className="w-4 h-4" />
                  Datei auswählen
                </button>
              }
            />
          </SectionCard>

          {/* ─── Gefahrenzone ────────────────────────────────── */}
          <SectionHeader icon={AlertOctagon} label="Gefahrenzone" />
          <SectionCard>
            <Row
              icon={FileWarning}
              title="Alle Daten löschen"
              description="Setzt die App komplett zurück — Firma, Mitarbeiter, Urlaube, Archiv und Einstellungen. Kann nicht rückgängig gemacht werden."
              danger
              control={
                <button className="btn-danger !py-1.5" onClick={doResetAll}>
                  <Trash2 className="w-4 h-4" />
                  Alles löschen
                </button>
              }
            />
          </SectionCard>

          <div className="mt-6 text-center text-[11px] text-black/40">
            Änderungen werden automatisch gespeichert.
          </div>
        </div>
      </div>
    </div>
  );
}
