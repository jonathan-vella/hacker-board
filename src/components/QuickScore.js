import { api } from "../services/api.js";
import { getActiveRubric, getGradeClass } from "../services/rubric.js";
import { isAdmin } from "../services/auth.js";
import { showToast } from "../services/notifications.js";

export async function renderQuickScore(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required to use Quick Score.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading rubric...</div>`;

  try {
    const [rubric, teams] = await Promise.all([
      getActiveRubric(),
      api.teams.list(),
    ]);

    if (!rubric) {
      container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>No Active Rubric</h2><p class="text-secondary mt-2">Activate a rubric from <a href="#/rubrics">Rubric Management</a> first.</p></section>`;
      return;
    }

    if (!teams.length) {
      container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>No Teams</h2><p class="text-secondary mt-2">Create teams first from <a href="#/teams">Teams</a>.</p></section>`;
      return;
    }

    const teamOptions = teams
      .map(
        (t) =>
          `<option value="${escapeHtml(t.teamName)}">${escapeHtml(t.teamName)}</option>`,
      )
      .join("");

    const categoriesHtml = rubric.categories
      .map(
        (cat, ci) => `
      <fieldset class="card qs-category">
        <legend>${escapeHtml(cat.name)} <span class="text-secondary">(max ${cat.maxPoints} pts)</span></legend>
        ${cat.criteria
          .map(
            (cr, cri) => `
          <div class="qs-row">
            <label for="qs-${ci}-${cri}">${escapeHtml(cr.name)}</label>
            <input type="number" id="qs-${ci}-${cri}" min="0" max="${cr.maxPoints}" value="0"
              class="form-input" data-cat="${ci}" data-cri="${cri}" data-max="${cr.maxPoints}"
              aria-label="${escapeHtml(cr.name)} score (max ${cr.maxPoints})">
            <span class="text-secondary">/ ${cr.maxPoints}</span>
          </div>
        `,
          )
          .join("")}
        <div class="text-secondary" style="text-align:right;margin-top:0.5rem">
          Subtotal: <span id="qs-sub-${ci}">0</span> / ${cat.maxPoints}
        </div>
      </fieldset>
    `,
      )
      .join("");

    const bonusHtml =
      rubric.bonus?.length || rubric.bonusItems?.length
        ? (() => {
            const items = rubric.bonus || rubric.bonusItems;
            const total = rubric.bonusTotal || 0;
            return `
        <fieldset class="card qs-category">
          <legend>Bonus Points <span class="text-secondary">(max ${total} pts)</span></legend>
          ${items
            .map(
              (b, bi) => `
            <div class="qs-row">
              <label><input type="checkbox" id="qs-bonus-${bi}" data-points="${b.points}"> ${escapeHtml(b.name)}</label>
              <span class="text-secondary">+${b.points}</span>
            </div>
          `,
            )
            .join("")}
          <div class="text-secondary" style="text-align:right;margin-top:0.5rem">
            Bonus: <span id="qs-bonus-total">0</span> / ${total}
          </div>
        </fieldset>`;
          })()
        : "";

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Quick Score</h2></div>
        <form id="qs-form" novalidate>
          <div class="card qs-team-bar">
            <label for="qs-team"><strong>Team</strong></label>
            <select id="qs-team" class="form-input" required aria-label="Select team to score">
              <option value="">-- Select Team --</option>
              ${teamOptions}
            </select>
            <button type="button" id="qs-load" class="btn btn-secondary btn-sm">Load Scores</button>
          </div>
          ${categoriesHtml}
          ${bonusHtml}
          <div class="card qs-totals">
            <div>
              <strong>Total:</strong> <span id="qs-grand-total">0</span> / ${rubric.baseTotal}${rubric.bonusTotal ? ` (+${rubric.bonusTotal} bonus)` : ""}
            </div>
            <button type="submit" class="btn btn-primary">Save Scores</button>
          </div>
          <div id="qs-feedback" role="alert" aria-live="polite" style="margin-top:0.75rem"></div>
        </form>
      </section>
    `;

    attachQuickScoreListeners(rubric);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

function attachQuickScoreListeners(rubric) {
  const form = document.getElementById("qs-form");
  if (!form) return;

  form.addEventListener("input", () => updateQuickTotals(rubric));
  form.addEventListener("change", () => updateQuickTotals(rubric));

  // Load existing scores for the selected team
  document.getElementById("qs-load")?.addEventListener("click", async () => {
    const teamName = document.getElementById("qs-team")?.value;
    const feedback = document.getElementById("qs-feedback");
    if (!teamName) {
      feedback.innerHTML = `<p style="color:var(--danger)">Select a team first.</p>`;
      return;
    }

    try {
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Loading...</div>`;
      const scores = await api.scores.list(teamName);

      // Build lookup: "Category_Criterion" → points
      const lookup = new Map();
      for (const s of scores) {
        lookup.set(`${s.category}_${s.criterion}`, s.points);
      }

      // Fill in category scores
      rubric.categories.forEach((cat, ci) => {
        cat.criteria.forEach((cr, cri) => {
          const input = document.getElementById(`qs-${ci}-${cri}`);
          const key = `${cat.name}_${cr.name}`;
          if (input && lookup.has(key)) {
            input.value = lookup.get(key);
          }
        });
      });

      // Fill in bonus checkboxes
      const bonusItems = rubric.bonus || rubric.bonusItems || [];
      bonusItems.forEach((b, bi) => {
        const cb = document.getElementById(`qs-bonus-${bi}`);
        const key = `Bonus_${b.name}`;
        if (cb && lookup.has(key) && lookup.get(key) > 0) {
          cb.checked = true;
        }
      });

      updateQuickTotals(rubric);
      feedback.innerHTML = `<p style="color:var(--success)">Scores loaded for ${escapeHtml(teamName)}.</p>`;
    } catch (err) {
      feedback.innerHTML = `<p style="color:var(--danger)">Failed to load: ${escapeHtml(err.message)}</p>`;
    }
  });

  // Submit scores directly via POST /api/scores
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const feedback = document.getElementById("qs-feedback");
    const teamName = document.getElementById("qs-team")?.value;
    if (!teamName) {
      feedback.innerHTML = `<p style="color:var(--danger)">Select a team first.</p>`;
      return;
    }

    const scoreItems = [];
    rubric.categories.forEach((cat, ci) => {
      cat.criteria.forEach((cr, cri) => {
        const input = document.getElementById(`qs-${ci}-${cri}`);
        const points = parseInt(input?.value || "0", 10);
        scoreItems.push({
          category: cat.name,
          criterion: cr.name,
          points,
          maxPoints: cr.maxPoints,
        });
      });
    });

    const bonusPayload = [];
    const bonusItems = rubric.bonus || rubric.bonusItems || [];
    bonusItems.forEach((b, bi) => {
      const cb = document.getElementById(`qs-bonus-${bi}`);
      bonusPayload.push({
        enhancement: b.name,
        points: b.points,
        verified: cb?.checked || false,
      });
    });

    try {
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Saving...</div>`;
      const result = await api.scores.override({
        teamName,
        scores: scoreItems,
        bonus: bonusPayload,
        overrideReason: "Quick Score entry",
      });
      feedback.innerHTML = `<p style="color:var(--success)">Saved! New total: ${result.newTotal}</p>`;
      showToast(`Scores saved for ${teamName}`, "success");
    } catch (err) {
      feedback.innerHTML = `<p style="color:var(--danger)">Save failed: ${escapeHtml(err.message)}</p>`;
    }
  });
}

function updateQuickTotals(rubric) {
  let grandTotal = 0;

  rubric.categories.forEach((cat, ci) => {
    let subtotal = 0;
    cat.criteria.forEach((cr, cri) => {
      const input = document.getElementById(`qs-${ci}-${cri}`);
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
    const el = document.getElementById(`qs-sub-${ci}`);
    if (el) el.textContent = subtotal;
    grandTotal += subtotal;
  });

  let bonusTotal = 0;
  const bonusItems = rubric.bonus || rubric.bonusItems || [];
  bonusItems.forEach((b, bi) => {
    const cb = document.getElementById(`qs-bonus-${bi}`);
    if (cb?.checked) bonusTotal += b.points;
  });
  const bonusEl = document.getElementById("qs-bonus-total");
  if (bonusEl) bonusEl.textContent = bonusTotal;

  const grandEl = document.getElementById("qs-grand-total");
  if (grandEl) grandEl.textContent = grandTotal + bonusTotal;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
