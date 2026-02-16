import { api } from "../services/api.js";
import { getUsername } from "../services/auth.js";

export async function renderRegistration(container, user) {
  if (!user) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Sign In Required</h2><p class="text-secondary mt-2">Please sign in with GitHub to register.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading profile...</div>`;

  const username = getUsername(user);

  try {
    let profile;
    try {
      profile = await api.attendees.me();
    } catch (err) {
      if (err.status === 404) profile = undefined;
      else throw err;
    }

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Registration</h2></div>
        <form id="reg-form" class="card" novalidate>
          <div style="margin-bottom:1rem">
            <label for="reg-username"><strong>GitHub Username</strong></label>
            <input type="text" id="reg-username" class="form-input" value="${escapeHtml(username)}" readonly aria-label="GitHub username">
            <span class="text-secondary" style="font-size:0.8125rem">Auto-filled from your GitHub login</span>
          </div>
          <div style="margin-bottom:1rem">
            <label for="reg-displayname"><strong>Display Name</strong></label>
            <input type="text" id="reg-displayname" class="form-input" value="${escapeHtml(profile?.displayName || "")}" placeholder="How you'd like to be called" required aria-label="Display name">
          </div>
          <div style="margin-bottom:1rem">
            <label for="reg-email"><strong>Email</strong> <span class="text-secondary">(optional)</span></label>
            <input type="email" id="reg-email" class="form-input" value="${escapeHtml(profile?.email || "")}" placeholder="your@email.com" aria-label="Email address">
          </div>
          ${profile?.teamName ? `<div style="margin-bottom:1rem"><strong>Team:</strong> ${escapeHtml(profile.teamName)}</div>` : ""}
          <button type="submit" class="btn btn-primary">${profile ? "Update Profile" : "Register"}</button>
          <div id="reg-feedback" role="alert" aria-live="polite" style="margin-top:1rem"></div>
        </form>
      </section>
    `;

    document
      .getElementById("reg-form")
      ?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const feedback = document.getElementById("reg-feedback");
        const displayName = document
          .getElementById("reg-displayname")
          ?.value?.trim();
        const email = document.getElementById("reg-email")?.value?.trim();

        if (!displayName) {
          feedback.innerHTML = `<p style="color:var(--danger)">Display name is required.</p>`;
          return;
        }

        try {
          feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
          if (profile) {
            await api.attendees.updateMe({ displayName, email });
          } else {
            await api.attendees.me({ method: "POST", displayName, email });
          }
          feedback.innerHTML = `<p style="color:var(--success)">${profile ? "Profile updated!" : "Registration complete!"}</p>`;
        } catch (err) {
          feedback.innerHTML = `<p style="color:var(--danger)">Error: ${escapeHtml(err.message)}</p>`;
        }
      });
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load profile: ${escapeHtml(err.message)}</p></div>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
