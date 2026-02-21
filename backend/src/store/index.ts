import { getPool } from "../db/client";
import type { IPagesStore, IPendingRequestsStore, IBookingsStore } from "./interfaces";
import { InMemoryPagesStore } from "./pagesStore";
import { InMemoryPendingRequestsStore } from "./pendingRequestsStore";
import { InMemoryBookingsStore } from "./inMemoryBookingsStore";
import { PgPagesStore } from "./pgPagesStore";
import { PgPendingRequestsStore } from "./pgPendingRequestsStore";
import { PgBookingsStore } from "./pgBookingsStore";

export let pagesStore: IPagesStore;
export let pendingRequestsStore: IPendingRequestsStore;
export let bookingsStore: IBookingsStore;

let purgeTimers: NodeJS.Timeout[] = [];

export function initStores(): void {
  for (const t of purgeTimers) clearInterval(t);
  purgeTimers = [];

  const pool = getPool();

  if (pool) {
    // eslint-disable-next-line no-console
    console.log("Using PostgreSQL-backed stores.");
    pagesStore = new PgPagesStore(pool);
    pendingRequestsStore = new PgPendingRequestsStore(pool);
    bookingsStore = new PgBookingsStore(pool);
  } else {
    // eslint-disable-next-line no-console
    console.log("Using in-memory stores (no DATABASE_URL).");
    pagesStore = new InMemoryPagesStore();
    pendingRequestsStore = new InMemoryPendingRequestsStore();
    bookingsStore = new InMemoryBookingsStore();
  }

  purgeTimers.push(
    setInterval(() => { pagesStore.purgeExpired(); }, 15 * 60 * 1000)
  );
  purgeTimers.push(
    setInterval(() => { pendingRequestsStore.purgeExpired(); }, 5 * 60 * 1000)
  );

  // Purge expired auth sessions daily
  if (pool) {
    const { purgeExpiredSessions } = require("../auth");
    purgeTimers.push(
      setInterval(() => { purgeExpiredSessions(pool); }, 24 * 60 * 60 * 1000)
    );
  }
}
