import { api } from "../services/api.js";
import { getGradeClass } from "../services/rubric.js";
import { isAdmin } from "../services/auth.js";

export async function renderLeaderboard(container, user) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading leaderboard...</div>`;

  try {
    const [data, awards] = await Promise.all([
      api.scores.list(),
      api.awards.list(),
    ]);
    const leaderboard = data.leaderboard || [];
    const awardsMap = new Map(awards.map((a) => [a.teamName, a]));

    const championsHtml = leaderboard
      .slice(0, 3)
      .map(
        (team, i) => `
      <div class="card champion-card rank-${i + 1}">
        <div class="rank-badge" aria-label="Rank ${i + 1}">${i + 1}</div>
        <div class="team-name">${escapeHtml(team.teamName)}</div>
        <div class="team-score">${team.totalScore}</div>
        <div class="team-grade ${getGradeClass(team.grade)}">${escapeHtml(team.grade)}</div>
        <div class="text-secondary" style="font-size:0.8125rem;margin-top:0.25rem">${team.percentage}%</div>
      </div>
    `,
      )
      .join("");

    const rowsHtml = leaderboard
      .map(
        (team, i) => `
      <tr>
        <td class="rank-col">${i + 1}</td>
        <td>
          <strong>${escapeHtml(team.teamName)}</strong>
          ${awardsMap.has(team.teamName) ? `<span class="badge badge-approved" style="margin-left:0.5rem">🏆 ${escapeHtml(awardsMap.get(team.teamName).category)}</span>` : ""}
        </td>
        <td class="score-col">${team.baseScore}</td>
        <td class="score-col">${team.bonusScore}</td>
        <td class="score-col"><strong>${team.totalScore}</strong></td>
        <td>${team.percentage}%</td>
        <td class="grade-col"><span class="badge ${getGradeClass(team.grade)}">${escapeHtml(team.grade)}</span></td>
      </tr>
    `,
      )
      .join("");

    const cardsHtml = leaderboard
      .map(
        (team, i) => `
      <div class="leaderboard-card">
        <div class="rank">${i + 1}</div>
        <div class="team-info">
          <div class="team-name">${escapeHtml(team.teamName)}${awardsMap.has(team.teamName) ? ` 🏆` : ""}</div>
          <div class="team-score">${team.totalScore} pts · ${team.percentage}%</div>
        </div>
        <div class="team-grade ${getGradeClass(team.grade)}">${escapeHtml(team.grade)}</div>
      </div>
    `,
      )
      .join("");

    container.innerHTML = `
      <section aria-label="Champion teams">
        <div class="section-header">
          <h2>Champions Spotlight</h2>
          <span class="text-secondary" style="font-size:0.8125rem">Updated: ${new Date(data.lastUpdated).toLocaleTimeString()}</span>
        </div>
        <div class="champions-row">${championsHtml || '<p class="text-secondary">No scores yet</p>'}</div>
      </section>

      <section aria-label="Leaderboard">
        <div class="section-header">
          <h2>Leaderboard</h2>
        </div>
        <div class="card" style="padding:0;overflow:hidden;">
          <table class="leaderboard-table" aria-label="Team rankings">
            <thead>
              <tr>
                <th class="rank-col">Rank</th>
                <th>Team</th>
                <th class="score-col">Base</th>
                <th class="score-col">Bonus</th>
                <th class="score-col">Total</th>
                <th>Percentage</th>
                <th class="grade-col">Grade</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="7" class="text-center text-secondary" style="padding:2rem">No scores submitted yet</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="leaderboard-cards" aria-label="Team rankings (mobile)" style="display:none;">
          ${cardsHtml || '<p class="text-secondary text-center">No scores submitted yet</p>'}
        </div>
      </section>
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
