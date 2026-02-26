import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import rateLimit from "express-rate-limit";
import { normalizePrincipal } from "./shared/auth.js";
import { adapt } from "./shared/adapter.js";
import { handleHealth } from "./src/functions/health.js";
import { handleTeams } from "./src/functions/teams.js";
import { assignTeams } from "./src/functions/teams-assign.js";
import { handleScores } from "./src/functions/scores.js";
import {
  getAttendees,
  handleAttendeesMe,
  deleteAttendee,
  moveAttendee,
} from "./src/functions/attendees.js";
import { handleAwards } from "./src/functions/awards.js";
import {
  getSubmissions,
  validateSubmission,
} from "./src/functions/submissions.js";
import { postUpload } from "./src/functions/upload.js";
import { handleFlags } from "./src/functions/flags.js";
import { handleRubrics, getActiveRubric } from "./src/functions/rubrics.js";
import {
  listTemplates,
  activateTemplate,
} from "./src/functions/rubricTemplates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // Trust App Service reverse proxy (reflects X-Forwarded-Proto as https)
  app.set("trust proxy", 1);

  // Rate limiter for SPA fallback route to mitigate DoS against sendFile
  const spaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 SPA fallback requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(express.json({ limit: "512kb" }));

  // Security headers
  app.use((_req, res, next) => {
    res.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.azure.com; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("X-Frame-Options", "DENY");
    res.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // --- API routes ---
  app.get("/api/health", adapt(handleHealth));

  app.route("/api/teams").all(adapt(handleTeams));
  app.post("/api/teams/assign", adapt(assignTeams));

  app.route("/api/scores").all(adapt(handleScores));

  app.get("/api/attendees", adapt(getAttendees));
  app.delete("/api/attendees", adapt(deleteAttendee));
  app.post("/api/attendees/move", adapt(moveAttendee));
  app.route("/api/attendees/me").all(adapt(handleAttendeesMe));

  app.route("/api/awards").all(adapt(handleAwards));

  app.get("/api/submissions", adapt(getSubmissions));
  app.post("/api/submissions/validate", adapt(validateSubmission));

  app.post("/api/upload", adapt(postUpload));

  app.route("/api/flags").all(adapt(handleFlags));

  app.get("/api/me", (req, res) => {
    const encoded = req.headers["x-ms-client-principal"];
    if (!encoded) {
      return res.json({ clientPrincipal: null });
    }
    try {
      const raw = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      const principal = normalizePrincipal(raw);
      return res.json({ clientPrincipal: principal });
    } catch {
      return res.json({ clientPrincipal: null });
    }
  });

  // NOTE: /api/rubrics/active must be registered before /api/rubrics to avoid route shadowing
  app.get("/api/rubrics/active", adapt(getActiveRubric));
  app.get("/api/rubrics/templates", adapt(listTemplates));
  app.post("/api/rubrics/templates/:slug/activate", adapt(activateTemplate));
  app.route("/api/rubrics").all(adapt(handleRubrics));

  // Static files and SPA fallback
  app.use(express.static(join(__dirname, "..", "src")));
  app.get("/*splat", spaLimiter, (_req, res) => {
    res.sendFile(join(__dirname, "..", "src", "index.html"));
  });

  return app;
}
