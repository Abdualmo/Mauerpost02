import { useState } from "react";
import { CalendarDays, Settings2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import SettingsDialog from "./SettingsDialog.jsx";

export default function AppHeader() {
  const { company } = useAuth();
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
            Deine Daten bleiben in diesem Browser gespeichert
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="btn-ghost"
          title="Einstellungen"
        >
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Einstellungen</span>
        </button>
      </div>
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </header>
  );
}
