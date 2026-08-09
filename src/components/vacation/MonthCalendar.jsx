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
import {
  entryCoveringDay,
  isHalfDayFor,
  holidayName,
  isWorkdayForEmployee,
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_SONDERURLAUB,
  TYPE_URLAUB,
} from "../../lib/vacation.js";
import { toISO } from "../../lib/date.js";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const colorFor = (type) => {
  if (type === TYPE_URLAUB) return { bg: "#C8A96B", fg: "#000000" };
  if (type === TYPE_BETRIEBSURLAUB) return { bg: "#5E9EA0", fg: "#FFFFFF" };
  if (type === TYPE_KRANKHEIT) return { bg: "#D64545", fg: "#FFFFFF" };
  if (type === TYPE_SONDERURLAUB) return { bg: "#4A90E2", fg: "#FFFFFF" };
  return { bg: "transparent", fg: "#000000" };
};

const HOLIDAY_BG = "#EDE4D3";

export default function MonthCalendar({
  monthDate,
  entries,
  draftStartISO,
  today,
  birthdayISO,
  terminationISO,
  employee,
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
          const rawEntry = entryCoveringDay(entries, iso);
          const isEmployeeWorkday = employee ? isWorkdayForEmployee(iso, employee) : !weekend;
          const entry = rawEntry && isEmployeeWorkday ? rawEntry : null;
          const draft = draftStartISO && iso === draftStartISO;
          const isBirthday = birthdayISO && iso === birthdayISO;
          const holiday = holidayName(iso);
          const halfDay = entry ? isHalfDayFor(entry, iso) : false;
          const afterTermination = terminationISO && iso > terminationISO;
          const c = entry ? colorFor(entry.type) : null;

          const baseClasses = [
            "h-9 sm:h-10 rounded-lg text-sm relative flex items-center justify-center transition-colors overflow-hidden",
            inMonth ? "" : "opacity-30",
          ];
          if (afterTermination) {
            baseClasses.push("cursor-not-allowed");
          } else if (!entry && !weekend && !holiday && inMonth) {
            baseClasses.push("hover:bg-[#F2EBDD] cursor-pointer");
          } else if (entry && inMonth) {
            baseClasses.push("cursor-pointer");
          }
          if (weekend && !entry && !afterTermination) {
            baseClasses.push("bg-black/[0.03] text-black/30");
          }
          if (isToday) {
            baseClasses.push("ring-1 ring-black/60 font-semibold");
          }
          if (draft) {
            baseClasses.push("ring-2 ring-[#C8A96B]");
          }
          if (isBirthday && !entry && !afterTermination) {
            baseClasses.push("!bg-[#F7DDE3] text-black");
          }

          let style;
          if (afterTermination && !entry) {
            // Post-termination: unified dark-neutral hatch, click blocked
            style = {
              backgroundColor: "#33322D",
              color: "#8A857A",
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 4px, rgba(255,255,255,0.05) 4px 8px)",
            };
          } else if (entry) {
            if (halfDay) {
              style = {
                background: `linear-gradient(135deg, ${c.bg} 50%, rgba(255,255,255,0.85) 50%)`,
                color: c.fg,
              };
            } else {
              style = { backgroundColor: c.bg, color: c.fg };
            }
          } else if (holiday && !isBirthday) {
            style = { backgroundColor: HOLIDAY_BG, color: "#4a3d1f" };
          }

          const title = [
            afterTermination ? "Arbeitsverhältnis beendet" : undefined,
            entry?.notes,
            entry?.reason ? `Grund: ${entry.reason}` : undefined,
            holiday || undefined,
            isBirthday ? "Geburtstag" : undefined,
            halfDay ? "Halbtag" : undefined,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <button
              key={iso}
              disabled={!inMonth || afterTermination}
              onClick={() => onDayClick && onDayClick(iso, entry)}
              className={baseClasses.join(" ")}
              style={style}
              title={title || undefined}
            >
              {day.getDate()}
              {isBirthday && !afterTermination && (
                <span
                  className="absolute top-0.5 right-0.5 text-[10px] leading-none"
                  aria-hidden
                >
                  🎂
                </span>
              )}
              {halfDay && (
                <span
                  className="absolute bottom-0.5 right-1 text-[10px] leading-none font-semibold"
                  aria-hidden
                >
                  ½
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
