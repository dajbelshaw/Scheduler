import axios from "axios";
import { FormEvent, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { MiniCalendar } from "../components/MiniCalendar";
import { WeekView } from "../components/WeekView";
import type { Slot, WeekDayData } from "../components/WeekView";

interface PageData {
  slug: string;
  ownerName: string;
  bio?: string;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  dateRangeDays: number;
  minNoticeHours: number;
  includeWeekends: boolean;
  expiresAt: number;
  busySlots: { start: string; end: string }[];
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(d: Date): Date {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = day.getDay();
  const diff = dow === 0 ? -6 : 1 - dow; // Monday = 1
  day.setDate(day.getDate() + diff);
  return day;
}

export function SchedulingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() =>
    getMondayOfWeek(new Date())
  );
  const [miniCalMonth, setMiniCalMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [miniCalOpen, setMiniCalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [, setTick] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);

  // Re-render every 60s so the countdown label stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (page) {
      document.title = `Schedule with ${page.ownerName} - CalAnywhere`;
    } else if (error) {
      document.title = "Link Unavailable - CalAnywhere";
    } else {
      document.title = "Loading... - CalAnywhere";
    }
  }, [page, error]);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;
    setIsLoading(true);
    axios
      .get<PageData>(`/api/pages/${slug}`)
      .then((resp) => {
        if (!isMounted) return;
        setPage(resp.data);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(
          err?.response?.data?.error ??
            "This scheduling link is not available. It may have expired."
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Build all slots for the entire date range
  const allSlots = useMemo<Map<string, Slot[]>>(() => {
    if (!page) return new Map();
    const map = new Map<string, Slot[]>();
    const duration = page.defaultDurationMinutes;
    const buffer = page.bufferMinutes ?? 0;
    const slotInterval = duration + buffer;
    const now = new Date();
    const minNoticeMs = (page.minNoticeHours ?? 8) * 60 * 60 * 1000;
    const earliestStart = new Date(now.getTime() + minNoticeMs);
    const includeWeekends = page.includeWeekends ?? false;
    const maxDate = new Date(
      now.getTime() + (page.dateRangeDays ?? 60) * 24 * 60 * 60 * 1000
    );

    const isBusy = (start: Date, end: Date) =>
      page.busySlots.some((slot) => {
        const s = new Date(slot.start);
        const e = new Date(slot.end);
        return s < end && e > start;
      });

    let dayOffset = 0;
    while (dayOffset < (page.dateRangeDays ?? 60) + 14) {
      const day = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
        0, 0, 0, 0
      );

      if (day > maxDate) break;

      const dayOfWeek = day.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeekend && !includeWeekends) {
        dayOffset++;
        continue;
      }

      const slots: Slot[] = [];
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0);
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 17, 0, 0, 0);

      for (
        let slotStart = dayStart.getTime();
        slotStart + duration * 60000 <= dayEnd.getTime();
        slotStart += slotInterval * 60000
      ) {
        const start = new Date(slotStart);
        const end = new Date(slotStart + duration * 60000);

        if (start < earliestStart) continue;
        if (!isBusy(start, end)) {
          slots.push({ start, end });
        }
      }

      map.set(toDateStr(day), slots);
      dayOffset++;
    }

    return map;
  }, [page]);

  // Dates that have at least one available slot
  const availableDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const [dateStr, slots] of allSlots) {
      if (slots.length > 0) set.add(dateStr);
    }
    return set;
  }, [allSlots]);

  // Current week's days
  const weekDays = useMemo<WeekDayData[]>(() => {
    if (!page) return [];
    const includeWeekends = page.includeWeekends ?? false;
    const numDays = includeWeekends ? 7 : 5;
    const days: WeekDayData[] = [];

    for (let i = 0; i < (includeWeekends ? 7 : 7); i++) {
      const d = new Date(
        currentWeekStart.getFullYear(),
        currentWeekStart.getMonth(),
        currentWeekStart.getDate() + i
      );
      const dow = d.getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (!includeWeekends && isWeekend) continue;

      const dateStr = toDateStr(d);
      days.push({
        date: d,
        dateStr,
        slots: allSlots.get(dateStr) ?? []
      });

      if (days.length >= numDays) break;
    }

    return days;
  }, [page, currentWeekStart, allSlots]);

  // Week navigation
  const thisMonday = getMondayOfWeek(new Date());
  const maxWeekStart = useMemo(() => {
    if (!page) return thisMonday;
    const now = new Date();
    const maxDate = new Date(
      now.getTime() + (page.dateRangeDays ?? 60) * 24 * 60 * 60 * 1000
    );
    return getMondayOfWeek(maxDate);
  }, [page]);

  const canGoPrev = currentWeekStart.getTime() > thisMonday.getTime();
  const canGoNext = currentWeekStart.getTime() < maxWeekStart.getTime();

  const navigateWeek = (direction: -1 | 1) => {
    setCurrentWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction * 7);
      if (direction === -1 && next.getTime() < thisMonday.getTime()) return thisMonday;
      if (direction === 1 && next.getTime() > maxWeekStart.getTime()) return maxWeekStart;
      return next;
    });
  };

  const handleMiniCalSelect = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const monday = getMondayOfWeek(date);
    // Clamp
    if (monday.getTime() < thisMonday.getTime()) {
      setCurrentWeekStart(thisMonday);
    } else if (monday.getTime() > maxWeekStart.getTime()) {
      setCurrentWeekStart(maxWeekStart);
    } else {
      setCurrentWeekStart(monday);
    }
  };

  // Sync mini calendar month when week changes
  useEffect(() => {
    setMiniCalMonth(
      new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1)
    );
  }, [currentWeekStart]);

  const handleSlotSelect = (slot: Slot) => {
    setSelectedSlot(slot);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!page || !slug || !selectedSlot) return;
    setIsSubmitting(true);
    setSuccessMessage(null);
    setVerificationSent(false);
    setError(null);
    try {
      const savedEmail = requesterEmail;
      await axios.post(`/api/pages/${slug}/requests`, {
        requesterName,
        requesterEmail,
        reason,
        notes,
        startIso: selectedSlot.start.toISOString(),
        endIso: selectedSlot.end.toISOString(),
        honeypot: website
      });
      setVerificationSent(true);
      setSuccessMessage(
        `Check your email at ${savedEmail} for a confirmation link. Your request won't be sent to ${page.ownerName} until you confirm.`
      );
      setRequesterName("");
      setRequesterEmail("");
      setReason("");
      setNotes("");
      setSelectedSlot(null);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          "We could not send your request. Please try again later."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeRange = (slot: Slot) => {
    const start = slot.start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    const end = slot.end.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    return `${start} – ${end}`;
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });

  const countdownLabel = (expiresAt: number) => {
    const ms = expiresAt - Date.now();
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const totalHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      return `${days}d ${hours}h`;
    }
    return `${totalHours}h ${minutes}m`;
  };

  // Selected date string for mini calendar highlighting
  const selectedDateStr = selectedSlot ? toDateStr(selectedSlot.start) : null;

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8"
    >
      {/* Loading skeleton */}
      {isLoading && (
        <div role="status" aria-busy="true" aria-label="Loading scheduling page">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <div className="flex-1">
              <div className="skeleton h-8 w-48" />
              <div className="skeleton mt-2 h-4 w-64" />
            </div>
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="grid gap-6 md:grid-cols-[220px,1fr] lg:grid-cols-[220px,1fr,340px]">
            <div className="hidden md:block">
              <div className="card">
                <div className="skeleton mb-3 h-6 w-32" />
                <div className="grid grid-cols-7 gap-1">
                  {[...Array(35)].map((_, i) => (
                    <div key={i} className="skeleton h-9 w-full rounded-full" />
                  ))}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="skeleton mb-3 h-4 w-40" />
              <div className="grid grid-cols-6 gap-2">
                {[...Array(30)].map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded" />
                ))}
              </div>
            </div>
            <div className="card">
              <div className="skeleton mb-3 h-5 w-40" />
              <div className="space-y-3">
                <div className="skeleton h-10 w-full rounded-input" />
                <div className="skeleton h-10 w-full rounded-input" />
                <div className="skeleton h-20 w-full rounded-input" />
                <div className="skeleton h-11 w-full rounded-input" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && !page && (
        <div className="alert-error" role="alert">
          <p className="font-medium">Unable to load scheduling page</p>
          <p className="mt-1 text-error-text/80">{error}</p>
        </div>
      )}

      {/* Main content */}
      {!isLoading && page && (
        <>
          <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-semibold text-content">
                {page.ownerName}
              </h1>
              {page.bio && (
                <p className="mt-1 line-clamp-2 text-sm text-content-muted">
                  {page.bio}
                </p>
              )}
              <p className="mt-1 text-xs text-content-muted">
                Choose an available time below to request an appointment.
              </p>
            </div>
            <div className="shrink-0 text-xs text-content-muted">
              Link expires in{" "}
              <span className="font-medium text-accent-text">
                {countdownLabel(page.expiresAt)}
              </span>
            </div>
          </header>

          <section
            className="grid gap-6 md:grid-cols-[220px,1fr] lg:grid-cols-[220px,1fr,340px]"
            aria-label="Schedule appointment"
          >
            {/* Left: Mini Calendar — collapsible on mobile, always visible on desktop */}
            <div>
              <div className="card">
                <div className="flex items-center justify-between md:hidden">
                  <h2 className="text-xs font-semibold text-content">Jump to date</h2>
                  <button
                    type="button"
                    onClick={() => setMiniCalOpen((v) => !v)}
                    className="text-xs text-accent-text hover:text-accent-hover"
                    aria-expanded={miniCalOpen}
                    aria-controls="mini-cal-panel"
                  >
                    {miniCalOpen ? "Hide" : "Show calendar"}
                  </button>
                </div>
                <div
                  id="mini-cal-panel"
                  className={`${miniCalOpen ? "mt-3" : "hidden"} md:mt-0 md:block`}
                >
                  <h2 className="sr-only">Month calendar</h2>
                  <MiniCalendar
                    displayMonth={miniCalMonth}
                    availableDates={availableDates}
                    selectedDate={selectedDateStr}
                    onSelectDate={handleMiniCalSelect}
                    onPrevMonth={() =>
                      setMiniCalMonth(
                        (prev) =>
                          new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                      )
                    }
                    onNextMonth={() =>
                      setMiniCalMonth(
                        (prev) =>
                          new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                        )
                    }
                  />
                </div>
              </div>
            </div>

            {/* Center: Week View */}
            <div className="card" role="region" aria-label="Available time slots">
              <h2 className="sr-only">Weekly time slots</h2>
              <WeekView
                weekStart={currentWeekStart}
                onPrevWeek={() => navigateWeek(-1)}
                onNextWeek={() => navigateWeek(1)}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                weekDays={weekDays}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSlotSelect}
                startHour={9}
                endHour={17}
                durationMinutes={page.defaultDurationMinutes}
                bufferMinutes={page.bufferMinutes}
              />
            </div>

            {/* Right: Request form */}
            <div className="card md:col-span-2 lg:col-span-1">
              <h2 className="mb-3 text-sm font-semibold text-content">
                Request an appointment
              </h2>

              {selectedSlot ? (
                <div className="alert-info mb-3" role="status" aria-live="polite">
                  Selected:{" "}
                  <span className="font-medium text-accent-text">
                    {formatDate(selectedSlot.start)} ·{" "}
                    {formatTimeRange(selectedSlot)}
                  </span>
                </div>
              ) : (
                <p className="mb-3 text-xs text-content-muted">
                  Choose an available time slot to continue.
                </p>
              )}

              {successMessage && (
                <div
                  className={`${verificationSent ? "alert-info" : "alert-success"} mb-3`}
                  role="status"
                  aria-live="polite"
                >
                  {successMessage}
                </div>
              )}

              {error && (
                <div
                  id="request-form-error"
                  className="alert-error mb-3"
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                {/* Honeypot field — hidden from humans, visible to bots */}
                <div className="honeypot-field" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <p className="text-xs text-content-subtle">
                  Fields marked with <span className="text-error">*</span> are
                  required.
                </p>

                <div>
                  <label
                    htmlFor="requester-name"
                    className="label required-indicator text-xs"
                  >
                    Your name
                  </label>
                  <input
                    id="requester-name"
                    type="text"
                    minLength={2}
                    maxLength={100}
                    required
                    autoComplete="name"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="input-dark mt-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="requester-email"
                    className="label required-indicator text-xs"
                  >
                    Your email
                  </label>
                  <input
                    id="requester-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={requesterEmail}
                    onChange={(e) => setRequesterEmail(e.target.value)}
                    className="input-dark mt-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reason"
                    className="label required-indicator text-xs"
                  >
                    Reason for meeting
                  </label>
                  <textarea
                    id="reason"
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    aria-describedby="reason-count"
                    className="input-dark mt-1"
                  />
                  <p id="reason-count" className="label-hint">
                    {reason.length}/500 characters (min 10)
                  </p>
                </div>

                <div>
                  <label htmlFor="notes" className="label text-xs">
                    Additional notes{" "}
                    <span className="font-normal text-content-subtle">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="notes"
                    maxLength={500}
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    aria-describedby="notes-count"
                    className="input-dark mt-1"
                  />
                  <p id="notes-count" className="label-hint">
                    {notes.length}/500 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!selectedSlot || isSubmitting}
                  aria-busy={isSubmitting}
                  aria-disabled={!selectedSlot}
                  aria-describedby={error ? "request-form-error" : undefined}
                  className="btn-primary w-full"
                >
                  {isSubmitting
                    ? "Sending request..."
                    : !selectedSlot
                      ? "Select a time slot first"
                      : "Send appointment request"}
                </button>
              </form>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
