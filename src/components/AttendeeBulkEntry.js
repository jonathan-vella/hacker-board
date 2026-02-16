import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

export async function renderAttendeeBulkEntry(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading attendees...</div>`;

  try {
    const attendees = await api.attendees.list();

    container.innerHTML = `
      <section>
        <div class="section-header">
          <h2>Attendee Management</h2>
          <span class="text-secondary">${attendees.length} registered</span>
        </div>

        <div class="card" style="margin-bottom:1.5rem">
          <h3>Bulk Import</h3>
          <p class="text-secondary" style="margin-bottom:1rem">Paste names (one per line) or CSV (name, email).</p>
          <textarea id="bulk-input" class="form-input" rows="6" placeholder="Alice Smith&#10;Bob Jones, bob@example.com&#10;Carol White" aria-label="Attendee names, one per line"></textarea>
          <div style="display:flex;gap:0.75rem;margin-top:0.75rem">
            <button id="bulk-import-btn" class="btn btn-primary" type="button">Import</button>
          </div>
          <div id="bulk-feedback" role="alert" aria-live="polite" style="margin-top:0.75rem"></div>
        </div>

        <div class="card" style="padding:0;overflow:hidden">
          <table class="leaderboard-table" aria-label="Attendee list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Team</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                attendees.length
                  ? attendees
                      .map(
                        (a) => `
                  <tr>
                    <td>${escapeHtml(a.displayName || a.name || "—")}</td>
                    <td>${escapeHtml(a.rowKey || "—")}</td>
                    <td>${a.teamName ? escapeHtml(a.teamName) : '<span class="text-secondary">Unassigned</span>'}</td>
                    <td><span class="badge badge-${a.partitionKey === "unclaimed" ? "pending" : "approved"}">${a.partitionKey === "unclaimed" ? "Unclaimed" : "Claimed"}</span></td>
                  </tr>
                `,
                      )
                      .join("")
                  : '<tr><td colspan="4" class="text-center text-secondary" style="padding:2rem">No attendees yet</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>
    `;

    document
      .getElementById("bulk-import-btn")
      ?.addEventListener("click", async () => {
        const input = document.getElementById("bulk-input");
        const feedback = document.getElementById("bulk-feedback");
        const raw = input?.value?.trim();

        if (!raw) {
          feedback.innerHTML = `<p style="color:var(--danger)">Please enter at least one name.</p>`;
          return;
        }

        const entries = raw
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const parts = line.split(",").map((p) => p.trim());
            return { name: parts[0], email: parts[1] };
          });

        try {
          feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Importing ${entries.length} attendees...</div>`;
          const result = await api.attendees.bulkImport(entries);
          feedback.innerHTML = `<p style="color:var(--success)">Imported ${result.created || entries.length} attendees. ${result.duplicates ? `${result.duplicates} duplicates skipped.` : ""}</p>`;
          setTimeout(() => renderAttendeeBulkEntry(container, user), 1500);
        } catch (err) {
          feedback.innerHTML = `<p style="color:var(--danger)">Import failed: ${escapeHtml(err.message)}</p>`;
        }
      });
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load attendees: ${escapeHtml(err.message)}</p></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
