import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

export async function renderHackerManagement(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required.</p></section>`;
    return;
  }
  await loadAndRender(container);
}

async function loadAndRender(container) {
  if (container._hackerAbort) container._hackerAbort.abort();
  const abort = new AbortController();
  container._hackerAbort = abort;

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading hackers...</div>`;

  try {
    const [attendees, teams] = await Promise.all([
      api.attendees.list(),
      api.teams.list(),
    ]);

    const teamMap = new Map(teams.map((t) => [t.teamName, t]));

    // Derive a stable sorted list of unique team names for the filter dropdown
    const teamNames = [...new Set(attendees.map((a) => a.teamName).filter(Boolean))].sort();

    render(container, attendees, teamMap, teamNames, abort.signal);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

function render(container, attendees, teamMap, teamNames, signal) {
  container.innerHTML = `
    <section>
      <div class="section-header">
        <h2>Hacker Management</h2>
        <p class="text-secondary" style="margin:0.25rem 0 0">
          ${attendees.length} hacker${attendees.length !== 1 ? "s" : ""} registered across ${teamMap.size} team${teamMap.size !== 1 ? "s" : ""}
        </p>
      </div>

      <div class="card" style="margin-bottom:1.5rem">
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end">
          <div style="flex:1;min-width:200px">
            <label for="hacker-search" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem">Search</label>
            <input
              type="search"
              id="hacker-search"
              class="form-input"
              placeholder="Filter by alias or GitHub username…"
              aria-label="Search hackers"
              autocomplete="off"
            />
          </div>
          <div style="min-width:160px">
            <label for="team-filter" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem">Team</label>
            <select id="team-filter" class="form-input" aria-label="Filter by team">
              <option value="">All teams</option>
              <option value="__unassigned__">Unassigned</option>
              ${teamNames.map((n) => `<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join("")}
            </select>
          </div>
          <div style="min-width:140px">
            <label for="view-mode" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem">View</label>
            <select id="view-mode" class="form-input" aria-label="Switch view mode">
              <option value="table">Table</option>
              <option value="by-team">By Team</option>
            </select>
          </div>
        </div>
      </div>

      <div id="hacker-content"></div>
    </section>
  `;

  const searchEl = container.querySelector("#hacker-search");
  const teamFilterEl = container.querySelector("#team-filter");
  const viewModeEl = container.querySelector("#view-mode");
  const contentEl = container.querySelector("#hacker-content");

  function filtered() {
    const q = searchEl.value.trim().toLowerCase();
    const team = teamFilterEl.value;
    return attendees.filter((a) => {
      const matchesSearch =
        !q ||
        (a.alias || "").toLowerCase().includes(q) ||
        (a.gitHubUsername || "").toLowerCase().includes(q);
      const matchesTeam =
        !team ||
        (team === "__unassigned__" ? !a.teamName : a.teamName === team);
      return matchesSearch && matchesTeam;
    });
  }

  function updateContent() {
    const rows = filtered();
    const mode = viewModeEl.value;
    if (mode === "by-team") {
      contentEl.innerHTML = renderByTeam(rows);
    } else {
      contentEl.innerHTML = renderTable(rows);
    }
  }

  searchEl.addEventListener("input", updateContent, { signal });
  teamFilterEl.addEventListener("change", updateContent, { signal });
  viewModeEl.addEventListener("change", updateContent, { signal });

  updateContent();
}

function renderTable(attendees) {
  if (attendees.length === 0) {
    return `<div class="card text-center" style="padding:2rem"><p class="text-secondary">No hackers match your filter.</p></div>`;
  }

  const rows = attendees
    .map(
      (a) => `
    <tr>
      <td>${escapeHtml(a.alias || "—")}</td>
      <td>
        ${
          a.gitHubUsername
            ? `<a href="https://github.com/${escapeAttr(a.gitHubUsername)}" target="_blank" rel="noopener noreferrer" class="text-link">
                ${escapeHtml(a.gitHubUsername)}
               </a>`
            : `<span class="text-secondary">—</span>`
        }
      </td>
      <td>
        ${
          a.teamName
            ? `<span class="badge badge--team">${escapeHtml(a.teamName)}</span>`
            : `<span class="text-secondary text-sm">Unassigned</span>`
        }
      </td>
      <td class="text-secondary text-sm">${formatDate(a.registeredAt)}</td>
    </tr>
  `,
    )
    .join("");

  return `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th scope="col">Alias</th>
              <th scope="col">GitHub Username</th>
              <th scope="col">Team</th>
              <th scope="col">Registered</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderByTeam(attendees) {
  if (attendees.length === 0) {
    return `<div class="card text-center" style="padding:2rem"><p class="text-secondary">No hackers match your filter.</p></div>`;
  }

  const grouped = new Map();
  const unassigned = [];

  attendees.forEach((a) => {
    if (!a.teamName) {
      unassigned.push(a);
    } else {
      if (!grouped.has(a.teamName)) grouped.set(a.teamName, []);
      grouped.get(a.teamName).push(a);
    }
  });

  const sortedTeams = [...grouped.keys()].sort();

  const cards = sortedTeams
    .map((teamName) => {
      const members = grouped.get(teamName);
      return renderTeamGroup(teamName, members);
    })
    .join("");

  const unassignedCard =
    unassigned.length > 0 ? renderTeamGroup("Unassigned", unassigned, true) : "";

  return `<div class="grid-3">${cards}${unassignedCard}</div>`;
}

function renderTeamGroup(teamName, members, isUnassigned = false) {
  const memberRows = members
    .map(
      (m) => `
    <li style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0;border-bottom:1px solid var(--color-border)">
      <span style="flex:1;font-size:0.875rem">${escapeHtml(m.alias || "Unknown")}</span>
      ${
        m.gitHubUsername
          ? `<a href="https://github.com/${escapeAttr(m.gitHubUsername)}" target="_blank" rel="noopener noreferrer" class="text-secondary text-sm" aria-label="${escapeAttr(m.alias)} on GitHub">@${escapeHtml(m.gitHubUsername)}</a>`
          : ""
      }
    </li>
  `,
    )
    .join("");

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
        <h3 style="margin:0${isUnassigned ? ";color:var(--color-text-secondary)" : ""}">${escapeHtml(teamName)}</h3>
        <span class="badge${isUnassigned ? "" : " badge--team"}">${members.length} hacker${members.length !== 1 ? "s" : ""}</span>
      </div>
      <ul style="list-style:none;padding:0;margin:0" role="list">${memberRows}</ul>
    </div>
  `;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}
