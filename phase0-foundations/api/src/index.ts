import 'dotenv/config';
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";
import devicesRouter from "./routes/devices.js";
import eventsRouter from "./routes/events.js";
import settingsRouter from "./routes/settings.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// attach supabase to req
app.use((req, _res, next) => {
  (req as any).supabase = supabase;
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/devices", devicesRouter);
app.use("/events", eventsRouter);
app.use("/settings", settingsRouter);

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`[api] listening on :${port}`));