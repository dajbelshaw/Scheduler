import { Fragment, useState } from "react";

export interface Slot {
  start: Date;
  end: Date;
}

export interface WeekDayData {
  date: Date;
  dateStr: string;
  slots: Slot[];
}

interface WeekViewProps {
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  weekDays: WeekDayData[];
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
  startHour: number;
  endHour: number;
  durationMinutes: number;
  bufferMinutes: number;
}

function formatWeekRange(start: Date, days: WeekDayData[]): string {
  if (days.length === 0) return "";
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (first.getFullYear() !== last.getFullYear()) {
    return `${first.toLocaleDateString(undefined, { ...opts, year: "numeric" })} – ${last.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
  }
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString(undefined, { month: "short" })} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
  }
  return `${first.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, opts)}, ${first.getFullYear()}`;
}

function padTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function WeekView({
  weekStart: _weekStart,
  onPrevWeek,
  onNextWeek,
  canGoPrev,
  canGoNext,
  weekDays,
  selectedSlot,
  onSelectSlot,
  startHour,
  endHour,
  durationMinutes,
  bufferMinutes
}: WeekViewProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const numCols = weekDays.length;
  const slotInterval = durationMinutes + bufferMinutes;

  // Build time rows
  const timeRows: { hour: number; minute: number; label: string }[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m + durationMinutes <= 60 && h * 60 + m + durationMinutes <= endHour * 60; m += slotInterval) {
      timeRows.push({ hour: h, minute: m, label: padTime(h, m) });
    }
  }

  // Build a set of slot keys for quick lookup: "dateStr|HH:MM"
  const slotMap = new Map<string, Slot>();
  for (const day of weekDays) {
    for (const slot of day.slots) {
      const key = `${day.dateStr}|${padTime(slot.start.getHours(), slot.start.getMinutes())}`;
      slotMap.set(key, slot);
    }
  }

  const isSelected = (slot: Slot) =>
    !!selectedSlot &&
    selectedSlot.start.getTime() === slot.start.getTime() &&
    selectedSlot.end.getTime() === slot.end.getTime();

  // Mobile: single-day view state
  const [mobileDayIndex, setMobileDayIndex] = useState(0);
  const mobileDay = weekDays[mobileDayIndex] ?? weekDays[0];

  const canMobilePrev = mobileDayIndex > 0 || canGoPrev;
  const canMobileNext = mobileDayIndex < weekDays.length - 1 || canGoNext;

  const handleMobilePrev = () => {
    if (mobileDayIndex > 0) {
      setMobileDayIndex(mobileDayIndex - 1);
    } else if (canGoPrev) {
      onPrevWeek();
      setMobileDayIndex(weekDays.length - 1);
    }
  };

  const handleMobileNext = () => {
    if (mobileDayIndex < weekDays.length - 1) {
      setMobileDayIndex(mobileDayIndex + 1);
    } else if (canGoNext) {
      onNextWeek();
      setMobileDayIndex(0);
    }
  };

  const formatMobileDate = (d: Date) =>
    d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric"
    });

  return (
    <div>
      {/* ===== MOBILE: Single-day view (< md) ===== */}
      <div className="md:hidden">
        {/* Mobile day navigation */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleMobilePrev}
            disabled={!canMobilePrev}
            className="week-nav-btn disabled:opacity-30"
            aria-label="Previous day"
          >
            ‹
          </button>
          <div className="text-center">
            <span className="text-sm font-medium text-content">
              {mobileDay ? formatMobileDate(mobileDay.date) : ""}
            </span>
            <div className="text-xs text-content-subtle">{timezone}</div>
          </div>
          <button
            type="button"
            onClick={handleMobileNext}
            disabled={!canMobileNext}
            className="week-nav-btn disabled:opacity-30"
            aria-label="Next day"
          >
            ›
          </button>
        </div>

        {/* Mobile day tabs — scroll horizontally through current week */}
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Days of the week">
          {weekDays.map((day, i) => {
            const dow = day.date.toLocaleDateString(undefined, { weekday: "short" });
            const isActive = i === mobileDayIndex;
            return (
              <button
                key={day.dateStr}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setMobileDayIndex(i)}
                className={`flex shrink-0 flex-col items-center rounded-input px-3 py-2 min-h-touch text-xs transition-colors ${
                  isActive
                    ? "bg-accent text-content-inverse"
                    : day.slots.length > 0
                      ? "text-accent-text hover:bg-surface-overlay"
                      : "text-content-subtle"
                }`}
              >
                <span className="font-medium">{dow}</span>
                <span className={isActive ? "font-semibold" : ""}>{day.date.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile slot list */}
        {mobileDay && mobileDay.slots.length > 0 ? (
          <div className="grid grid-cols-2 gap-2" role="tabpanel">
            {mobileDay.slots.map((slot) => {
              const sel = isSelected(slot);
              const timeLabel = padTime(slot.start.getHours(), slot.start.getMinutes());
              return (
                <button
                  key={slot.start.toISOString()}
                  type="button"
                  onClick={() => onSelectSlot(slot)}
                  className={sel ? "slot-pill-selected" : "slot-pill-default"}
                  aria-label={`${formatMobileDate(mobileDay.date)} at ${timeLabel}, available`}
                  aria-pressed={sel}
                >
                  {timeLabel}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-content-muted">
            No available slots on this day.
          </p>
        )}

        <p className="mt-3 text-xs text-content-subtle">
          Only availability shown — event details remain private.
        </p>
      </div>

      {/* ===== DESKTOP: Week grid view (>= md) ===== */}
      <div className="hidden md:block">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onPrevWeek}
              disabled={!canGoPrev}
              className="week-nav-btn disabled:opacity-30"
              aria-label="Previous week"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNextWeek}
              disabled={!canGoNext}
              className="week-nav-btn disabled:opacity-30"
              aria-label="Next week"
            >
              ›
            </button>
            <span className="ml-2 text-sm font-medium text-content">
              {formatWeekRange(_weekStart, weekDays)}
            </span>
          </div>
          <span className="text-xs text-content-subtle">{timezone}</span>
        </div>

        {/* Grid */}
        <div className="overflow-x-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `60px repeat(${numCols}, minmax(72px, 1fr))`
            }}
          >
            {/* Column headers */}
            <div /> {/* Empty top-left corner */}
            {weekDays.map((day) => {
              const dow = day.date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
              const dayNum = day.date.getDate();
              return (
                <div key={day.dateStr} className="week-header-cell pb-2">
                  <div>{dow}</div>
                  <div className="text-sm font-semibold text-content">{dayNum}</div>
                </div>
              );
            })}

            {/* Time rows */}
            {timeRows.map((row) => (
              <Fragment key={`row-${row.label}`}>
                {/* Time label */}
                <div
                  className="week-time-label flex items-center justify-end"
                >
                  {row.label}
                </div>

                {/* Day cells */}
                {weekDays.map((day) => {
                  const key = `${day.dateStr}|${row.label}`;
                  const slot = slotMap.get(key);

                  if (slot) {
                    const sel = isSelected(slot);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onSelectSlot(slot)}
                        className={sel ? "week-cell-selected" : "week-cell-available"}
                        aria-label={`${day.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at ${row.label}, available`}
                        aria-pressed={sel}
                      >
                        {row.label}
                      </button>
                    );
                  }

                  return (
                    <div key={key} className="week-cell-busy" role="img" aria-label="Busy">
                      <span aria-hidden="true">—</span>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs text-content-subtle">
          Only availability shown — event details remain private.
        </p>
      </div>
    </div>
  );
}
