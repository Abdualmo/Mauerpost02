import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { entryCoveringDay, TYPE_BETRIEBSURLAUB, TYPE_KRANKHEIT, TYPE_URLAUB } from "../../lib/vacation.js";
import { toISO } from "../../lib/date.js";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const colorFor = (type) => {
  if (type === TYPE_URLAUB) return { bg: "#C8A96B", fg: "#000000" };
  if (type === TYPE_BETRIEBSURLAUB) return { bg: "#5E9EA0", fg: "#FFFFFF" };
  if (type === TYPE_KRANKHEIT) return { bg: "#D64545", fg: "#FFFFFF" };
  return { bg: "transparent", fg: "#000000" };
};

export default function MonthCalendar({
  monthDate,
  entries,
  draftStartISO,
  today,
  birthdayISO,
  onDayClick,
}) {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const gridStart = startOfWeek(first, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(last, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">
          {format(monthDate, "LLLL yyyy", { locale: de })}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[11px] text-black/50 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toISO(day);
          const inMonth = isSameMonth(day, monthDate);
          const weekend = isWeekend(day);
          const isToday = today && isSameDay(day, parseISO(today));
          const entry = entryCoveringDay(entries, iso);
          const draft = draftStartISO && iso === draftStartISO;
          const isBirthday = birthdayISO && iso === birthdayISO;
          const c = entry ? colorFor(entry.type) : null;

          const baseClasses = [
            "h-9 sm:h-10 rounded-lg text-sm relative flex items-center justify-center transition-colors",
            inMonth ? "" : "opacity-30",
          ];
          if (!entry && !weekend && inMonth) {
            baseClasses.push("hover:bg-[#F2EBDD] cursor-pointer");
          } else if (entry && inMonth) {
            baseClasses.push("cursor-pointer");
          }
          if (weekend && !entry) {
            baseClasses.push("bg-black/[0.03] text-black/30");
          }
          if (isToday) {
            baseClasses.push("ring-1 ring-black/60 font-semibold");
          }
          if (draft) {
            baseClasses.push("ring-2 ring-[#C8A96B]");
          }
          if (isBirthday && !entry) {
            // Soft pink background when the birthday day is otherwise free
            baseClasses.push("!bg-[#F7DDE3] text-black");
          }

          const style = entry
            ? { backgroundColor: c.bg, color: c.fg }
            : undefined;

          const title = [
            entry?.notes || (entry ? undefined : undefined),
            isBirthday ? "Geburtstag" : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <button
              key={iso}
              disabled={!inMonth}
              onClick={() => onDayClick && onDayClick(iso, entry)}
              className={baseClasses.join(" ")}
              style={style}
              title={title || undefined}
            >
              {day.getDate()}
              {isBirthday && (
                <span
                  className="absolute top-0.5 right-0.5 text-[10px] leading-none"
                  aria-hidden
                  title="Geburtstag"
                >
                  🎂
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
