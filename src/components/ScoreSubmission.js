import { api } from "../services/api.js";
import { getActiveRubric, getGradeClass } from "../services/rubric.js";
import { isAdmin, getUsername } from "../services/auth.js";

export async function renderScoreSubmission(container, user) {
  if (!user) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Sign In Required</h2><p class="text-secondary mt-2">Please sign in to submit scores.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading rubric...</div>`;

  try {
    const rubric = await getActiveRubric();
    if (!rubric) {
      container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>No Active Rubric</h2><p class="text-secondary mt-2">An admin needs to activate a scoring rubric first.</p></section>`;
      return;
    }

    const categoriesHtml = rubric.categories
      .map(
        (cat, ci) => `
      <fieldset class="card" style="margin-bottom:1rem">
        <legend><strong>${escapeHtml(cat.name)}</strong> <span class="text-secondary">(max ${cat.maxPoints} pts)</span></legend>
        ${cat.criteria
          .map(
            (cr, cri) => `
          <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
            <label for="score-${ci}-${cri}" style="flex:1">${escapeHtml(cr.name)}</label>
            <input type="number" id="score-${ci}-${cri}" name="score-${ci}-${cri}" min="0" max="${cr.points}" value="0"
              class="form-input" style="width:5rem;text-align:center" data-category="${ci}" data-max="${cr.points}" aria-label="${escapeHtml(cr.name)} score (max ${cr.points})">
            <span class="text-secondary">/ ${cr.points}</span>
          </div>
        `,
          )
          .join("")}
        <div class="text-secondary" style="text-align:right;margin-top:0.5rem">
          Subtotal: <span id="subtotal-${ci}">0</span> / ${cat.maxPoints}
        </div>
      </fieldset>
    `,
      )
      .join("");

    const bonusHtml = rubric.bonusItems?.length
      ? `<fieldset class="card" style="margin-bottom:1rem">
          <legend><strong>Bonus Points</strong> <span class="text-secondary">(max ${rubric.bonusTotal} pts)</span></legend>
          ${rubric.bonusItems
            .map(
              (b, bi) => `
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem">
              <label style="flex:1">
                <input type="checkbox" id="bonus-${bi}" data-points="${b.points}"> ${escapeHtml(b.name)}
              </label>
              <span class="text-secondary">+${b.points}</span>
            </div>
          `,
            )
            .join("")}
          <div class="text-secondary" style="text-align:right;margin-top:0.5rem">
            Bonus: <span id="bonus-total">0</span> / ${rubric.bonusTotal}
          </div>
        </fieldset>`
      : "";

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Submit Score</h2></div>
        <form id="score-form" novalidate>
          <div class="card" style="margin-bottom:1rem">
            <label for="team-select"><strong>Team</strong></label>
            <select id="team-select" class="form-input" required aria-label="Select team">
              <option value="">Loading teams...</option>
            </select>
          </div>
          ${categoriesHtml}
          ${bonusHtml}
          <div class="card" style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
            <div><strong>Total:</strong> <span id="grand-total">0</span> / ${rubric.baseTotal}${rubric.bonusTotal ? ` (+${rubric.bonusTotal} bonus)` : ""}</div>
            <button type="submit" class="btn btn-primary">Submit Score</button>
          </div>
          <div id="submit-feedback" role="alert" aria-live="polite"></div>
        </form>
      </section>
    `;

    loadTeams();
    attachScoreListeners(rubric);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function loadTeams() {
  try {
    const teams = await api.teams.list();
    const select = document.getElementById("team-select");
    if (!select) return;
    select.innerHTML =
      `<option value="">-- Select Team --</option>` +
      teams
        .map(
          (t) =>
            `<option value="${escapeHtml(t.rowKey)}">${escapeHtml(t.name)}</option>`,
        )
        .join("");
  } catch {
    const select = document.getElementById("team-select");
    if (select)
      select.innerHTML = `<option value="">Failed to load teams</option>`;
  }
}

function attachScoreListeners(rubric) {
  const form = document.getElementById("score-form");
  if (!form) return;

  form.addEventListener("input", () => updateTotals(rubric));
  form.addEventListener("change", () => updateTotals(rubric));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const feedback = document.getElementById("submit-feedback");
    const teamName = document.getElementById("team-select")?.value;
    if (!teamName) {
      feedback.innerHTML = `<p class="text-secondary" style="color:var(--danger)">Please select a team.</p>`;
      return;
    }

    const scores = {};
    rubric.categories.forEach((cat, ci) => {
      scores[cat.name] = {};
      cat.criteria.forEach((cr, cri) => {
        const input = document.getElementById(`score-${ci}-${cri}`);
        scores[cat.name][cr.name] = parseInt(input?.value || "0", 10);
      });
    });

    const bonusItems = [];
    rubric.bonusItems?.forEach((b, bi) => {
      const cb = document.getElementById(`bonus-${bi}`);
      if (cb?.checked) bonusItems.push(b.name);
    });

    try {
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Submitting...</div>`;
      await api.upload({ teamName, scores, bonusItems });
      feedback.innerHTML = `<p style="color:var(--success)">Score submitted for review.</p>`;
      form.reset();
      updateTotals(rubric);
    } catch (err) {
      feedback.innerHTML = `<p style="color:var(--danger)">Submission failed: ${escapeHtml(err.message)}</p>`;
    }
  });
}

function updateTotals(rubric) {
  let grandTotal = 0;

  rubric.categories.forEach((cat, ci) => {
    let subtotal = 0;
    cat.criteria.forEach((cr, cri) => {
      const input = document.getElementById(`score-${ci}-${cri}`);
      if (input) {
        let val = parseInt(input.value || "0", 10);
        if (val > cr.points) {
          val = cr.points;
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
  rubric.bonusItems?.forEach((b, bi) => {
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
