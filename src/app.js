import {
  getCurrentUser,
  isAdmin,
  loginUrl,
  logoutUrl,
} from "./services/auth.js";
import { api } from "./services/api.js";
import { initTelemetry, trackPageView } from "./services/telemetry.js";
import { renderNavigation } from "./components/Navigation.js";
import { renderLeaderboard } from "./components/Leaderboard.js";
import { renderScoreSubmission } from "./components/ScoreSubmission.js";
import { renderUploadScores } from "./components/UploadScores.js";
import { renderSubmissionStatus } from "./components/SubmissionStatus.js";
import { renderAdminReviewQueue } from "./components/AdminReviewQueue.js";
import { renderAwards } from "./components/Awards.js";
import { renderRegistration } from "./components/Registration.js";
import { renderTeamRoster } from "./components/TeamRoster.js";
import { renderTeamAssignment } from "./components/TeamAssignment.js";
import { renderRubricManager } from "./components/RubricManager.js";
import { renderFeatureFlags } from "./components/FeatureFlags.js";
import { renderQuickScore } from "./components/QuickScore.js";
import { renderHackerManagement } from "./components/HackerManagement.js";
import { renderLogin } from "./components/Login.js";
import { renderLogout } from "./components/Logout.js";

const routes = {
  "": renderLeaderboard,
  leaderboard: renderLeaderboard,
  submit: renderScoreSubmission,
  upload: renderUploadScores,
  status: renderSubmissionStatus,
  review: renderAdminReviewQueue,
  awards: renderAwards,
  register: renderRegistration,
  teams: renderTeamRoster,
  assign: renderTeamAssignment,
  rubrics: renderRubricManager,
  quickscore: renderQuickScore,
  hackers: renderHackerManagement,
  flags: renderFeatureFlags,
  logout: renderLogout,
};

// Routes that require the admin role — non-admins are redirected to the leaderboard
const adminOnlyRoutes = new Set([
  "review",
  "rubrics",
  "quickscore",
  "flags",
  "upload",
  "submit",
  "assign",
  "hackers",
]);

let currentUser;

async function init() {
  initTelemetry();
  currentUser = await getCurrentUser();

  // Show the login landing page for unauthenticated users instead of
  // hard-redirecting to a single provider (Easy Auth is set to AllowAnonymous
  // so the SPA controls the auth UX).
  if (!currentUser) {
    document.getElementById("app-nav").style.display = "none";
    document.querySelector("footer").style.display = "none";
    const main = document.getElementById("maincontent");
    if (getHash() === "logout") {
      renderLogout(main);
    } else {
      renderLogin(main);
    }
    return;
  }

  document.getElementById("app-nav").style.display = "";
  document.querySelector("footer").style.display = "";
  renderNavigation(document.getElementById("app-nav"), currentUser);

  // Auto-register the user on every login — idempotent (200 if already
  // registered, 201 for new). Runs in the background so it never blocks
  // the initial page render. When a new user logs in they appear in the
  // attendees list and get a team assignment without manual action.
  api.attendees.join().catch(() => {});

  handleRoute();
  window.addEventListener("hashchange", handleRoute);

  // Populate build version in footer — fire-and-forget, never blocks the UI
  fetch("/api/health")
    .then((r) => r.json())
    .then((h) => {
      const el = document.getElementById("app-version");
      if (el && h.buildSha) el.textContent = `v${h.buildSha}`;
    })
    .catch(() => {});

  // Auto-refresh leaderboard every 30s
  setInterval(() => {
    const hash = getHash();
    if (hash === "" || hash === "leaderboard") {
      const main = document.getElementById("maincontent");
      if (main) renderLeaderboard(main, currentUser);
    }
  }, 30000);
}

function getHash() {
  return window.location.hash.replace("#/", "").replace("#", "");
}

function handleRoute() {
  const hash = getHash();
  const main = document.getElementById("maincontent");

  // Update nav active state
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const linkHash = link.getAttribute("href")?.replace("#/", "") || "";
    if (linkHash === hash || (hash === "" && linkHash === "leaderboard")) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  // Guard against prototype-chain properties being invoked as route handlers
  // (CWE-754 / CodeQL js/unvalidated-dynamic-method-call).
  if (Object.hasOwn(routes, hash) && typeof routes[hash] === "function") {
    // Block non-admins from admin-only routes
    if (adminOnlyRoutes.has(hash) && !isAdmin(currentUser)) {
      window.location.hash = "#/leaderboard";
      return;
    }
    routes[hash](main, currentUser);
  } else {
    main.innerHTML = `
      <section class="card text-center" style="padding: 3rem;">
        <h2>Page Not Found</h2>
        <p class="text-secondary mt-2">The page you're looking for doesn't exist.</p>
        <a href="#/leaderboard" class="btn btn-primary mt-2">Back to Leaderboard</a>
      </section>
    `;
  }

  // Announce page change
  const liveRegion = document.getElementById("sr-announcer");
  if (liveRegion) {
    liveRegion.textContent = `Navigated to ${hash || "leaderboard"} page`;
  }
}

document.addEventListener("DOMContentLoaded", init);
