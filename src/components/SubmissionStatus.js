import { api } from "../services/api.js";
import { getUsername } from "../services/auth.js";

export async function renderSubmissionStatus(container, user) {
  if (!user) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Sign In Required</h2><p class="text-secondary mt-2">Please sign in to view submissions.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading submissions...</div>`;

  try {
    const submissions = await api.submissions.list();
    const username = getUsername(user);

    const rows = submissions
      .map(
        (s) => `
      <tr>
        <td>${escapeHtml(s.teamName || s.partitionKey)}</td>
        <td><span class="badge badge-${s.status}">${escapeHtml(s.status)}</span></td>
        <td>${escapeHtml(s.submittedBy || "—")}</td>
        <td>${new Date(s.timestamp).toLocaleString()}</td>
        <td>${s.reason ? escapeHtml(s.reason) : "—"}</td>
      </tr>
    `,
      )
      .join("");

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Submission Status</h2></div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="leaderboard-table" aria-label="Submission history">
            <thead>
              <tr>
                <th>Team</th>
                <th>Status</th>
                <th>Submitted By</th>
                <th>Date</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5" class="text-center text-secondary" style="padding:2rem">No submissions found</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load submissions: ${escapeHtml(err.message)}</p></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
