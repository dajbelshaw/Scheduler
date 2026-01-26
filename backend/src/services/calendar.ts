import axios from "axios";
import ical from "node-ical";
import { RRule, Frequency } from "rrule";

export interface BusySlot {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

/**
 * Converts node-ical's rrule format to an RRule instance
 */
function parseRRule(rrule: any, dtstart: Date): RRule {
  // If it's already a string (most common case with node-ical)
  if (typeof rrule === "string") {
    // Remove RRULE: prefix if present
    const cleanStr = rrule.startsWith("RRULE:") 
      ? rrule.substring(6) 
      : rrule;
    return RRule.fromString(cleanStr);
  }

  // If it's an object, try to construct RRule options
  const options: any = {
    dtstart,
    freq: RRule.WEEKLY, // default
    interval: 1
  };

  // Map frequency
  if (rrule.freq !== undefined) {
    if (typeof rrule.freq === "number") {
      options.freq = rrule.freq;
    } else if (typeof rrule.freq === "string") {
      const freqMap: Record<string, Frequency> = {
        "YEARLY": RRule.YEARLY,
        "MONTHLY": RRule.MONTHLY,
        "WEEKLY": RRule.WEEKLY,
        "DAILY": RRule.DAILY,
        "HOURLY": RRule.HOURLY,
        "MINUTELY": RRule.MINUTELY,
        "SECONDLY": RRule.SECONDLY
      };
      options.freq = freqMap[rrule.freq.toUpperCase()] || RRule.WEEKLY;
    }
  }

  if (rrule.interval !== undefined) options.interval = rrule.interval;
  if (rrule.count !== undefined) options.count = rrule.count;
  if (rrule.until) options.until = new Date(rrule.until);
  if (rrule.byweekday !== undefined) options.byweekday = rrule.byweekday;
  if (rrule.bymonthday !== undefined) options.bymonthday = rrule.bymonthday;
  if (rrule.bymonth !== undefined) options.bymonth = rrule.bymonth;
  if (rrule.byday !== undefined) {
    // Convert byday to byweekday if needed
    options.byweekday = rrule.byday;
  }

  return new RRule(options);
}

/**
 * Fetches and parses an iCalendar feed, expanding recurring events
 * to generate a list of busy time slots within the specified date range.
 */
export async function fetchAndParseCalendar(
  calendarUrl: string,
  startDate: Date,
  endDate: Date
): Promise<BusySlot[]> {
  const response = await axios.get(calendarUrl, {
    timeout: 5000,
    headers: {
      "User-Agent": "ProtonScheduler/1.0"
    }
  });

  const parsed = ical.sync.parseICS(response.data);
  const busySlots: BusySlot[] = [];

  // Extract timezone definitions
  const timezones = new Map<string, any>();
  for (const item of Object.values(parsed)) {
    if ((item as any).type === "VTIMEZONE") {
      const tz = item as any;
      timezones.set(tz.tzid, tz);
    }
  }

  for (const item of Object.values(parsed)) {
    const event: any = item;
    if (event.type !== "VEVENT") continue;

    // Skip events without start/end
    if (!event.start || !event.end) continue;

    // Skip events marked as "free" (TRANSP:TRANSPARENT)
    // Default is OPAQUE (busy) if not specified
    const transp = event.transp || event.transparency || "OPAQUE";
    if (transp === "TRANSPARENT") continue;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    // Handle recurring events
    if (event.rrule) {
      try {
        // node-ical may return an already-parsed RRule object with a between() method
        // or it may return a string/object that needs parsing
        let occurrences: Date[];
        if (typeof event.rrule.between === "function") {
          // Already parsed by node-ical, use directly
          occurrences = event.rrule.between(startDate, endDate, true);
        } else {
          // Need to parse manually
          const rrule = parseRRule(event.rrule, eventStart);
          occurrences = rrule.between(startDate, endDate, true);
        }

        // Handle exclusions (EXDATE)
        const exdates = new Set<string>();
        if (event.exdate) {
          const exdateArray = Array.isArray(event.exdate) ? event.exdate : [event.exdate];
          for (const exdate of exdateArray) {
            const exdateDate = new Date(exdate);
            exdates.add(exdateDate.toISOString().split("T")[0]); // YYYY-MM-DD
          }
        }

        for (const occurrence of occurrences) {
          // Check if this occurrence is excluded
          const occurrenceDateStr = occurrence.toISOString().split("T")[0];
          if (exdates.has(occurrenceDateStr)) continue;

          // Calculate duration from original event
          const duration = eventEnd.getTime() - eventStart.getTime();
          const occurrenceEnd = new Date(occurrence.getTime() + duration);

          // Only include if it overlaps with our range
          if (occurrenceEnd >= startDate && occurrence <= endDate) {
            busySlots.push({
              start: occurrence.toISOString(),
              end: occurrenceEnd.toISOString()
            });
          }
        }
      } catch (err: any) {
        // Log the error for debugging but don't add the event
        // Recurring events often have start dates in the past, so adding
        // the original event would pollute results with incorrect data
        // eslint-disable-next-line no-console
        console.error("RRULE parsing error:", err.message);
      }
    } else {
      // Single event (non-recurring)
      if (eventStart <= endDate && eventEnd >= startDate) {
        busySlots.push({
          start: eventStart.toISOString(),
          end: eventEnd.toISOString()
        });
      }
    }
  }

  // Sort by start time
  busySlots.sort((a, b) => a.start.localeCompare(b.start));

  return busySlots;
}

/**
 * Validates a calendar URL by attempting to fetch and parse it.
 * Returns the number of events found (including expanded recurring events).
 */
export async function validateCalendarUrl(
  calendarUrl: string
): Promise<{ eventCount: number; isValid: boolean; error?: string }> {
  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days

    const busySlots = await fetchAndParseCalendar(calendarUrl, now, endDate);

    return {
      eventCount: busySlots.length,
      isValid: true
    };
  } catch (err: any) {
    return {
      eventCount: 0,
      isValid: false,
      error: err.message || "Unknown error"
    };
  }
}
