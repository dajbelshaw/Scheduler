import axios from "axios";
import { FormEvent, useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";

interface PageData {
  slug: string;
  ownerName: string;
  ownerEmail: string;
  bio?: string;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  dateRangeDays: number;
  minNoticeHours: number;
  includeWeekends: boolean;
  expiresAt: number;
  busySlots: { start: string; end: string }[];
}

interface Slot {
  start: Date;
  end: Date;
}

export function SchedulingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<PageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);

  // Update page title when page data loads
  useEffect(() => {
    if (page) {
      document.title = `Schedule with ${page.ownerName} - Scheduler`;
    } else if (error) {
      document.title = "Link Unavailable - Scheduler";
    } else {
      document.title = "Loading... - Scheduler";
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

  const isBusy = (start: Date, end: Date) => {
    if (!page) return false;
    return page.busySlots.some((slot) => {
      const s = new Date(slot.start);
      const e = new Date(slot.end);
      return s < end && e > start;
    });
  };

  const buildSlots = (): { date: Date; slots: Slot[] }[] => {
    if (!page) return [];
    const out: { date: Date; slots: Slot[] }[] = [];
    const duration = page.defaultDurationMinutes;
    const now = new Date();
    const minNoticeMs = (page.minNoticeHours ?? 8) * 60 * 60 * 1000;
    const earliestStart = new Date(now.getTime() + minNoticeMs);
    const includeWeekends = page.includeWeekends ?? false;
    const days = Math.min(7, page.dateRangeDays);

    let daysAdded = 0;
    let dayOffset = 0;

    // Loop until we have enough days (up to 14 days out to find 7 weekdays)
    while (daysAdded < days && dayOffset < 14) {
      const day = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
        0,
        0,
        0,
        0
      );

      const dayOfWeek = day.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Skip weekends if not included
      if (isWeekend && !includeWeekends) {
        dayOffset++;
        continue;
      }

      const slots: Slot[] = [];
      for (let h = 9; h < 17; h++) {
        const start = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          h,
          0,
          0,
          0
        );
        const end = new Date(start.getTime() + duration * 60000);

        // Skip slots that don't meet minimum notice requirement
        if (start < earliestStart) {
          continue;
        }

        if (!isBusy(start, end)) {
          slots.push({ start, end });
        }
      }
      out.push({ date: day, slots });
      daysAdded++;
      dayOffset++;
    }
    return out;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!page || !slug || !selectedSlot) return;
    setIsSubmitting(true);
    setSuccessMessage(null);
    setError(null);
    try {
      await axios.post(`/api/pages/${slug}/requests`, {
        requesterName,
        requesterEmail,
        reason,
        notes,
        startIso: selectedSlot.start.toISOString(),
        endIso: selectedSlot.end.toISOString()
      });
      setSuccessMessage(
        `Your appointment request has been sent to ${page.ownerName}. They will respond to your email address (${requesterEmail}).`
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
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-8"
    >
      {/* Loading skeleton */}
      {isLoading && (
        <div aria-busy="true" aria-label="Loading scheduling page">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
            <div className="flex-1">
              <div className="skeleton h-8 w-48" />
              <div className="skeleton mt-2 h-4 w-64" />
            </div>
            <div className="skeleton h-4 w-32" />
          </div>
          <div className="grid gap-6 md:grid-cols-[2fr,1.4fr]">
            <div className="card">
              <div className="skeleton mb-3 h-4 w-40" />
              <div className="grid gap-3 md:grid-cols-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i}>
                    <div className="skeleton mb-2 h-3 w-16" />
                    <div className="flex flex-wrap gap-1">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="skeleton h-8 w-24 rounded-pill" />
                      ))}
                    </div>
                  </div>
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
      {!isLoading && error && (
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
            </div>
            <div className="shrink-0 text-xs text-content-muted">
              Link expires in{" "}
              <span className="font-medium text-accent-text">
                {countdownLabel(page.expiresAt)}
              </span>
            </div>
          </header>

          <section
            className="grid gap-6 md:grid-cols-[2fr,1.4fr]"
            aria-label="Schedule appointment"
          >
            {/* Time slots */}
            <div
              className="card"
              role="region"
              aria-label="Available time slots"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
                <span>Next 7 days · Free slots</span>
                <span>Times in your browser&apos;s timezone</span>
              </div>

              <div
                className="grid gap-3 md:grid-cols-2"
                role="listbox"
                aria-label="Select a time slot"
              >
                {buildSlots().map(({ date, slots }) => (
                  <div
                    key={date.toISOString()}
                    role="group"
                    aria-label={formatDate(date)}
                  >
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-content-muted">
                      {formatDate(date)}
                    </div>
                    {slots.length === 0 ? (
                      <div className="rounded-input border border-border-muted bg-surface-elevated/70 px-3 py-2.5 text-xs text-content-subtle">
                        No free slots
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {slots.map((slot) => {
                          const isSelected =
                            selectedSlot &&
                            selectedSlot.start.getTime() ===
                              slot.start.getTime() &&
                            selectedSlot.end.getTime() === slot.end.getTime();
                          return (
                            <button
                              key={slot.start.toISOString()}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedSlot(slot);
                                formRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start"
                                });
                              }}
                              className={
                                isSelected
                                  ? "slot-pill-selected"
                                  : "slot-pill-default"
                              }
                            >
                              {formatTimeRange(slot)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-content-subtle">
                Only availability shown — event details remain private.
              </p>
            </div>

            {/* Request form */}
            <div className="card">
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
                  className="alert-success mb-3"
                  role="status"
                  aria-live="polite"
                >
                  {successMessage}
                </div>
              )}

              {error && (
                <div
                  className="alert-error mb-3"
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                <p className="text-[10px] text-content-subtle">
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
                  <p id="reason-count" className="label-hint text-[10px]">
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
                  <p id="notes-count" className="label-hint text-[10px]">
                    {notes.length}/500 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!selectedSlot || isSubmitting}
                  aria-busy={isSubmitting}
                  aria-disabled={!selectedSlot}
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
