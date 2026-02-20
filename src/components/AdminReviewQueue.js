import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";
import { showToast } from "../services/notifications.js";

export async function renderAdminReviewQueue(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading review queue...</div>`;

  try {
    const submissions = await api.submissions.list("pending");

    if (!submissions.length) {
      container.innerHTML = `
        <section>
          <div class="section-header"><h2>Review Queue</h2></div>
          <div class="card text-center" style="padding:3rem">
            <p class="text-secondary">No pending submissions to review.</p>
          </div>
        </section>
      `;
      return;
    }

    const cardsHtml = submissions
      .map(
        (s) => `
      <div class="card" data-submission-id="${escapeHtml(s.rowKey)}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <div>
            <strong>${escapeHtml(s.teamName || s.partitionKey)}</strong>
            <span class="badge badge-pending" style="margin-left:0.5rem">Pending</span>
          </div>
          <span class="text-secondary" style="font-size:0.8125rem">${new Date(s.timestamp).toLocaleString()}</span>
        </div>
        <details>
          <summary style="cursor:pointer;color:var(--accent)">View payload</summary>
          <pre style="max-height:200px;overflow:auto;font-size:0.75rem;background:var(--surface);padding:0.75rem;border-radius:var(--radius-sm);margin-top:0.5rem">${escapeHtml(JSON.stringify(s.payload || s, undefined, 2))}</pre>
        </details>
        <div style="display:flex;gap:0.75rem;margin-top:1rem;align-items:center">
          <button class="btn btn-primary btn-sm action-approve" data-team="${escapeHtml(s.teamName || s.partitionKey)}" data-id="${escapeHtml(s.rowKey)}" type="button">Approve</button>
          <button class="btn btn-danger btn-sm action-reject" data-team="${escapeHtml(s.teamName || s.partitionKey)}" data-id="${escapeHtml(s.rowKey)}" type="button">Reject</button>
          <input type="text" class="form-input reject-reason" placeholder="Rejection reason (required)" style="flex:1;display:none" aria-label="Rejection reason">
        </div>
        <div class="action-feedback" role="alert" aria-live="polite" style="margin-top:0.5rem"></div>
      </div>
    `,
      )
      .join("");

    container.innerHTML = `
      <section>
        <div class="section-header">
          <h2>Review Queue</h2>
          <span class="badge badge-pending">${submissions.length} pending</span>
        </div>
        ${cardsHtml}
      </section>
    `;

    attachReviewListeners();
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load queue: ${escapeHtml(err.message)}</p></div>`;
  }
}

function attachReviewListeners() {
  document.querySelectorAll(".action-approve").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest("[data-submission-id]");
      const feedback = card.querySelector(".action-feedback");
      try {
        feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        await api.submissions.validate({
          teamName: btn.dataset.team,
          submissionId: btn.dataset.id,
          action: "approve",
        });
        card.style.opacity = "0.5";
        feedback.innerHTML = `<p style="color:var(--success)">Approved — scores written to leaderboard.</p>`;
        showToast(`Submission for ${btn.dataset.team} approved`, "success");
        btn.disabled = true;
        card.querySelector(".action-reject").disabled = true;
      } catch (err) {
        feedback.innerHTML = `<p style="color:var(--danger)">Error: ${escapeHtml(err.message)}</p>`;
      }
    });
  });

  document.querySelectorAll(".action-reject").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest("[data-submission-id]");
      const reasonInput = card.querySelector(".reject-reason");
      const feedback = card.querySelector(".action-feedback");

      if (reasonInput.style.display === "none") {
        reasonInput.style.display = "block";
        reasonInput.focus();
        return;
      }

      const reason = reasonInput.value.trim();
      if (!reason) {
        feedback.innerHTML = `<p style="color:var(--danger)">Please provide a rejection reason.</p>`;
        return;
      }

      try {
        feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        await api.submissions.validate({
          teamName: btn.dataset.team,
          submissionId: btn.dataset.id,
          action: "reject",
          reason,
        });
        card.style.opacity = "0.5";
        feedback.innerHTML = `<p style="color:var(--warning)">Rejected.</p>`;
        showToast(`Submission for ${btn.dataset.team} rejected`, "info");
        btn.disabled = true;
        card.querySelector(".action-approve").disabled = true;
      } catch (err) {
        feedback.innerHTML = `<p style="color:var(--danger)">Error: ${escapeHtml(err.message)}</p>`;
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
