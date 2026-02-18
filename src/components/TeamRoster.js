import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

export async function renderTeamRoster(container, user) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading teams...</div>`;

  try {
    const [teams, attendees] = await Promise.all([
      api.teams.list(),
      isAdmin(user) ? api.attendees.list() : Promise.resolve([]),
    ]);

    const attendeesByTeam = new Map();
    attendees.forEach((a) => {
      if (a.teamName) {
        if (!attendeesByTeam.has(a.teamName))
          attendeesByTeam.set(a.teamName, []);
        attendeesByTeam.get(a.teamName).push(a);
      }
    });

    const cardsHtml = teams
      .map((team) => {
        const members =
          attendeesByTeam.get(team.rowKey) ||
          attendeesByTeam.get(team.name) ||
          [];
        return `
        <div class="card">
          <h3>${escapeHtml(team.name || team.rowKey)}</h3>
          <p class="text-secondary" style="font-size:0.8125rem;margin:0.25rem 0">${members.length} member${members.length !== 1 ? "s" : ""}</p>
          ${
            members.length
              ? `<ul style="list-style:none;padding:0;margin-top:0.75rem">${members.map((m) => `<li style="padding:0.25rem 0;border-bottom:1px solid var(--border)">${escapeHtml(m.alias || m.rowKey)}</li>`).join("")}</ul>`
              : `<p class="text-secondary" style="margin-top:0.75rem">No members assigned</p>`
          }
        </div>
      `;
      })
      .join("");

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Team Roster</h2></div>
        ${teams.length ? `<div class="grid-3">${cardsHtml}</div>` : '<div class="card text-center" style="padding:3rem"><p class="text-secondary">No teams created yet.</p></div>'}
      </section>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load teams: ${escapeHtml(err.message)}</p></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
