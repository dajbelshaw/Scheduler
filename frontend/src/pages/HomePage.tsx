import { FormEvent, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface CreatePageResponse {
  slug: string;
  expiresAt: number;
  eventCount: number;
}

const STEP_TITLES = {
  1: "Enter Calendar URL - Scheduler",
  2: "Your Details - Scheduler",
  3: "Share Your Link - Scheduler"
};

export function HomePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [calendarUrl, setCalendarUrl] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [bio, setBio] = useState("");
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [dateRange, setDateRange] = useState(60);
  const [minNotice, setMinNotice] = useState(8);
  const [includeWeekends, setIncludeWeekends] = useState(false);

  const [previewEventCount, setPreviewEventCount] = useState<number | null>(
    null
  );
  const [createdPage, setCreatedPage] = useState<CreatePageResponse | null>(
    null
  );
  const [copySuccess, setCopySuccess] = useState(false);

  // Update page title based on step
  useEffect(() => {
    document.title = STEP_TITLES[step];
  }, [step]);

  const handleValidateCalendar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const resp = await axios.post<CreatePageResponse>("/api/pages", {
        calendarUrl,
        ownerName: "Preview",
        ownerEmail: "preview@example.com"
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
        calendarUrl,
        ownerName,
        ownerEmail,
        bio,
        defaultDurationMinutes: duration,
        bufferMinutes: buffer,
        dateRangeDays: dateRange,
        minNoticeHours: minNotice,
        includeWeekends
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
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
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
          No sign-up, no database, no tracking. URLs expire after 24 hours.
        </p>
      </header>

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

        {/* Step 1: Calendar URL */}
        {step === 1 && (
          <form onSubmit={handleValidateCalendar} className="space-y-4">
            <div>
              <label htmlFor="calendar-url" className="label required-indicator">
                Calendar subscription URL (ICS/iCal)
              </label>
              <input
                id="calendar-url"
                type="url"
                required
                autoComplete="url"
                aria-describedby="calendar-url-hint"
                placeholder="https://mail.proton.me/api/calendar/v1/..."
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
                className="input mt-2"
              />
              <p id="calendar-url-hint" className="label-hint mt-2">
                We only read free/busy information. No event details are shown
                to requesters.
              </p>
            </div>

            {error && (
              <div className="alert-error" role="alert" aria-live="assertive">
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
                  className="input mt-2"
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
                  className="input mt-2"
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
                  className="input mt-2"
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
                  1–180 days
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="include-weekends"
                type="checkbox"
                checked={includeWeekends}
                onChange={(e) => setIncludeWeekends(e.target.checked)}
                className="h-4 w-4 rounded border-border-muted bg-surface-elevated text-accent-text focus:ring-accent-text"
              />
              <label htmlFor="include-weekends" className="label">
                Include weekends
              </label>
            </div>

            {error && (
              <div className="alert-error" role="alert" aria-live="assertive">
                {error}
              </div>
            )}

            <p className="pt-2 text-xs text-content-muted">
              Link expires in 24 hours. Regenerate daily to keep sharing.
            </p>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-ghost"
              >
                ← Back
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
          Privacy-first scheduling. Calendar details stay with your provider —
          only availability is shared.
        </p>
      </footer>
    </main>
  );
}
