import { FormEvent, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface CreatePageResponse {
  slug: string;
  expiresAt: number;
  eventCount: number;
}

const STEP_TITLES = {
  1: "Enter Calendar URL - CalAnywhere",
  2: "Your Details - CalAnywhere",
  3: "Share Your Link - CalAnywhere"
};

const EXPIRY_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 4, label: "4 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "7 days" },
  { value: 336, label: "14 days" },
  { value: 720, label: "30 days" }
];

export function HomePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [calendarUrls, setCalendarUrls] = useState<string[]>([""]);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [bio, setBio] = useState("");
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [dateRange, setDateRange] = useState(60);
  const [minNotice, setMinNotice] = useState(8);
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [expiryHours, setExpiryHours] = useState(24);

  const [previewEventCount, setPreviewEventCount] = useState<number | null>(
    null
  );
  const [createdPage, setCreatedPage] = useState<CreatePageResponse | null>(
    null
  );
  const [copySuccess, setCopySuccess] = useState(false);
  const [, setTick] = useState(0);

  // Re-render every 60s so the countdown label stays fresh
  useEffect(() => {
    if (step !== 3 || !createdPage) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [step, createdPage]);

  // Update page title based on step
  useEffect(() => {
    document.title = STEP_TITLES[step];
  }, [step]);

  const updateCalendarUrl = (index: number, value: string) => {
    setCalendarUrls((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addCalendarUrl = () => {
    if (calendarUrls.length < 5) {
      setCalendarUrls((prev) => [...prev, ""]);
    }
  };

  const removeCalendarUrl = (index: number) => {
    if (calendarUrls.length > 1) {
      setCalendarUrls((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const nonEmptyUrls = calendarUrls.filter((u) => u.trim().length > 0);

  const handleValidateCalendar = async (e: FormEvent) => {
    e.preventDefault();
    if (nonEmptyUrls.length === 0) {
      setError("Please enter at least one calendar URL.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const resp = await axios.post<{ eventCount: number }>("/api/pages/validate", {
        calendarUrls: nonEmptyUrls
      });
      setPreviewEventCount(resp.data.eventCount);
      setStep(2);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          "We could not load your calendar. Please check the ICS URL."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePage = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const resp = await axios.post<CreatePageResponse>("/api/pages", {
        calendarUrls: nonEmptyUrls,
        ownerName,
        ownerEmail,
        bio,
        defaultDurationMinutes: duration,
        bufferMinutes: buffer,
        dateRangeDays: dateRange,
        minNoticeHours: minNotice,
        includeWeekends,
        expiryHours
      });
      setCreatedPage(resp.data);
      setStep(3);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ??
          "We could not create your scheduling page. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

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

  const shareUrl = createdPage
    ? `${window.location.origin}/s/${createdPage.slug}`
    : "";

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }, [shareUrl]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10"
    >
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-content">
          Share your calendar availability privately
        </h1>
        <p className="mt-3 text-content-muted">
          No sign-up, no database, no tracking. Links expire on your schedule.
        </p>
        <p className="mt-4 text-sm text-content-muted">
          Paste one or more calendar links from any provider — Google, Outlook,
          Proton, Apple, or anything that offers an ICS feed — and CalAnywhere
          creates a temporary page showing only when you're free. Ideal for
          freelancers juggling multiple clients, educators with split
          timetables, or anyone who wants to offer appointment slots without
          yet another account.
        </p>
        <div className="mt-5 flex flex-col gap-1 text-xs text-content-muted sm:flex-row sm:gap-4">
          <span><span className="font-semibold text-accent-text">1.</span> Paste a calendar link</span>
          <span className="hidden sm:inline" aria-hidden="true">&#8594;</span>
          <span><span className="font-semibold text-accent-text">2.</span> Set your preferences</span>
          <span className="hidden sm:inline" aria-hidden="true">&#8594;</span>
          <span><span className="font-semibold text-accent-text">3.</span> Share the link</span>
        </div>
      </header>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Key features">
        <div>
          <h2 className="text-sm font-semibold text-content">Works with any calendar</h2>
          <p className="mt-1 text-xs text-content-muted">
            Google, Outlook, Proton, Apple, Fastmail — anything with an ICS
            link. Merge up to five calendars so your availability reflects all
            your commitments.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-content">Ephemeral by design</h2>
          <p className="mt-1 text-xs text-content-muted">
            Links self-destruct after a duration you choose, from one hour to
            30 days. Nothing is stored once a link expires — no database, no
            backups, no trace.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-content">Spam-free requests</h2>
          <p className="mt-1 text-xs text-content-muted">
            Every appointment request is verified by email before it reaches
            you. Combined with rate limiting and bot detection, only genuine
            requests get through.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-content">Fully configurable</h2>
          <p className="mt-1 text-xs text-content-muted">
            Set appointment length, buffer time, minimum notice, working days,
            and how far ahead visitors can book — from one day to six months.
          </p>
        </div>
      </section>

      <section className="card mb-8" aria-label="Create scheduling page">
        {/* Step indicator */}
        <nav aria-label="Progress" className="mb-4">
          <ol className="flex gap-2 text-sm text-content-muted">
            <li className={step === 1 ? "font-semibold text-accent-text" : ""}>
              <span aria-current={step === 1 ? "step" : undefined}>
                1. Calendar URL
              </span>
            </li>
            <li aria-hidden="true">›</li>
            <li className={step === 2 ? "font-semibold text-accent-text" : ""}>
              <span aria-current={step === 2 ? "step" : undefined}>
                2. Your details
              </span>
            </li>
            <li aria-hidden="true">›</li>
            <li className={step === 3 ? "font-semibold text-accent-text" : ""}>
              <span aria-current={step === 3 ? "step" : undefined}>
                3. Share link
              </span>
            </li>
          </ol>
        </nav>

        {/* Step 1: Calendar URL(s) */}
        {step === 1 && (
          <form onSubmit={handleValidateCalendar} className="space-y-4">
            <h2 className="text-lg font-semibold text-content">
              Step 1: Paste your calendar URL
            </h2>
            <div>
              <label className="label required-indicator">
                Calendar subscription URL(s) (ICS/iCal)
              </label>
              {calendarUrls.map((url, index) => (
                <div key={index} className="mt-2 flex items-center gap-2">
                  <input
                    type="url"
                    required={index === 0}
                    autoComplete="url"
                    aria-label={`Calendar URL ${index + 1}`}
                    aria-describedby={index === 0 && error ? "calendar-url-error" : undefined}
                    placeholder="https://calendar.example.com/your-calendar.ics"
                    value={url}
                    onChange={(e) => updateCalendarUrl(index, e.target.value)}
                    className="input"
                  />
                  {calendarUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCalendarUrl(index)}
                      className="shrink-0 min-h-touch min-w-touch text-xs text-content-muted hover:text-error"
                      aria-label={`Remove calendar URL ${index + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {calendarUrls.length < 5 && (
                <button
                  type="button"
                  onClick={addCalendarUrl}
                  className="mt-2 min-h-touch text-xs text-accent-text hover:text-accent-hover"
                >
                  + Add another calendar (up to 5)
                </button>
              )}
              <p className="label-hint mt-2">
                Only free/busy times are read — no event titles, descriptions,
                or attendees are ever shared.
              </p>
            </div>

            {error && (
              <div id="calendar-url-error" className="alert-error" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="btn-primary"
            >
              {isLoading ? "Checking calendar..." : "Validate calendar URL"}
            </button>

            {previewEventCount !== null && (
              <div className="alert-success" role="status" aria-live="polite">
                Calendar loaded. Found {previewEventCount} events in the next 60
                days.
              </div>
            )}
          </form>
        )}

        {/* Step 2: User Details */}
        {step === 2 && (
          <form onSubmit={handleCreatePage} className="space-y-4">
            <h2 className="text-lg font-semibold text-content">
              Step 2: Your details and preferences
            </h2>
            <p className="text-xs text-content-muted">
              Fields marked with <span className="text-error">*</span> are
              required.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="owner-name" className="label required-indicator">
                  Your name
                </label>
                <input
                  id="owner-name"
                  type="text"
                  minLength={2}
                  maxLength={100}
                  required
                  autoComplete="name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="input mt-2"
                />
              </div>
              <div>
                <label htmlFor="owner-email" className="label required-indicator">
                  Email for requests
                </label>
                <input
                  id="owner-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="input mt-2"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="label">
                Short bio or title{" "}
                <span className="font-normal text-content-muted">(optional)</span>
              </label>
              <textarea
                id="bio"
                maxLength={200}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                aria-describedby="bio-count"
                className="input mt-2"
              />
              <p id="bio-count" className="label-hint">
                {bio.length}/200 characters
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="duration" className="label">
                  Appointment duration
                </label>
                <select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="select mt-2"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
              <div>
                <label htmlFor="min-notice" className="label">
                  Minimum notice
                </label>
                <select
                  id="min-notice"
                  value={minNotice}
                  onChange={(e) => setMinNotice(Number(e.target.value))}
                  className="select mt-2"
                >
                  <option value={0}>No minimum</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={8}>8 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="buffer" className="label">
                  Buffer between slots
                </label>
                <select
                  id="buffer"
                  value={buffer}
                  onChange={(e) => setBuffer(Number(e.target.value))}
                  className="select mt-2"
                >
                  <option value={0}>No buffer</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </div>
              <div>
                <label htmlFor="date-range" className="label">
                  Days to show
                </label>
                <input
                  id="date-range"
                  type="number"
                  min={1}
                  max={180}
                  value={dateRange}
                  onChange={(e) => setDateRange(Number(e.target.value))}
                  aria-describedby="date-range-hint"
                  className="input mt-2"
                />
                <p id="date-range-hint" className="label-hint">
                  1-180 days
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="expiry" className="label">
                  Link expiry duration
                </label>
                <select
                  id="expiry"
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(Number(e.target.value))}
                  className="select mt-2"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-2.5">
                <div className="flex items-center gap-3">
                  <input
                    id="include-weekends"
                    type="checkbox"
                    checked={includeWeekends}
                    onChange={(e) => setIncludeWeekends(e.target.checked)}
                    className="checkbox"
                  />
                  <label htmlFor="include-weekends" className="label">
                    Include weekends
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div id="details-error" className="alert-error" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-ghost"
              >
                &larr; Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="btn-primary"
              >
                {isLoading ? "Generating..." : "Generate scheduling page"}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Share Link */}
        {step === 3 && createdPage && (
          <div className="space-y-4" role="region" aria-label="Share your link">
            <h2 className="text-lg font-semibold text-content">
              Step 3: Share your scheduling link
            </h2>
            <p className="text-sm text-content/90">
              Your scheduling page is ready. Share this link with anyone who
              should be able to request a time with you.
            </p>

            <div className="card-inner">
              <div
                id="share-link-label"
                className="text-xs uppercase tracking-wide text-content-muted"
              >
                Shareable link
              </div>
              <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
                <code
                  className="min-w-0 flex-1 text-truncate rounded-input bg-surface-base/70 px-3 py-2.5 text-xs text-accent-text"
                  aria-labelledby="share-link-label"
                >
                  {shareUrl}
                </code>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-live="polite"
                  className="btn-light mt-2 min-w-[100px] text-xs md:mt-0"
                >
                  {copySuccess ? (
                    <>
                      <svg
                        className="mr-1.5 h-4 w-4 text-success"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    "Copy link"
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-content-muted">
                Link expires in {countdownLabel(createdPage.expiresAt)}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/s/${createdPage.slug}`)}
              className="btn-secondary"
            >
              View scheduling page
            </button>
          </div>
        )}
      </section>

      <footer className="mt-auto pt-8 text-xs text-content-subtle">
        <p>
          Privacy-first scheduling by{" "}
          <a href="https://dynamicskillset.com" className="underline hover:text-content-muted">
            Dynamic Skillset
          </a>.
          Your calendar details never leave your provider — only availability is
          shared. All data is deleted when your link expires.
        </p>
      </footer>
    </main>
  );
}
