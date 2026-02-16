import {
  getCurrentUser,
  isAdmin,
  getUsername,
  loginUrl,
  logoutUrl,
} from "./services/auth.js";
import { renderNavigation } from "./components/Navigation.js";
import { renderLeaderboard } from "./components/Leaderboard.js";
import { renderScoreSubmission } from "./components/ScoreSubmission.js";
import { renderUploadScores } from "./components/UploadScores.js";
import { renderSubmissionStatus } from "./components/SubmissionStatus.js";
import { renderAdminReviewQueue } from "./components/AdminReviewQueue.js";
import { renderAwards } from "./components/Awards.js";
import { renderRegistration } from "./components/Registration.js";
import { renderTeamRoster } from "./components/TeamRoster.js";
import { renderAttendeeBulkEntry } from "./components/AttendeeBulkEntry.js";
import { renderTeamAssignment } from "./components/TeamAssignment.js";
import { renderRubricManager } from "./components/RubricManager.js";

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
  attendees: renderAttendeeBulkEntry,
  assign: renderTeamAssignment,
  rubrics: renderRubricManager,
};

let currentUser;

async function init() {
  currentUser = await getCurrentUser();
  renderNavigation(document.getElementById("app-nav"), currentUser);
  handleRoute();
  window.addEventListener("hashchange", handleRoute);

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

  const renderer = routes[hash];
  if (renderer) {
    renderer(main, currentUser);
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
