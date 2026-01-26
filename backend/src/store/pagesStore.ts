export interface SchedulingPage {
  slug: string;
  calendarUrl: string;
  ownerName: string;
  ownerEmail: string;
  bio?: string;
  defaultDurationMinutes: number;
  bufferMinutes: number;
  dateRangeDays: number;
  minNoticeHours: number;
  includeWeekends: boolean;
  createdAt: number;
  expiresAt: number;
}

class InMemoryPagesStore {
  private pages = new Map<string, SchedulingPage>();

  create(page: SchedulingPage): SchedulingPage {
    this.pages.set(page.slug, page);
    return page;
  }

  get(slug: string): SchedulingPage | undefined {
    const page = this.pages.get(slug);
    if (!page) return undefined;
    const now = Date.now();
    if (now >= page.expiresAt) {
      this.pages.delete(slug);
      return undefined;
    }
    return page;
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [slug, page] of this.pages.entries()) {
      if (now >= page.expiresAt) {
        this.pages.delete(slug);
      }
    }
  }
}

export const pagesStore = new InMemoryPagesStore();

// Periodic purge every 15 minutes
setInterval(() => {
  pagesStore.purgeExpired();
}, 15 * 60 * 1000);

