interface MiniCalendarProps {
  displayMonth: Date;
  availableDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toReadableDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

export function MiniCalendar({
  displayMonth,
  availableDates,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth
}: MiniCalendarProps) {
  const year = displayMonth.getFullYear();
  const month = displayMonth.getMonth();

  const firstDay = new Date(year, month, 1);
  // Monday = 0, Sunday = 6
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build grid: pad start with previous month days
  const cells: { date: Date; inMonth: boolean }[] = [];

  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({
      date: new Date(year, month, -i),
      inMonth: false
    });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: new Date(year, month, d),
      inMonth: true
    });
  }

  // Pad end to fill last row
  while (cells.length % 7 !== 0) {
    const nextDate = cells.length - startDow - daysInMonth + 1;
    cells.push({
      date: new Date(year, month + 1, nextDate),
      inMonth: false
    });
  }

  const monthLabel = displayMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  return (
    <div className="select-none" role="group" aria-label={monthLabel}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="week-nav-btn"
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="text-xs font-medium text-content">{monthLabel}</span>
        <button
          type="button"
          onClick={onNextMonth}
          className="week-nav-btn"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            className="flex h-9 items-center justify-center text-xs font-medium uppercase tracking-wider text-content-muted"
          >
            {d.charAt(0)}
          </div>
        ))}

        {cells.map(({ date, inMonth }, i) => {
          const dateStr = toDateStr(date);
          const isSelected = selectedDate === dateStr;
          const hasSlots = availableDates.has(dateStr);

          if (!inMonth) {
            return (
              <div key={i} className="mini-cal-outside">
                {date.getDate()}
              </div>
            );
          }

          if (isSelected) {
            return (
              <div key={i} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelectDate(dateStr)}
                  className="mini-cal-selected"
                  aria-label={`${toReadableDate(date)}, selected`}
                >
                  {date.getDate()}
                </button>
                {hasSlots && <div className="mini-cal-dot !bg-content-inverse" />}
              </div>
            );
          }

          if (hasSlots) {
            return (
              <div key={i} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelectDate(dateStr)}
                  className="mini-cal-available"
                  aria-label={`${toReadableDate(date)}, has available slots`}
                >
                  {date.getDate()}
                </button>
                <div className="mini-cal-dot" />
              </div>
            );
          }

          return (
            <div key={i} className="mini-cal-unavailable">
              {date.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
