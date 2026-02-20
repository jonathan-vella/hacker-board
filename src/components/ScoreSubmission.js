import { api } from "../services/api.js";
import { getActiveRubric, getGradeClass } from "../services/rubric.js";
import { isAdmin } from "../services/auth.js";
import { showToast } from "../services/notifications.js";

export async function renderScoreSubmission(container, user) {
  if (!user) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Sign In Required</h2><p class="text-secondary mt-2">Please sign in to submit scores.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading rubric...</div>`;

  try {
    const [rubric, teams] = await Promise.all([
      getActiveRubric(),
      api.teams.list(),
    ]);

    if (!rubric) {
      container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>No Active Rubric</h2><p class="text-secondary mt-2">An admin needs to activate a scoring rubric first.</p></section>`;
      return;
    }

    const teamOptions = teams
      .map(
        (t) =>
          `<option value="${escapeHtml(t.teamName)}">${escapeHtml(t.teamName)}</option>`,
      )
      .join("");

    const bonusItems = rubric.bonus || rubric.bonusItems || [];

    const categoriesHtml = rubric.categories
      .map(
        (cat, ci) => `
      <fieldset class="card ss-category">
        <legend>${escapeHtml(cat.name)} <span class="text-secondary">(max ${cat.maxPoints} pts)</span></legend>
        ${cat.criteria
          .map(
            (cr, cri) => `
          <div class="ss-row">
            <label for="score-${ci}-${cri}">${escapeHtml(cr.name)}</label>
            <input type="number" id="score-${ci}-${cri}" name="score-${ci}-${cri}" min="0" max="${cr.maxPoints}" value="0"
              class="form-input" data-category="${ci}" data-max="${cr.maxPoints}" aria-label="${escapeHtml(cr.name)} score (max ${cr.maxPoints})">
            <span class="text-secondary ss-max">/ ${cr.maxPoints}</span>
          </div>
        `,
          )
          .join("")}
        <div class="ss-subtotal-row">
          <span class="text-secondary">Subtotal: <strong id="subtotal-${ci}">0</strong> / ${cat.maxPoints}</span>
          <button type="button" class="btn btn-primary btn-sm challenge-submit" data-cat="${ci}">Submit Challenge</button>
        </div>
        <div class="challenge-feedback" data-cat="${ci}" role="alert" aria-live="polite"></div>
      </fieldset>
    `,
      )
      .join("");

    const bonusHtml = bonusItems.length
      ? `<fieldset class="card ss-category">
          <legend>Bonus Points <span class="text-secondary">(max ${rubric.bonusTotal} pts)</span></legend>
          ${bonusItems
            .map(
              (b, bi) => `
            <div class="ss-row">
              <label><input type="checkbox" id="bonus-${bi}" data-points="${b.points}"> ${escapeHtml(b.name)}</label>
              <span class="text-secondary ss-max">+${b.points}</span>
            </div>
          `,
            )
            .join("")}
          <div class="ss-subtotal-row">
            <span class="text-secondary">Bonus: <strong id="bonus-total">0</strong> / ${rubric.bonusTotal}</span>
            <button type="button" class="btn btn-primary btn-sm" id="bonus-submit">Submit Bonus</button>
          </div>
          <div id="bonus-feedback" role="alert" aria-live="polite"></div>
        </fieldset>`
      : "";

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Submit Score</h2></div>
        <form id="score-form" novalidate>
          <div class="card ss-team-bar">
            <label for="team-select"><strong>Team</strong></label>
            <select id="team-select" class="form-input" required aria-label="Select team">
              <option value="">-- Select Team --</option>
              ${teamOptions}
            </select>
          </div>
          ${categoriesHtml}
          ${bonusHtml}
          <div class="card ss-totals">
            <div><strong>Grand Total:</strong> <span id="grand-total" class="ss-grand-total-value">0</span> / ${rubric.baseTotal}${rubric.bonusTotal ? ` (+${rubric.bonusTotal} bonus)` : ""}</div>
            <button type="submit" class="btn btn-primary">Submit All Scores</button>
          </div>
          <div id="submit-feedback" role="alert" aria-live="polite"></div>
        </form>
      </section>
    `;

    attachScoreListeners(rubric, bonusItems);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

function attachScoreListeners(rubric, bonusItems) {
  const form = document.getElementById("score-form");
  if (!form) return;

  form.addEventListener("input", () => updateTotals(rubric, bonusItems));
  form.addEventListener("change", () => updateTotals(rubric, bonusItems));

  // Per-challenge submit buttons
  document.querySelectorAll(".challenge-submit").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const ci = parseInt(btn.dataset.cat, 10);
      const cat = rubric.categories[ci];
      const teamName = document.getElementById("team-select")?.value;
      const feedback = document.querySelector(
        `.challenge-feedback[data-cat="${ci}"]`,
      );

      if (!teamName) {
        feedback.innerHTML = `<p style="color:var(--danger)">Select a team first.</p>`;
        return;
      }

      const scoreItems = cat.criteria.map((cr, cri) => {
        const input = document.getElementById(`score-${ci}-${cri}`);
        return {
          category: cat.name,
          criterion: cr.name,
          points: parseInt(input?.value || "0", 10),
          maxPoints: cr.maxPoints,
        };
      });

      try {
        btn.disabled = true;
        feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        await api.scores.override({
          teamName,
          scores: scoreItems,
          overrideReason: `Challenge submit: ${cat.name}`,
        });
        feedback.innerHTML = `<p style="color:var(--success)">Saved ${escapeHtml(cat.name)}!</p>`;
        showToast(`${cat.name} saved for ${teamName}`, "success");
      } catch (err) {
        feedback.innerHTML = `<p style="color:var(--danger)">Failed: ${escapeHtml(err.message)}</p>`;
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Bonus submit button
  document
    .getElementById("bonus-submit")
    ?.addEventListener("click", async () => {
      const teamName = document.getElementById("team-select")?.value;
      const feedback = document.getElementById("bonus-feedback");

      if (!teamName) {
        feedback.innerHTML = `<p style="color:var(--danger)">Select a team first.</p>`;
        return;
      }

      const bonusPayload = bonusItems.map((b, bi) => {
        const cb = document.getElementById(`bonus-${bi}`);
        return {
          enhancement: b.name,
          points: b.points,
          verified: cb?.checked || false,
        };
      });

      try {
        feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        await api.scores.override({
          teamName,
          bonus: bonusPayload,
          overrideReason: "Bonus submit",
        });
        feedback.innerHTML = `<p style="color:var(--success)">Bonus saved!</p>`;
        showToast(`Bonus saved for ${teamName}`, "success");
      } catch (err) {
        feedback.innerHTML = `<p style="color:var(--danger)">Failed: ${escapeHtml(err.message)}</p>`;
      }
    });

  // Submit All (whole form)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const feedback = document.getElementById("submit-feedback");
    const teamName = document.getElementById("team-select")?.value;
    if (!teamName) {
      feedback.innerHTML = `<p style="color:var(--danger)">Please select a team.</p>`;
      return;
    }

    const scoreItems = [];
    rubric.categories.forEach((cat, ci) => {
      cat.criteria.forEach((cr, cri) => {
        const input = document.getElementById(`score-${ci}-${cri}`);
        scoreItems.push({
          category: cat.name,
          criterion: cr.name,
          points: parseInt(input?.value || "0", 10),
          maxPoints: cr.maxPoints,
        });
      });
    });

    const bonusPayload = bonusItems.map((b, bi) => {
      const cb = document.getElementById(`bonus-${bi}`);
      return {
        enhancement: b.name,
        points: b.points,
        verified: cb?.checked || false,
      };
    });

    try {
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Submitting...</div>`;
      await api.scores.override({
        teamName,
        scores: scoreItems,
        bonus: bonusPayload,
        overrideReason: "Full score submit",
      });
      feedback.innerHTML = `<p style="color:var(--success)">All scores saved!</p>`;
      showToast(`All scores saved for ${teamName}`, "success");
    } catch (err) {
      feedback.innerHTML = `<p style="color:var(--danger)">Submission failed: ${escapeHtml(err.message)}</p>`;
    }
  });
}

function updateTotals(rubric, bonusItems) {
  let grandTotal = 0;

  rubric.categories.forEach((cat, ci) => {
    let subtotal = 0;
    cat.criteria.forEach((cr, cri) => {
      const input = document.getElementById(`score-${ci}-${cri}`);
      if (input) {
        let val = parseInt(input.value || "0", 10);
        if (val > cr.maxPoints) {
          val = cr.maxPoints;
          input.value = val;
        }
        if (val < 0) {
          val = 0;
          input.value = val;
        }
        subtotal += val;
      }
    });
    const el = document.getElementById(`subtotal-${ci}`);
    if (el) el.textContent = subtotal;
    grandTotal += subtotal;
  });

  let bonusTotal = 0;
  bonusItems.forEach((b, bi) => {
    const cb = document.getElementById(`bonus-${bi}`);
    if (cb?.checked) bonusTotal += b.points;
  });
  const bonusEl = document.getElementById("bonus-total");
  if (bonusEl) bonusEl.textContent = bonusTotal;

  const grandEl = document.getElementById("grand-total");
  if (grandEl) grandEl.textContent = grandTotal + bonusTotal;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
