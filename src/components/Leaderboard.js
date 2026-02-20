import { api } from "../services/api.js";
import { getGradeClass } from "../services/rubric.js";
import { isAdmin } from "../services/auth.js";

const TEAM_COLORS = [
  "#0969da",
  "#1a7f37",
  "#9a6700",
  "#cf222e",
  "#8250df",
  "#bf3989",
];

function getTeamInitials(name) {
  const stripped = name.replace(/^Team\s*/i, "");
  return stripped.substring(0, 2).toUpperCase();
}

export async function renderLeaderboard(container, user) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading leaderboard...</div>`;

  try {
    const [data, awards] = await Promise.all([
      api.scores.list(),
      api.awards.list(),
    ]);
    const leaderboard = data.leaderboard || [];
    const awardsMap = new Map(awards.map((a) => [a.teamName, a]));

    const rowsHtml = leaderboard
      .map((team, i) => {
        const rank = i + 1;
        const initials = getTeamInitials(team.teamName);
        const color = TEAM_COLORS[i % TEAM_COLORS.length];
        const award = awardsMap.get(team.teamName);

        return `
          <div class="lb-row${rank <= 3 ? ` lb-row--top${rank}` : ""}" role="row">
            <div class="lb-row__rank" role="cell">
              <span class="lb-rank-badge${rank <= 3 ? ` lb-rank-badge--${rank}` : ""}">${rank}</span>
            </div>
            <div class="lb-row__team" role="cell">
              <span class="lb-team-avatar" style="background:${color}">${escapeHtml(initials)}</span>
              <div class="lb-team-details">
                <span class="lb-team-name">${escapeHtml(team.teamName)}</span>
                ${award ? `<span class="lb-team-award">🏆 ${escapeHtml(award.category)}</span>` : ""}
              </div>
            </div>
            <div class="lb-row__stat" role="cell">
              <span class="lb-stat-value">${team.baseScore}</span>
              <span class="lb-stat-label">Base</span>
            </div>
            <div class="lb-row__stat" role="cell">
              <span class="lb-stat-value">${team.bonusScore}</span>
              <span class="lb-stat-label">Bonus</span>
            </div>
            <div class="lb-row__stat lb-row__stat--total" role="cell">
              <span class="lb-stat-value">${team.totalScore}</span>
              <span class="lb-stat-label">Total</span>
            </div>
            <div class="lb-row__grade" role="cell">
              <span class="badge ${getGradeClass(team.grade)}">${escapeHtml(team.grade)}</span>
              <span class="lb-grade-pct">${team.percentage}%</span>
            </div>
          </div>`;
      })
      .join("");

    const emptyState = `
      <div class="lb-empty">
        <span class="lb-empty__icon">📊</span>
        <p>No scores submitted yet</p>
        <p class="text-secondary">Scores will appear here once teams start submitting</p>
      </div>`;

    container.innerHTML = `
      <div class="lb-container">
        <div class="lb-header">
          <h2 class="lb-title">Leaderboard</h2>
          <span class="lb-updated">Last update: ${new Date(data.lastUpdated).toLocaleString()}</span>
        </div>

        <div class="lb-column-headers" aria-hidden="true">
          <div class="lb-col-rank">Rank</div>
          <div class="lb-col-team">Teams</div>
          <div class="lb-col-stat">Base</div>
          <div class="lb-col-stat">Bonus</div>
          <div class="lb-col-stat">Total</div>
          <div class="lb-col-grade">Grade</div>
        </div>

        <div class="lb-list" role="table" aria-label="Team rankings">
          ${leaderboard.length ? rowsHtml : emptyState}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load leaderboard: ${escapeHtml(err.message)}</p></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
