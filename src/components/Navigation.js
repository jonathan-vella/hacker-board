import { isAdmin, getMyAlias, loginUrl, logoutUrl } from "../services/auth.js";
import { api } from "../services/api.js";
import { updatePendingBadge } from "../services/notifications.js";

let searchDebounceTimer;

export async function renderNavigation(container, user) {
  const admin = isAdmin(user);

  // Resolve alias asynchronously — show placeholder while loading
  let alias = "";
  if (user) {
    try {
      alias =
        (await getMyAlias((path) =>
          fetch(`/api${path}`).then((r) => r.json()),
        )) || "";
    } catch {
      alias = "";
    }
  }

  container.innerHTML = `
    <div class="header-inner">
      <a href="#/leaderboard" class="app-logo" aria-label="HackerBoard home">HackerBoard</a>
      <button class="mobile-menu-btn" id="mobile-menu-btn" type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="main-nav-list">
        <span aria-hidden="true">☰</span>
      </button>
      <nav aria-label="Main navigation">
        <ul class="nav-links" id="main-nav-list">
          <li><a href="#/leaderboard">Leaderboard</a></li>
          ${user ? `<li><a href="#/submit">Submit Score</a></li>` : ""}
          ${user ? `<li><a href="#/upload">Upload</a></li>` : ""}
          ${user ? `<li><a href="#/teams">Teams</a></li>` : ""}
          <li><a href="#/awards">Awards</a></li>
          ${admin ? `<li><a href="#/review">Review Queue <span id="pending-count-badge" class="pending-badge" style="display:none" aria-live="polite"></span></a></li>` : ""}
          ${admin ? `<li><a href="#/rubrics">Rubrics</a></li>` : ""}
          ${admin ? `<li><a href="#/flags">Flags</a></li>` : ""}
        </ul>
      </nav>
      <div class="header-actions">
        <div class="search-wrapper">
          <label for="global-search" class="sr-only">Search teams or hackers</label>
          <input
            type="search"
            id="global-search"
            class="search-input"
            placeholder="Search teams..."
            aria-label="Search teams or hackers"
            autocomplete="off"
          />
          <div id="search-results" class="search-results hidden" role="listbox" aria-label="Search results"></div>
        </div>
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle theme">
          <span id="theme-icon">🌙</span>
        </button>
        ${
          user
            ? `${alias ? `<span class="text-secondary" style="font-size:0.875rem">${alias}</span>` : ""}
               <a href="${logoutUrl()}" class="btn btn-sm">Sign Out</a>`
            : `<a href="${loginUrl()}" class="btn btn-primary btn-sm">Sign In</a>`
        }
      </div>
    </div>
  `;

  initThemeToggle();
  initSearch();
  initMobileMenu();
  if (admin) updatePendingBadge(api);
}

function initMobileMenu() {
  const btn = document.getElementById("mobile-menu-btn");
  const navList = document.getElementById("main-nav-list");
  if (!btn || !navList) return;

  btn.addEventListener("click", () => {
    const isOpen = navList.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  navList.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      navList.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

function initThemeToggle() {
  const stored = localStorage.getItem("hb-theme");
  if (stored === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    updateThemeIcon("dark");
  }

  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("hb-theme", next);
      updateThemeIcon(next);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
}

function initSearch() {
  const input = document.getElementById("global-search");
  const resultsEl = document.getElementById("search-results");
  if (!input || !resultsEl) return;

  input.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    const query = input.value.trim().toLowerCase();

    if (query.length < 2) {
      resultsEl.classList.add("hidden");
      resultsEl.innerHTML = "";
      return;
    }

    searchDebounceTimer = setTimeout(
      () => performSearch(query, resultsEl),
      300,
    );
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      resultsEl.classList.add("hidden");
      input.value = "";
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
      resultsEl.classList.add("hidden");
    }
  });
}

async function performSearch(query, resultsEl) {
  try {
    const [teams, attendees] = await Promise.allSettled([
      api.teams.list(),
      api.attendees.list(),
    ]);

    const results = [];

    if (teams.status === "fulfilled" && Array.isArray(teams.value)) {
      teams.value
        .filter((t) => t.teamName?.toLowerCase().includes(query))
        .slice(0, 5)
        .forEach((t) =>
          results.push({ type: "Team", name: t.teamName, href: "#/teams" }),
        );
    }

    if (attendees.status === "fulfilled" && Array.isArray(attendees.value)) {
      attendees.value
        .filter((a) => (a.alias || "").toLowerCase().includes(query))
        .slice(0, 5)
        .forEach((a) =>
          results.push({
            type: "Hacker",
            name: a.alias,
            href: "#/teams",
          }),
        );
    }

    if (results.length === 0) {
      resultsEl.innerHTML = `<div class="search-item text-secondary">No results found</div>`;
    } else {
      resultsEl.innerHTML = results
        .map(
          (r) =>
            `<a href="${r.href}" class="search-item" role="option">
              <span class="search-type">${r.type}</span>
              <span>${r.name}</span>
            </a>`,
        )
        .join("");
    }

    resultsEl.classList.remove("hidden");
  } catch {
    resultsEl.innerHTML = `<div class="search-item text-secondary">Search unavailable</div>`;
    resultsEl.classList.remove("hidden");
  }
}
