import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

export async function renderTeamAssignment(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required.</p></section>`;
    return;
  }
  await loadAndRender(container);
}

async function loadAndRender(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading teams...</div>`;
  try {
    const [teams, attendees] = await Promise.all([
      api.teams.list(),
      api.attendees.list(),
    ]);

    const attendeesByTeam = new Map();
    attendees.forEach((a) => {
      if (!attendeesByTeam.has(a.teamName)) attendeesByTeam.set(a.teamName, []);
      attendeesByTeam.get(a.teamName).push(a);
    });

    const teamNames = teams.map((t) => t.teamName);

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Team Management</h2></div>

        <div class="card" style="margin-bottom:1.5rem">
          <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end">
            <div style="flex:1;min-width:200px">
              <label for="new-team-name" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem">New Team Name</label>
              <input type="text" id="new-team-name" class="form-input" placeholder="e.g. Team07" autocomplete="off" />
            </div>
            <button id="add-team-btn" class="btn btn-primary" type="button">Add Team</button>
            <button id="reshuffle-btn" class="btn" type="button">Re-shuffle All</button>
          </div>
          <div id="action-feedback" role="alert" aria-live="polite" style="margin-top:0.75rem;min-height:1.25rem"></div>
        </div>

        <div class="grid-3">
          ${teams.map((team) => renderTeamCard(team, attendeesByTeam.get(team.teamName) || [], teamNames)).join("")}
        </div>
      </section>
    `;

    bindEvents(container);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderTeamCard(team, members, allTeamNames) {
  const otherTeams = allTeamNames.filter((n) => n !== team.teamName);
  const canDelete = members.length === 0;

  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem">
        <div>
          <h3 style="margin:0">${escapeHtml(team.teamName)}</h3>
          <p class="text-secondary" style="font-size:0.8125rem;margin:0.25rem 0 0">${members.length} member${members.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          class="btn btn-sm btn-danger"
          data-action="delete-team"
          data-team="${escapeAttr(team.teamName)}"
          type="button"
          ${canDelete ? "" : `disabled title="Move or remove all members before deleting"`}
          aria-label="Delete ${escapeAttr(team.teamName)}"
        >Delete</button>
      </div>
      ${
        members.length
          ? `<ul style="list-style:none;padding:0;margin:0.75rem 0 0" role="list">
              ${members
                .map(
                  (m) => `
                <li style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0;border-bottom:1px solid var(--color-border)">
                  <span style="flex:1;min-width:0;font-size:0.875rem;overflow:hidden">
                    <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.alias)}</span>
                    ${m.gitHubUsername ? `<span style="display:block;font-size:0.75rem;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">@${escapeHtml(m.gitHubUsername)}</span>` : ""}
                  </span>
                  <select
                    class="form-input"
                    data-action="move-member"
                    data-alias="${escapeAttr(m.alias)}"
                    aria-label="Move ${escapeAttr(m.alias)} to team"
                    style="max-width:8rem;padding:0.25rem 0.375rem;font-size:0.8125rem"
                  >
                    <option value="">Move to…</option>
                    ${otherTeams.map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("")}
                  </select>
                  <button
                    class="btn btn-sm btn-danger"
                    data-action="remove-member"
                    data-alias="${escapeAttr(m.alias)}"
                    type="button"
                    aria-label="Remove ${escapeAttr(m.alias)}"
                  >Remove</button>
                </li>`,
                )
                .join("")}
            </ul>`
          : `<p class="text-secondary" style="margin-top:0.75rem;font-size:0.875rem">No members assigned</p>`
      }
    </div>
  `;
}

function bindEvents(container) {
  const feedback = container.querySelector("#action-feedback");

  function setFeedback(msg, isError = false) {
    feedback.innerHTML = `<p style="color:var(${isError ? "--color-danger" : "--color-success"});margin:0">${msg}</p>`;
  }

  // Add team
  container
    .querySelector("#add-team-btn")
    ?.addEventListener("click", async () => {
      const input = container.querySelector("#new-team-name");
      const teamName = input.value.trim();
      if (!teamName) {
        input.focus();
        return;
      }
      try {
        await api.teams.create({ teamName });
        await loadAndRender(container);
      } catch (err) {
        setFeedback(`Failed to create team: ${escapeHtml(err.message)}`, true);
      }
    });

  // Submit new team name with Enter key
  container
    .querySelector("#new-team-name")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") container.querySelector("#add-team-btn")?.click();
    });

  // Re-shuffle all hackers across existing teams
  container
    .querySelector("#reshuffle-btn")
    ?.addEventListener("click", async () => {
      if (
        !confirm(
          "Randomly re-assign all registered hackers across existing teams. Continue?",
        )
      )
        return;
      try {
        feedback.innerHTML = `<div class="loading" style="margin:0"><div class="spinner"></div> Re-shuffling\u2026</div>`;
        await api.teams.assign();
        await loadAndRender(container);
      } catch (err) {
        setFeedback(`Re-shuffle failed: ${escapeHtml(err.message)}`, true);
      }
    });

  // Delegate clicks: delete team + remove member
  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    if (btn.dataset.action === "delete-team") {
      const teamName = btn.dataset.team;
      if (!confirm(`Delete team '${teamName}'? This cannot be undone.`)) return;
      try {
        await api.teams.delete(teamName);
        await loadAndRender(container);
      } catch (err) {
        setFeedback(
          `Failed to delete '${escapeHtml(teamName)}': ${escapeHtml(err.message)}`,
          true,
        );
      }
    }

    if (btn.dataset.action === "remove-member") {
      const alias = btn.dataset.alias;
      if (
        !confirm(
          `Remove '${alias}' from the event? They will lose their registration.`,
        )
      )
        return;
      try {
        await api.attendees.remove(alias);
        await loadAndRender(container);
      } catch (err) {
        setFeedback(
          `Failed to remove '${escapeHtml(alias)}': ${escapeHtml(err.message)}`,
          true,
        );
      }
    }
  });

  // Delegate change: move member to another team
  container.addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-action='move-member']");
    if (!sel || !sel.value) return;
    const alias = sel.dataset.alias;
    const toTeam = sel.value;
    sel.disabled = true;
    try {
      await api.attendees.move(alias, toTeam);
      await loadAndRender(container);
    } catch (err) {
      sel.disabled = false;
      sel.value = "";
      setFeedback(
        `Failed to move '${escapeHtml(alias)}': ${escapeHtml(err.message)}`,
        true,
      );
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}
