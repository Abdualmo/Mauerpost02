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
  TYPE_BETRIEBSURLAUB,
  TYPE_KRANKHEIT,
  TYPE_URLAUB,
} from "../../lib/vacation.js";
import { toISO } from "../../lib/date.js";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const colorFor = (type) => {
  if (type === TYPE_URLAUB) return { bg: "#C8A96B", fg: "#000000" };
  if (type === TYPE_BETRIEBSURLAUB) return { bg: "#5E9EA0", fg: "#FFFFFF" };
  if (type === TYPE_KRANKHEIT) return { bg: "#D64545", fg: "#FFFFFF" };
  return { bg: "transparent", fg: "#000000" };
};

const HOLIDAY_BG = "#EDE4D3";

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
          const holiday = holidayName(iso);
          const halfDay = entry ? isHalfDayFor(entry, iso) : false;
          const c = entry ? colorFor(entry.type) : null;

          const baseClasses = [
            "h-9 sm:h-10 rounded-lg text-sm relative flex items-center justify-center transition-colors overflow-hidden",
            inMonth ? "" : "opacity-30",
          ];
          if (!entry && !weekend && !holiday && inMonth) {
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
            baseClasses.push("!bg-[#F7DDE3] text-black");
          }

          let style;
          if (entry) {
            if (halfDay) {
              // Diagonal split: half vacation color, half transparent white so
              // the underlying free-day surface shows through.
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
            entry?.notes,
            holiday || undefined,
            isBirthday ? "Geburtstag" : undefined,
            halfDay ? "Halbtag" : undefined,
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
              {holiday && !entry && (
                <span
                  className="absolute bottom-0.5 left-1 text-[9px] leading-none text-black/50 truncate"
                  style={{ maxWidth: "80%" }}
                >
                  ·
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
