import { CalendarCheck, Clock3, Palmtree, CalendarClock } from "lucide-react";

function Card({ icon: Icon, label, value, hint, tint = "#F7F3ED" }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: tint }}
        >
          <Icon className="w-5 h-5" style={{ color: "#A68445" }} />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-black/50">
            {label}
          </div>
          <div className="text-2xl font-semibold tabular-nums leading-tight">
            {value}
          </div>
          {hint && (
            <div className="text-xs text-black/50 mt-0.5">{hint}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SummaryCards({ stats, year }) {
  const carryoverHint = stats.carryoverTotal
    ? stats.carryoverAvailable === 0
      ? "nach 31.03. verfallen"
      : `nutzbar bis 31.03.${year}`
    : "kein Übertrag";
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card
        icon={CalendarCheck}
        label="Jahresanspruch"
        value={stats.annual}
      />
      <Card
        icon={Clock3}
        label="Genommen"
        value={stats.usedAgainstAnnual}
        hint={`gesamt ${stats.usedTotal} · Q1 vor Übertrag zuerst`}
      />
      <Card
        icon={Palmtree}
        label="Verbleibend"
        value={stats.remaining}
      />
      <Card
        icon={CalendarClock}
        label="Vorjahr"
        value={
          stats.carryoverAvailable > 0
            ? `${stats.carryoverRemaining} / ${stats.carryoverAvailable}`
            : stats.carryoverTotal || 0
        }
        hint={carryoverHint}
      />
    </div>
  );
}
