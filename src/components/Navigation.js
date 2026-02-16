import { isAdmin, getUsername, loginUrl, logoutUrl } from "../services/auth.js";

export function renderNavigation(container, user) {
  const admin = isAdmin(user);
  const username = getUsername(user);

  container.innerHTML = `
    <div class="header-inner">
      <a href="#/leaderboard" class="app-logo" aria-label="HackerBoard home">HackerBoard</a>
      <nav aria-label="Main navigation">
        <ul class="nav-links">
          <li><a href="#/leaderboard">Leaderboard</a></li>
          ${user ? `<li><a href="#/submit">Submit Score</a></li>` : ""}
          ${user ? `<li><a href="#/upload">Upload</a></li>` : ""}
          ${user ? `<li><a href="#/teams">Teams</a></li>` : ""}
          <li><a href="#/awards">Awards</a></li>
          ${admin ? `<li><a href="#/review">Review Queue</a></li>` : ""}
          ${admin ? `<li><a href="#/rubrics">Rubrics</a></li>` : ""}
        </ul>
      </nav>
      <div class="header-actions">
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle theme">
          <span id="theme-icon">🌙</span>
        </button>
        ${
          user
            ? `<span class="text-secondary" style="font-size:0.875rem">${username}</span>
               <a href="${logoutUrl()}" class="btn btn-sm">Sign Out</a>`
            : `<a href="${loginUrl()}" class="btn btn-primary btn-sm">Sign In</a>`
        }
      </div>
    </div>
  `;

  initThemeToggle();
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
