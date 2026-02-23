import { api } from "../services/api.js";

export async function renderRegistration(container, user) {
  if (!user) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Sign In Required</h2><p class="text-secondary mt-2">Please sign in with GitHub to register.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading...</div>`;

  try {
    const profile = await api.attendees.me();

    if (profile.registered) {
      container.innerHTML = `
        <section>
          <div class="section-header"><h2>Registration</h2></div>
          <div class="card text-center" style="padding:2rem">
            <p class="text-secondary" style="margin-bottom:0.5rem">Your anonymous hacker identity</p>
            <p style="font-size:1.5rem;font-weight:700;color:var(--accent)">${escapeHtml(profile.alias)}</p>
            <p class="text-secondary" style="margin-top:1rem">Team: <strong>${escapeHtml(profile.teamName)}</strong></p>
          </div>
        </section>
      `;
      return;
    }

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Join Event</h2></div>
        <div class="card text-center" style="padding:2rem">
          <p class="text-secondary" style="margin-bottom:1.5rem">Click <strong>Join Event</strong> to receive your anonymous hacker alias and team assignment.</p>
          <button id="join-btn" class="btn btn-primary" type="button">Join Event</button>
          <div id="join-feedback" role="alert" aria-live="polite" style="margin-top:1rem"></div>
        </div>
      </section>
    `;

    document.getElementById("join-btn")?.addEventListener("click", async () => {
      const feedback = document.getElementById("join-feedback");
      const btn = document.getElementById("join-btn");
      btn.disabled = true;
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

      try {
        const result = await api.attendees.join();
        container.innerHTML = `
          <section>
            <div class="section-header"><h2>Welcome!</h2></div>
            <div class="card text-center" style="padding:2rem">
              <p class="text-secondary" style="margin-bottom:0.5rem">Your anonymous hacker identity</p>
              <p style="font-size:1.5rem;font-weight:700;color:var(--accent)">${escapeHtml(result.alias)}</p>
              <p class="text-secondary" style="margin-top:1rem">Team: <strong>${escapeHtml(result.teamName)}</strong></p>
            </div>
          </section>
        `;
      } catch (err) {
        btn.disabled = false;
        feedback.innerHTML = `<p style="color:var(--danger)">Error: ${escapeHtml(err.message)}</p>`;
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load: ${escapeHtml(err.message)}</p></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
