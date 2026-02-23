import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

export async function renderHackerManagement(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required.</p></section>`;
    return;
  }
  await loadAndRender(container);
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

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

    // Shared mutable state for this render cycle
    const state = {
      attendees,
      teams,
      selected: new Set(),
      filter: { search: "", team: "" },
    };

    renderShell(container, state, abort.signal);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

// ---------------------------------------------------------------------------
// Shell (filters, bulk bar, table container) — rendered once
// ---------------------------------------------------------------------------

function renderShell(container, state, signal) {
  const teamOptions = state.teams
    .map(
      (t) =>
        `<option value="${escapeAttr(t.teamName)}">${escapeHtml(t.teamName)}</option>`,
    )
    .join("");

  container.innerHTML = `
    <section>
      <div class="section-header">
        <div>
          <h2>Hacker Management</h2>
          <p class="text-secondary" id="hm-subtitle" style="margin:0.25rem 0 0"></p>
        </div>
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom:1rem">
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end">
          <div style="flex:1;min-width:200px">
            <label for="hm-search" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem">Search</label>
            <input
              type="search"
              id="hm-search"
              class="form-input"
              placeholder="Filter by alias or GitHub username…"
              aria-label="Search hackers"
              autocomplete="off"
            />
          </div>
          <div style="min-width:160px">
            <label for="hm-team-filter" style="display:block;font-size:0.875rem;font-weight:500;margin-bottom:0.375rem">Team</label>
            <select id="hm-team-filter" class="form-input" aria-label="Filter by team">
              <option value="">All teams</option>
              <option value="__unassigned__">Unassigned</option>
              ${teamOptions}
            </select>
          </div>
        </div>
      </div>

      <!-- Bulk action bar (hidden until rows are selected) -->
      <div id="hm-bulk-bar" class="hm-bulk-bar" style="display:none" role="region" aria-label="Bulk actions">
        <span id="hm-bulk-label" class="hm-bulk-label"></span>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
          <select id="hm-bulk-team" class="form-input form-input--sm" aria-label="Move selected to team">
            <option value="">Move to team…</option>
            ${teamOptions}
          </select>
          <button id="hm-bulk-move" class="btn btn-sm btn-primary" type="button" disabled>Move</button>
          <button id="hm-bulk-delete" class="btn btn-sm btn-danger" type="button">Delete selected</button>
        </div>
      </div>

      <!-- Feedback -->
      <div id="hm-feedback" class="hm-feedback" role="alert" aria-live="polite" style="min-height:1.5rem;margin-bottom:0.5rem"></div>

      <!-- Table -->
      <div id="hm-table-wrap"></div>
    </section>
  `;

  const searchEl = container.querySelector("#hm-search");
  const teamFilterEl = container.querySelector("#hm-team-filter");
  const feedbackEl = container.querySelector("#hm-feedback");

  // Kick off initial table render
  refreshTable(container, state);

  searchEl.addEventListener(
    "input",
    () => {
      state.filter.search = searchEl.value.trim().toLowerCase();
      state.selected.clear();
      refreshTable(container, state);
    },
    { signal },
  );

  teamFilterEl.addEventListener(
    "change",
    () => {
      state.filter.team = teamFilterEl.value;
      state.selected.clear();
      refreshTable(container, state);
    },
    { signal },
  );

  // Enable move button only when a destination team is chosen
  container.querySelector("#hm-bulk-team").addEventListener(
    "change",
    (e) => {
      container.querySelector("#hm-bulk-move").disabled = !e.target.value;
    },
    { signal },
  );

  container.querySelector("#hm-bulk-move").addEventListener(
    "click",
    async () => {
      const toTeam = container.querySelector("#hm-bulk-team").value;
      if (!toTeam || state.selected.size === 0) return;
      await bulkMove(container, state, [...state.selected], toTeam, feedbackEl);
    },
    { signal },
  );

  container.querySelector("#hm-bulk-delete").addEventListener(
    "click",
    async () => {
      if (state.selected.size === 0) return;
      const aliases = [...state.selected];
      const noun =
        aliases.length === 1 ? "1 hacker" : `${aliases.length} hackers`;
      if (!confirm(`Delete ${noun}? This cannot be undone.`)) return;
      await bulkDelete(container, state, aliases, feedbackEl);
    },
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Table rendering — re-runs on every state change
// ---------------------------------------------------------------------------

function filteredAttendees(state) {
  const { search, team } = state.filter;
  return state.attendees.filter((a) => {
    const matchesSearch =
      !search ||
      (a.alias || "").toLowerCase().includes(search) ||
      (a.gitHubUsername || "").toLowerCase().includes(search);
    const matchesTeam =
      !team || (team === "__unassigned__" ? !a.teamName : a.teamName === team);
    return matchesSearch && matchesTeam;
  });
}

function refreshTable(container, state) {
  const visible = filteredAttendees(state);
  const allSelected =
    visible.length > 0 && visible.every((a) => state.selected.has(a.alias));

  // Subtitle
  const subtitle = container.querySelector("#hm-subtitle");
  if (subtitle) {
    subtitle.textContent = `${state.attendees.length} hacker${state.attendees.length !== 1 ? "s" : ""} registered across ${state.teams.length} team${state.teams.length !== 1 ? "s" : ""}`;
  }

  // Bulk bar visibility
  const bulkBar = container.querySelector("#hm-bulk-bar");
  const bulkLabel = container.querySelector("#hm-bulk-label");
  if (state.selected.size > 0) {
    bulkBar.style.display = "";
    bulkLabel.textContent = `${state.selected.size} selected`;
  } else {
    bulkBar.style.display = "none";
    const bulkTeam = container.querySelector("#hm-bulk-team");
    const bulkMove = container.querySelector("#hm-bulk-move");
    if (bulkTeam) bulkTeam.value = "";
    if (bulkMove) bulkMove.disabled = true;
  }

  const wrap = container.querySelector("#hm-table-wrap");

  if (visible.length === 0) {
    wrap.innerHTML = `<div class="card text-center" style="padding:2rem"><p class="text-secondary">No hackers match your filter.</p></div>`;
    return;
  }

  const rows = visible
    .map((a) => {
      const checked = state.selected.has(a.alias) ? "checked" : "";
      const alias = escapeAttr(a.alias || "");

      return `
      <tr data-alias="${alias}">
        <td class="hm-col-check">
          <input
            type="checkbox"
            class="hm-row-check"
            data-alias="${alias}"
            ${checked}
            aria-label="Select ${escapeAttr(a.alias || "hacker")}"
          />
        </td>
        <td>${escapeHtml(a.alias || "—")}</td>
        <td>
          ${
            a.gitHubUsername
              ? `<a href="https://github.com/${escapeAttr(a.gitHubUsername)}" target="_blank" rel="noopener noreferrer" class="text-link">@${escapeHtml(a.gitHubUsername)}</a>`
              : `<span class="text-secondary">—</span>`
          }
        </td>
        <td class="text-secondary text-sm">${formatDate(a.registeredAt)}</td>
        <td class="hm-col-team">
          <select
            class="form-input form-input--sm hm-team-select"
            data-alias="${alias}"
            aria-label="Assign ${escapeAttr(a.alias || "hacker")} to team"
          >
            <option value="">Unassigned</option>
            ${state.teams.map((t) => `<option value="${escapeAttr(t.teamName)}"${t.teamName === a.teamName ? " selected" : ""}>${escapeHtml(t.teamName)}</option>`).join("")}
          </select>
        </td>
        <td class="hm-col-actions">
          <button
            class="btn btn-sm btn-danger hm-delete-btn"
            data-alias="${alias}"
            type="button"
            aria-label="Delete ${escapeAttr(a.alias || "hacker")}"
          >Delete</button>
        </td>
      </tr>
    `;
    })
    .join("");

  wrap.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto">
        <table class="data-table" style="width:100%">
          <thead>
            <tr>
              <th scope="col" class="hm-col-check">
                <input
                  type="checkbox"
                  id="hm-select-all"
                  ${allSelected ? "checked" : ""}
                  aria-label="Select all visible hackers"
                />
              </th>
              <th scope="col">Alias</th>
              <th scope="col">GitHub</th>
              <th scope="col">Registered</th>
              <th scope="col">Team</th>
              <th scope="col" class="hm-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  // Select-all header checkbox
  wrap.querySelector("#hm-select-all").addEventListener("change", (e) => {
    const vis = filteredAttendees(state);
    if (e.target.checked) {
      vis.forEach((a) => state.selected.add(a.alias));
    } else {
      vis.forEach((a) => state.selected.delete(a.alias));
    }
    refreshTable(container, state);
  });

  // Row checkboxes — update selection without full re-render to preserve focus
  wrap.querySelectorAll(".hm-row-check").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const { alias } = e.target.dataset;
      if (e.target.checked) {
        state.selected.add(alias);
      } else {
        state.selected.delete(alias);
      }
      refreshBulkBar(container, state);
      const vis = filteredAttendees(state);
      const allSel =
        vis.length > 0 && vis.every((a) => state.selected.has(a.alias));
      const selAll = wrap.querySelector("#hm-select-all");
      if (selAll) selAll.checked = allSel;
    });
  });

  // Inline team dropdowns — move on change
  wrap.querySelectorAll(".hm-team-select").forEach((sel) => {
    sel.addEventListener("change", async (e) => {
      const { alias } = e.target.dataset;
      const toTeam = e.target.value || null;
      const feedbackEl = container.querySelector("#hm-feedback");
      await moveOne(container, state, alias, toTeam, feedbackEl, e.target);
    });
  });

  // Per-row delete buttons
  wrap.querySelectorAll(".hm-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const { alias } = e.target.dataset;
      if (!confirm(`Delete hacker "${alias}"? This cannot be undone.`)) return;
      const feedbackEl = container.querySelector("#hm-feedback");
      await deleteOne(container, state, alias, feedbackEl, e.target);
    });
  });
}

// Refresh only the bulk action bar without re-rendering the table (preserves focus on checkboxes)
function refreshBulkBar(container, state) {
  const bulkBar = container.querySelector("#hm-bulk-bar");
  const bulkLabel = container.querySelector("#hm-bulk-label");
  if (!bulkBar) return;
  if (state.selected.size > 0) {
    bulkBar.style.display = "";
    bulkLabel.textContent = `${state.selected.size} selected`;
  } else {
    bulkBar.style.display = "none";
    const bulkTeam = container.querySelector("#hm-bulk-team");
    const bulkMove = container.querySelector("#hm-bulk-move");
    if (bulkTeam) bulkTeam.value = "";
    if (bulkMove) bulkMove.disabled = true;
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

async function moveOne(container, state, alias, toTeam, feedbackEl, selectEl) {
  setFeedback(feedbackEl, "");
  selectEl.disabled = true;
  try {
    await api.attendees.move(alias, toTeam);
    const a = state.attendees.find((x) => x.alias === alias);
    if (a) {
      a.teamName = toTeam || undefined;
      a.teamId = toTeam || undefined;
    }
    setFeedback(
      feedbackEl,
      `Moved ${alias} → ${toTeam || "Unassigned"}`,
      "success",
    );
  } catch (err) {
    setFeedback(feedbackEl, `Failed to move ${alias}: ${err.message}`, "error");
    // Revert dropdown to previous value
    const prev = state.attendees.find((x) => x.alias === alias)?.teamName || "";
    selectEl.value = prev;
  } finally {
    selectEl.disabled = false;
  }
}

async function deleteOne(container, state, alias, feedbackEl, btn) {
  setFeedback(feedbackEl, "");
  btn.disabled = true;
  try {
    await api.attendees.remove(alias);
    state.attendees = state.attendees.filter((a) => a.alias !== alias);
    state.selected.delete(alias);
    setFeedback(feedbackEl, `Deleted ${alias}`, "success");
    refreshTable(container, state);
  } catch (err) {
    setFeedback(
      feedbackEl,
      `Failed to delete ${alias}: ${err.message}`,
      "error",
    );
    btn.disabled = false;
  }
}

async function bulkMove(container, state, aliases, toTeam, feedbackEl) {
  setFeedback(feedbackEl, "");
  disableBulkBar(container, true);
  const errors = [];

  for (const alias of aliases) {
    try {
      await api.attendees.move(alias, toTeam);
      const a = state.attendees.find((x) => x.alias === alias);
      if (a) {
        a.teamName = toTeam;
        a.teamId = toTeam;
      }
    } catch {
      errors.push(alias);
    }
  }

  state.selected.clear();
  disableBulkBar(container, false);

  if (errors.length === 0) {
    setFeedback(
      feedbackEl,
      `Moved ${aliases.length} hacker${aliases.length !== 1 ? "s" : ""} to ${toTeam}`,
      "success",
    );
  } else {
    setFeedback(
      feedbackEl,
      `Moved ${aliases.length - errors.length} of ${aliases.length}. Failed: ${errors.join(", ")}`,
      "error",
    );
  }
  refreshTable(container, state);
}

async function bulkDelete(container, state, aliases, feedbackEl) {
  setFeedback(feedbackEl, "");
  disableBulkBar(container, true);
  const errors = [];

  for (const alias of aliases) {
    try {
      await api.attendees.remove(alias);
      state.attendees = state.attendees.filter((a) => a.alias !== alias);
    } catch {
      errors.push(alias);
    }
  }

  state.selected.clear();
  disableBulkBar(container, false);

  if (errors.length === 0) {
    setFeedback(
      feedbackEl,
      `Deleted ${aliases.length} hacker${aliases.length !== 1 ? "s" : ""}`,
      "success",
    );
  } else {
    setFeedback(
      feedbackEl,
      `Deleted ${aliases.length - errors.length} of ${aliases.length}. Failed: ${errors.join(", ")}`,
      "error",
    );
  }
  refreshTable(container, state);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function disableBulkBar(container, disabled) {
  ["#hm-bulk-move", "#hm-bulk-delete", "#hm-bulk-team"].forEach((sel) => {
    const el = container.querySelector(sel);
    if (el) el.disabled = disabled;
  });
}

function setFeedback(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.className = "hm-feedback";
  if (type === "success") el.classList.add("hm-feedback--success");
  if (type === "error") el.classList.add("hm-feedback--error");
  if (message && type === "success") {
    setTimeout(() => {
      if (el.textContent === message) el.textContent = "";
    }, 4000);
  }
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
