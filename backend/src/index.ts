import express from "express";
import cors from "cors";
import helmet from "helmet";
import { json } from "body-parser";
import { pagesRouter } from "./routes/pages";

const app = express();
const port = process.env.PORT || 4000;

app.set('trust proxy', 1);

// Basic security headers
app.use(helmet());

// CORS: allow all in development, restrict via env in production
const allowedOrigin =
  process.env.ALLOWED_ORIGIN && process.env.ALLOWED_ORIGIN !== "*"
    ? process.env.ALLOWED_ORIGIN
    : "*";

app.use(
  cors({
    origin: allowedOrigin
  })
);

app.use(json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/pages", pagesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Scheduler backend listening on port ${port}`);
});

