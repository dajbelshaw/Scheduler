import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { pagesRouter } from "./routes/pages";
import { createAuthRouter } from "./auth";
import { initDatabase, getPool } from "./db/client";
import { runMigrations } from "./db/migrate";
import { initStores } from "./store";

const app = express();
const port = process.env.PORT || 4000;

app.set('trust proxy', 1);

// Basic security headers (CSP disabled — frontend is served separately)
app.use(helmet({
  contentSecurityPolicy: false
}));

// CORS: allow all in development, restrict via env in production
const allowedOrigin =
  process.env.ALLOWED_ORIGIN && process.env.ALLOWED_ORIGIN !== "*"
    ? process.env.ALLOWED_ORIGIN
    : "*";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/pages", pagesRouter);

async function start() {
  try {
    const hasDb = await initDatabase();
    if (hasDb) {
      await runMigrations();
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Database initialisation failed:", err);
    // eslint-disable-next-line no-console
    console.log("Falling back to ephemeral in-memory mode.");
  }

  // Auth routes — only available when a database is connected
  const pool = getPool();
  if (pool) {
    app.use("/auth", createAuthRouter(pool));
  }

  // 404 handler must come after all route registrations
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  initStores();

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`CalAnywhere backend listening on port ${port}`);
  });
}

start();
