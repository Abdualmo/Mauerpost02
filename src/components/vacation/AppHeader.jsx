import { useState } from "react";
import { CalendarDays, HardDrive, Settings } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { usePortable } from "../../contexts/PortableContext.jsx";
import SettingsPanel from "./SettingsPanel.jsx";

export default function AppHeader() {
  const { company } = useAuth();
  const portable = usePortable();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="bg-white/70 backdrop-blur border-b border-black/5 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full bg-black flex items-center justify-center shrink-0"
          aria-hidden
        >
          <CalendarDays className="w-5 h-5 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">
            {company?.name || "VacationPlanner Gold"}
          </div>
          <div className="text-xs text-black/50 truncate">
            {portable.isPortable
              ? `Datei-Sync: ${portable.handleName}`
              : "Daten bleiben in diesem Browser"}
          </div>
        </div>
        {portable.isPortable && (
          <span
            className={`hidden sm:inline-flex items-center gap-1 text-xs rounded-full px-2 py-1 ${
              portable.status === "error"
                ? "bg-red-50 text-red-700"
                : "bg-gold-past text-black/70"
            }`}
            title={portable.error || portable.handleName}
          >
            <HardDrive className="w-3.5 h-3.5" />
            {portable.status === "saving"
              ? "Speichert…"
              : portable.status === "error"
                ? "Fehler"
                : "Gespeichert"}
          </span>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          className="btn-ghost"
          title="Einstellungen"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Einstellungen</span>
        </button>
      </div>
      {settingsOpen && (
        <SettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </header>
  );
}
