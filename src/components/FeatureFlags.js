import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";

export async function renderFeatureFlags(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `
      <section class="card text-center" style="padding: 3rem;">
        <h2>Access Denied</h2>
        <p class="text-secondary mt-2">Only administrators can manage feature flags.</p>
        <a href="#/leaderboard" class="btn btn-primary mt-2">Back to Leaderboard</a>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Feature Flags</h2>
      <p class="text-secondary">Toggle features on or off for the entire application.</p>
      <div id="flags-status" class="sr-only" aria-live="polite"></div>
      <div id="flags-container" class="mt-2">
        <p class="text-secondary">Loading flags...</p>
      </div>
    </section>
  `;

  await loadFlags();
}

async function loadFlags() {
  const flagsContainer = document.getElementById("flags-container");
  const statusEl = document.getElementById("flags-status");

  try {
    const { flags, descriptions } = await api.flags.get();
    renderFlagToggles(flagsContainer, flags, descriptions);
  } catch (err) {
    flagsContainer.innerHTML = `<p class="form-error">Failed to load feature flags: ${err.message}</p>`;
    if (statusEl) statusEl.textContent = "Error loading feature flags";
  }
}

function renderFlagToggles(container, flags, descriptions) {
  const flagEntries = Object.entries(flags);

  container.innerHTML = `
    <div class="flags-list">
      ${flagEntries
        .map(
          ([key, value]) => `
        <div class="flag-item card" style="padding: 1rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <strong>${formatFlagName(key)}</strong>
              <p class="text-secondary" style="margin: 0.25rem 0 0; font-size: 0.875rem;">
                ${descriptions[key] || key}
              </p>
            </div>
            <label class="flag-toggle" style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <span class="flag-badge ${value ? "flag-on" : "flag-off"}">
                ${value ? "ON" : "OFF"}
              </span>
              <input
                type="checkbox"
                data-flag="${key}"
                ${value ? "checked" : ""}
                aria-label="Toggle ${formatFlagName(key)}"
                style="width: 1.25rem; height: 1.25rem; cursor: pointer;"
              />
            </label>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
    <div class="mt-2" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
      <button type="button" id="save-flags-btn" class="btn btn-primary">Save Changes</button>
      <button type="button" id="reset-flags-btn" class="btn">Reset to Defaults</button>
    </div>
  `;

  document
    .getElementById("save-flags-btn")
    .addEventListener("click", saveFlags);
  document
    .getElementById("reset-flags-btn")
    .addEventListener("click", resetFlags);

  container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const badge = checkbox.parentElement.querySelector(".flag-badge");
      if (badge) {
        badge.textContent = checkbox.checked ? "ON" : "OFF";
        badge.className = `flag-badge ${checkbox.checked ? "flag-on" : "flag-off"}`;
      }
    });
  });
}

async function saveFlags() {
  const btn = document.getElementById("save-flags-btn");
  const statusEl = document.getElementById("flags-status");
  const checkboxes = document.querySelectorAll("input[data-flag]");

  const flags = {};
  checkboxes.forEach((cb) => {
    flags[cb.dataset.flag] = cb.checked;
  });

  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    await api.flags.update(flags);
    if (statusEl) statusEl.textContent = "Feature flags saved successfully";
    btn.textContent = "Saved!";
    setTimeout(() => {
      btn.textContent = "Save Changes";
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error saving flags: ${err.message}`;
    btn.textContent = "Save Changes";
    btn.disabled = false;
  }
}

async function resetFlags() {
  const statusEl = document.getElementById("flags-status");

  const defaults = {
    SUBMISSIONS_ENABLED: true,
    LEADERBOARD_LOCKED: false,
    REGISTRATION_OPEN: true,
    AWARDS_VISIBLE: true,
    RUBRIC_UPLOAD_ENABLED: true,
  };

  try {
    await api.flags.update(defaults);
    if (statusEl) statusEl.textContent = "Flags reset to defaults";
    await loadFlags();
  } catch (err) {
    if (statusEl)
      statusEl.textContent = `Error resetting flags: ${err.message}`;
  }
}

function formatFlagName(key) {
  return key
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
