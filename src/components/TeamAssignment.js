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
  // Abort previous event listeners to prevent accumulation across re-renders.
  // container element persists in the DOM; only its innerHTML changes each time.
  if (container._teamAbort) container._teamAbort.abort();
  const abort = new AbortController();
  container._teamAbort = abort;

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

    bindEvents(container, abort.signal);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

function renderTeamCard(team, members, allTeamNames) {
  const otherTeams = allTeamNames.filter((n) => n !== team.teamName);
  const canDelete = members.length === 0;
  const teamId = escapeAttr(team.teamName);

  return `
    <div class="card" data-team-card="${teamId}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem">
        <div>
          <h3 style="margin:0">${escapeHtml(team.teamName)}</h3>
          <p class="text-secondary" style="font-size:0.8125rem;margin:0.25rem 0 0">${members.length} member${members.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          class="btn btn-sm btn-danger"
          data-action="delete-team"
          data-team="${teamId}"
          type="button"
          ${canDelete ? "" : `disabled title="Move or remove all members before deleting"`}
          aria-label="Delete ${teamId}"
        >Delete</button>
      </div>
      ${
        members.length
          ? `
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0;border-bottom:2px solid var(--color-border);margin-bottom:0.25rem">
            <input
              type="checkbox"
              data-action="select-all"
              data-team="${teamId}"
              id="sel-all-${teamId}"
              style="cursor:pointer"
              aria-label="Select all members of ${escapeAttr(team.teamName)}"
            />
            <label for="sel-all-${teamId}" style="font-size:0.8125rem;font-weight:500;cursor:pointer;margin:0;user-select:none">Select all</label>
          </div>
          <ul style="list-style:none;padding:0;margin:0" role="list">
            ${members
              .map(
                (m) => `
              <li style="display:flex;align-items:center;gap:0.5rem;padding:0.375rem 0;border-bottom:1px solid var(--color-border)">
                <input
                  type="checkbox"
                  class="member-checkbox"
                  data-team="${teamId}"
                  data-alias="${escapeAttr(m.alias)}"
                  style="cursor:pointer;flex-shrink:0"
                  aria-label="Select ${escapeAttr(m.alias)}"
                />
                <span style="flex:1;min-width:0;font-size:0.875rem;overflow:hidden">
                  <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(m.alias)}</span>
                  ${m.gitHubUsername ? `<span style="display:block;font-size:0.75rem;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">@${escapeHtml(m.gitHubUsername)}</span>` : ""}
                </span>
                <select
                  class="form-input"
                  data-action="move-member"
                  data-alias="${escapeAttr(m.alias)}"
                  aria-label="Move ${escapeAttr(m.alias)} to team"
                  style="max-width:7rem;padding:0.25rem 0.375rem;font-size:0.8125rem"
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
          </ul>
          <div
            class="bulk-actions"
            data-team="${teamId}"
            style="display:none;margin-top:0.75rem;padding-top:0.75rem;border-top:2px solid var(--color-border);gap:0.5rem;flex-wrap:wrap;align-items:center"
          >
            <span class="bulk-count" style="font-size:0.8125rem;font-weight:500;color:var(--color-text-muted)">0 selected</span>
            <select class="form-input bulk-move-target" data-team="${teamId}" style="padding:0.25rem 0.5rem;font-size:0.8125rem">
              <option value="">Move to…</option>
              ${otherTeams.map((t) => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join("")}
            </select>
            <button class="btn btn-sm btn-primary" data-action="bulk-move" data-team="${teamId}" type="button">Apply</button>
            <button class="btn btn-sm btn-danger" data-action="bulk-remove" data-team="${teamId}" type="button">Remove selected</button>
          </div>`
          : `<p class="text-secondary" style="margin-top:0.75rem;font-size:0.875rem">No members assigned</p>`
      }
    </div>
  `;
}

/**
 * Returns aliases of all checked member checkboxes within a team card.
 * @param {Element} card
 * @returns {string[]}
 */
function getSelectedAliases(card) {
  return [...card.querySelectorAll(".member-checkbox:checked")].map(
    (cb) => cb.dataset.alias,
  );
}

/**
 * Shows or hides the bulk action toolbar based on selection count.
 * @param {Element} card
 * @param {string} teamId
 */
function updateBulkBar(card, teamId) {
  const selected = getSelectedAliases(card);
  const bar = card.querySelector(`.bulk-actions[data-team="${teamId}"]`);
  if (!bar) return;
  if (selected.length > 0) {
    bar.style.display = "flex";
    bar.querySelector(".bulk-count").textContent =
      `${selected.length} selected`;
  } else {
    bar.style.display = "none";
  }
}

function bindEvents(container, signal) {
  const opts = { signal };
  const feedback = container.querySelector("#action-feedback");

  function setFeedback(msg, isError = false) {
    feedback.innerHTML = `<p style="color:var(${isError ? "--color-danger" : "--color-success"});margin:0">${msg}</p>`;
  }

  // Add team
  container.querySelector("#add-team-btn")?.addEventListener(
    "click",
    async () => {
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
    },
    opts,
  );

  // Submit new team name with Enter key
  container.querySelector("#new-team-name")?.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Enter") container.querySelector("#add-team-btn")?.click();
    },
    opts,
  );

  // Re-shuffle all hackers across existing teams
  container.querySelector("#reshuffle-btn")?.addEventListener(
    "click",
    async () => {
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
    },
    opts,
  );

  // Checkboxes: select-all toggle + per-member checkbox → update bulk bar
  container.addEventListener(
    "change",
    async (e) => {
      const selectAll = e.target.closest("[data-action='select-all']");
      if (selectAll) {
        const teamId = selectAll.dataset.team;
        const card = container.querySelector(`[data-team-card="${teamId}"]`);
        card.querySelectorAll(".member-checkbox").forEach((cb) => {
          cb.checked = selectAll.checked;
        });
        updateBulkBar(card, teamId);
        return;
      }

      const memberBox = e.target.closest(".member-checkbox");
      if (memberBox) {
        const teamId = memberBox.dataset.team;
        const card = container.querySelector(`[data-team-card="${teamId}"]`);
        const boxes = card.querySelectorAll(".member-checkbox");
        const selAll = card.querySelector("[data-action='select-all']");
        if (selAll) selAll.checked = [...boxes].every((cb) => cb.checked);
        updateBulkBar(card, teamId);
        return;
      }

      // Single move-member via dropdown
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
    },
    opts,
  );

  // Delegate clicks: delete team, remove member, bulk move, bulk remove
  container.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      if (btn.dataset.action === "delete-team") {
        const teamName = btn.dataset.team;
        if (!confirm(`Delete team '${teamName}'? This cannot be undone.`))
          return;
        btn.disabled = true;
        try {
          await api.teams.delete(teamName);
          await loadAndRender(container);
        } catch (err) {
          btn.disabled = false;
          setFeedback(
            `Failed to delete '${escapeHtml(teamName)}': ${escapeHtml(err.message)}`,
            true,
          );
        }
        return;
      }

      if (btn.dataset.action === "remove-member") {
        const alias = btn.dataset.alias;
        if (
          !confirm(
            `Remove '${alias}' from the event? They will lose their registration.`,
          )
        )
          return;
        btn.disabled = true;
        try {
          await api.attendees.remove(alias);
          await loadAndRender(container);
        } catch (err) {
          btn.disabled = false;
          setFeedback(
            `Failed to remove '${escapeHtml(alias)}': ${escapeHtml(err.message)}`,
            true,
          );
        }
        return;
      }

      if (btn.dataset.action === "bulk-move") {
        const teamId = btn.dataset.team;
        const card = container.querySelector(`[data-team-card="${teamId}"]`);
        const toTeam = card.querySelector(".bulk-move-target")?.value;
        if (!toTeam) {
          setFeedback("Select a target team before applying.", true);
          return;
        }
        const selected = getSelectedAliases(card);
        if (!selected.length) return;
        btn.disabled = true;
        try {
          await Promise.all(
            selected.map((alias) => api.attendees.move(alias, toTeam)),
          );
          await loadAndRender(container);
        } catch (err) {
          btn.disabled = false;
          setFeedback(`Bulk move failed: ${escapeHtml(err.message)}`, true);
        }
        return;
      }

      if (btn.dataset.action === "bulk-remove") {
        const teamId = btn.dataset.team;
        const card = container.querySelector(`[data-team-card="${teamId}"]`);
        const selected = getSelectedAliases(card);
        if (!selected.length) return;
        if (
          !confirm(
            `Remove ${selected.length} attendee${selected.length !== 1 ? "s" : ""} from the event? This cannot be undone.`,
          )
        )
          return;
        btn.disabled = true;
        try {
          await Promise.all(
            selected.map((alias) => api.attendees.remove(alias)),
          );
          await loadAndRender(container);
        } catch (err) {
          btn.disabled = false;
          setFeedback(`Bulk remove failed: ${escapeHtml(err.message)}`, true);
        }
        return;
      }
    },
    opts,
  );
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str ?? "").replace(/"/g, "&quot;");
}
