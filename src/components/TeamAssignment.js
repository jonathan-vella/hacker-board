import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

export async function renderTeamAssignment(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required.</p></section>`;
    return;
  }

  container.innerHTML = `
    <section>
      <div class="section-header"><h2>Team Assignment</h2></div>
      <div class="card">
        <p class="text-secondary" style="margin-bottom:1rem">Randomly assign unassigned attendees to teams using a Fisher-Yates shuffle.</p>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
          <label for="team-count"><strong>Number of Teams</strong></label>
          <input type="number" id="team-count" class="form-input" min="2" max="20" value="4" style="width:5rem" aria-label="Number of teams to create">
        </div>
        <button id="assign-btn" class="btn btn-primary" type="button">Assign Teams</button>
        <div id="assign-feedback" role="alert" aria-live="polite" style="margin-top:1rem"></div>
      </div>

      <div id="assign-preview" style="margin-top:1.5rem"></div>
    </section>
  `;

  document.getElementById("assign-btn")?.addEventListener("click", async () => {
    const feedback = document.getElementById("assign-feedback");
    const preview = document.getElementById("assign-preview");
    const teamCount = parseInt(
      document.getElementById("team-count")?.value || "4",
      10,
    );

    if (teamCount < 2 || teamCount > 20) {
      feedback.innerHTML = `<p style="color:var(--danger)">Team count must be between 2 and 20.</p>`;
      return;
    }

    const confirmed = confirm(
      `This will create ${teamCount} teams and randomly assign all unassigned attendees. Continue?`,
    );
    if (!confirmed) return;

    try {
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Assigning teams...</div>`;
      const result = await api.teams.assign(teamCount);
      feedback.innerHTML = `<p style="color:var(--success)">Created ${result.teamsCreated || teamCount} teams with ${result.attendeesAssigned || "all"} attendees assigned.</p>`;

      if (result.teams) {
        preview.innerHTML = `
          <div class="grid-3">
            ${result.teams
              .map(
                (t) => `
              <div class="card">
                <h3>${escapeHtml(t.name)}</h3>
                <p class="text-secondary">${t.members?.length || 0} members</p>
                ${t.members?.length ? `<ul style="list-style:none;padding:0;margin-top:0.5rem">${t.members.map((m) => `<li style="padding:0.125rem 0">${escapeHtml(m)}</li>`).join("")}</ul>` : ""}
              </div>
            `,
              )
              .join("")}
          </div>
        `;
      }
    } catch (err) {
      feedback.innerHTML = `<p style="color:var(--danger)">Assignment failed: ${escapeHtml(err.message)}</p>`;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
