import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

const AWARD_CATEGORIES = [
  { id: "BestOverall", label: "🏆 Best Overall", desc: "Highest total score" },
  {
    id: "SecurityChampion",
    label: "🛡️ Security Champion",
    desc: "Best security implementation",
  },
  {
    id: "CostOptimizer",
    label: "💰 Cost Optimizer",
    desc: "Best cost efficiency",
  },
  {
    id: "BestArchitecture",
    label: "📐 Best Architecture",
    desc: "Most WAF-aligned design",
  },
  { id: "SpeedDemon", label: "🚀 Speed Demon", desc: "First team to deploy" },
];

export async function renderAwards(container, user) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading awards...</div>`;

  try {
    const [awards, teams] = await Promise.all([
      api.awards.list(),
      api.teams.list(),
    ]);
    const admin = isAdmin(user);
    const awardsMap = new Map(awards.map((a) => [a.category, a]));

    const cardsHtml = AWARD_CATEGORIES.map((cat) => {
      const award = awardsMap.get(cat.id);
      return `
        <div class="card" style="text-align:center">
          <div style="font-size:2rem;margin-bottom:0.5rem">${cat.label.split(" ")[0]}</div>
          <h3>${cat.label.split(" ").slice(1).join(" ")}</h3>
          <p class="text-secondary" style="font-size:0.8125rem;margin:0.25rem 0">${cat.desc}</p>
          ${
            award
              ? `<div class="badge badge-approved" style="margin-top:0.75rem;font-size:1rem">${escapeHtml(award.teamName)}</div>`
              : `<div class="text-secondary" style="margin-top:0.75rem">Not yet awarded</div>`
          }
          ${
            admin
              ? `<div style="margin-top:1rem">
              <select class="form-input" id="award-${cat.id}" aria-label="Assign ${cat.label.split(" ").slice(1).join(" ")} to team" style="margin-bottom:0.5rem">
                <option value="">-- Assign team --</option>
                ${teams.map((t) => `<option value="${escapeHtml(t.rowKey)}" ${award?.teamName === t.rowKey ? "selected" : ""}>${escapeHtml(t.name || t.rowKey)}</option>`).join("")}
              </select>
              <button class="btn btn-primary btn-sm award-assign" data-category="${cat.id}" type="button">Assign</button>
            </div>`
              : ""
          }
          <div class="award-feedback" role="alert" aria-live="polite" style="margin-top:0.5rem"></div>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Awards</h2></div>
        <div class="grid-3">${cardsHtml}</div>
      </section>
    `;

    if (admin) attachAwardListeners();
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load awards: ${escapeHtml(err.message)}</p></div>`;
  }
}

function attachAwardListeners() {
  document.querySelectorAll(".award-assign").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const category = btn.dataset.category;
      const select = document.getElementById(`award-${category}`);
      const teamName = select?.value;
      const feedback = btn.closest(".card").querySelector(".award-feedback");

      if (!teamName) {
        feedback.innerHTML = `<p style="color:var(--danger)">Select a team first.</p>`;
        return;
      }

      try {
        feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        await api.awards.assign({ category, teamName });
        feedback.innerHTML = `<p style="color:var(--success)">Awarded to ${escapeHtml(teamName)}!</p>`;
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
