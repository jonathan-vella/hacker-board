import { isAdmin, getMyAlias, loginUrl, logoutUrl } from "../services/auth.js";
import { api } from "../services/api.js";
import { updatePendingBadge } from "../services/notifications.js";

let searchDebounceTimer;

export async function renderNavigation(container, user) {
  const admin = isAdmin(user);

  // Resolve alias asynchronously — show placeholder while loading
  let alias = "";
  if (user) {
    alias = (await getMyAlias()) || "";
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
          ${
            admin
              ? `
          <li class="admin-dropdown">
            <button class="admin-dropdown__trigger" id="admin-menu-btn" type="button" aria-expanded="false" aria-haspopup="true" aria-controls="admin-menu">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Admin
              <svg class="admin-dropdown__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <ul class="admin-dropdown__menu" id="admin-menu" role="menu">
              <li role="none"><a href="#/review" role="menuitem">Review Queue <span id="pending-count-badge" class="pending-badge" style="display:none" aria-live="polite"></span></a></li>
              <li role="none"><a href="#/quickscore" role="menuitem">Quick Score</a></li>
              <li role="none"><a href="#/rubrics" role="menuitem">Rubrics</a></li>
              <li role="none"><a href="#/flags" role="menuitem">Feature Flags</a></li>
            </ul>
          </li>`
              : ""
          }
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
            ? buildUserChip(user, alias)
            : `<a href="${loginUrl()}" class="btn btn-primary btn-sm">Sign In</a>`
        }
      </div>
    </div>
  `;

  initThemeToggle();
  initSearch();
  initMobileMenu();
  if (admin) {
    initAdminDropdown();
    updatePendingBadge(api);
  }
}

/**
 * Builds the signed-in user chip: avatar (GitHub) or initials badge, display
 * name with alias fallback, and a Sign Out link.
 */
function buildUserChip(user, alias) {
  const isGitHub = user.identityProvider === "github";
  const displayName = alias || user.userDetails || "";
  const isAdminUser = user.userRoles?.includes("admin");

  const initial = (displayName || "?").charAt(0).toUpperCase();
  const avatarSrc =
    user.avatarUrl ||
    (isGitHub ? `https://github.com/${user.userDetails}.png?size=64` : "");
  const avatarHtml = avatarSrc
    ? `<img
        src="${avatarSrc}"
        width="28" height="28"
        alt="${displayName} avatar"
        class="user-avatar"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display=''"
      /><span class="user-avatar user-avatar--initials" aria-hidden="true" style="display:none">${initial}</span>`
    : `<span class="user-avatar user-avatar--initials" aria-hidden="true">${initial}</span>`;

  const roleTag = isAdminUser
    ? `<span class="user-role-tag" title="Administrator">admin</span>`
    : "";

  return `
    <div class="user-chip">
      ${avatarHtml}
      ${displayName ? `<span class="user-chip__name">${displayName}</span>` : ""}
      ${roleTag}
    </div>
    <a href="${logoutUrl()}" class="btn btn-sm">Sign Out</a>`;
}

function initAdminDropdown() {
  const btn = document.getElementById("admin-menu-btn");
  const menu = document.getElementById("admin-menu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });

  menu.addEventListener("click", () => {
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".admin-dropdown")) {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  btn.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      menu.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }
  });
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
