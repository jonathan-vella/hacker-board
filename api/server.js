import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Trust the App Service reverse proxy so req.protocol reflects X-Forwarded-Proto
// (https) rather than the internal http connection. Required for accurate URL
// construction in the Functions adapter and any HTTPS-aware handler logic.
app.set("trust proxy", 1);

app.use(express.json({ limit: "512kb" }));

// Security headers (ported from staticwebapp.config.json globalHeaders)
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

// Returns the Easy Auth principal injected by the App Service proxy layer.
// Admin role is determined by the ADMIN_USERS env var (comma-separated
// "provider:username" pairs, e.g. "github:octocat").
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

// --- Static files ---
app.use(express.static(join(__dirname, "..", "src")));

// SPA fallback: serve index.html for any non-API, non-static request
// NOTE: Express 5 / path-to-regexp v8 requires named wildcards — bare * is no longer valid
app.get("/*splat", (_req, res) => {
  res.sendFile(join(__dirname, "..", "src", "index.html"));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`HackerBoard server listening on port ${PORT}`);
});
