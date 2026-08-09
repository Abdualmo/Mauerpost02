// Kennzahlen-Karten der Mitarbeiterakte.
// Design:
//   - Label oben (klein, uppercase, umbruchsicher)
//   - Grosser Wert vertikal zentriert, mit optionaler Einheit "Tage"
//   - Optionaler Hinweis am Unterrand
//   - Alle Karten teilen dieselbe Mindesthöhe, damit das Raster ruhig wirkt
//   - Auf schmalen Screens wird die Schrift automatisch verkleinert
//     und lange Labels dürfen umbrechen — nichts läuft aus der Box.

function Card({ label, value, unit, hint, danger, accentColor }) {
  const compound = typeof value === "string" && /[\/·]/.test(value);
  return (
    <div className="card p-4 sm:p-5 flex flex-col min-h-[124px] sm:min-h-[132px]">
      <div className="flex items-start gap-1.5 min-h-[2.2em]">
        {accentColor && (
          <span
            className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden
          />
        )}
        <div
          className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.06em] text-black/60 leading-snug break-words hyphens-auto"
          lang="de"
        >
          {label}
        </div>
      </div>

      <div className="flex-1 flex items-baseline justify-start pt-1 min-w-0">
        <div
          className={`font-semibold tabular-nums leading-none ${
            danger ? "text-red-sick" : "text-black"
          } ${compound ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}
        >
          {value}
        </div>
        {unit && (
          <span className="ml-1.5 text-sm sm:text-base text-black/50 font-normal">
            {unit}
          </span>
        )}
      </div>

      {hint && (
        <div className="text-[10px] sm:text-[11px] text-black/50 leading-snug mt-2 break-words hyphens-auto">
          {hint}
        </div>
      )}
    </div>
  );
}

export default function SummaryCards({ stats, year }) {
  const carryoverValue =
    stats.carryoverAvailable > 0
      ? `${stats.carryoverRemaining} / ${stats.carryoverAvailable}`
      : String(stats.carryoverTotal || 0);
  const carryoverHint = stats.carryoverTotal
    ? stats.carryoverAvailable === 0
      ? "nach 31.03. verfallen"
      : `nutzbar bis 31.03.${year}`
    : "kein Übertrag";
  const genommenHint = stats.usedTotal !== stats.usedAgainstAnnual
    ? `gesamt ${stats.usedTotal} · Q1 zuerst vom Übertrag`
    : undefined;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <Card
        label="Jahresanspruch"
        value={stats.annual}
        unit="Tage"
        hint={stats.prorated ? `anteilig · voll ${stats.annualFull}` : undefined}
      />
      <Card
        label="Genommen"
        value={stats.usedAgainstAnnual}
        unit="Tage"
        hint={genommenHint}
      />
      <Card
        label="Verbleibend"
        value={stats.remaining}
        unit="Tage"
        danger={stats.negative}
        hint={stats.negative ? "negative Bilanz" : undefined}
      />
      <Card
        label="Vorjahresübertrag"
        value={carryoverValue}
        unit={carryoverValue.includes("/") ? undefined : "Tage"}
        hint={carryoverHint}
      />
      <Card
        label="Sonderurlaub"
        value={stats.sonderurlaubTotal || 0}
        unit="Tage"
        hint="separat, nicht vom Anspruch"
        accentColor="#4A90E2"
      />
      <Card
        label="Krankheit"
        value={stats.sickTotal}
        unit="Tage"
        hint={`Krankheitstage ${year}`}
        accentColor="#D64545"
      />
    </div>
  );
}
