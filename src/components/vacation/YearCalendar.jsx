import { addMonths } from "date-fns";
import MonthCalendar from "./MonthCalendar.jsx";

export default function YearCalendar({
  year,
  entries,
  draftStartISO,
  today,
  birthdayISO,
  onDayClick,
}) {
  const base = new Date(year, 0, 1);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(base, i));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {months.map((m) => (
        <MonthCalendar
          key={m.getMonth()}
          monthDate={m}
          entries={entries}
          draftStartISO={draftStartISO}
          today={today}
          birthdayISO={birthdayISO}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}
