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
        <p class="text-secondary" style="margin-bottom:1rem">Teams are auto-created (Team01–Team06) and hackers are auto-assigned on join. Use the button below to randomly re-shuffle all registered hackers across existing teams.</p>
        <button id="assign-btn" class="btn btn-primary" type="button">Re-shuffle Teams</button>
        <div id="assign-feedback" role="alert" aria-live="polite" style="margin-top:1rem"></div>
      </div>

      <div id="assign-preview" style="margin-top:1.5rem"></div>
    </section>
  `;

  document.getElementById("assign-btn")?.addEventListener("click", async () => {
    const feedback = document.getElementById("assign-feedback");
    const preview = document.getElementById("assign-preview");

    const confirmed = confirm(
      "This will randomly re-assign all registered hackers across the existing teams. Continue?",
    );
    if (!confirmed) return;

    try {
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Re-shuffling teams...</div>`;
      const result = await api.teams.assign();
      feedback.innerHTML = `<p style="color:var(--success)">${result.teamCount} teams re-shuffled with ${result.totalHackers} hackers.</p>`;

      if (result.teams) {
        preview.innerHTML = `
          <div class="grid-3">
            ${result.teams
              .map(
                (t) => `
              <div class="card">
                <h3>${escapeHtml(t.teamName)}</h3>
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
      feedback.innerHTML = `<p style="color:var(--danger)">Re-shuffle failed: ${escapeHtml(err.message)}</p>`;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
