import { api } from "../services/api.js";
import { isAdmin } from "../services/auth.js";
import { clearRubricCache } from "../services/rubric.js";

export async function renderRubricManager(container, user) {
  if (!isAdmin(user)) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Access Denied</h2><p class="text-secondary mt-2">Admin access required.</p></section>`;
    return;
  }

  container.innerHTML = `<div class="loading"><div class="spinner"></div> Loading rubrics...</div>`;

  try {
    const [rubrics, templates] = await Promise.all([
      api.rubrics.list(),
      api.rubrics.templates(),
    ]);

    const activeRubric = rubrics.find((r) => r.isActive);

    const templateCardsHtml = templates.length
      ? templates
          .map(
            (t) => `
        <div class="card rubric-tpl-card" data-slug="${escapeHtml(t.slug)}">
          <h3>${escapeHtml(t.name)}</h3>
          <div class="rubric-tpl-stats">
            <span>${t.categoriesCount} challenges</span>
            <span>${t.baseTotal} pts</span>
            <span>+${t.bonusTotal} bonus</span>
          </div>
          <button class="btn btn-primary btn-sm tpl-activate" data-slug="${escapeHtml(t.slug)}" type="button">
            ${activeRubric?.name === t.name ? "Re-activate" : "Activate"}
          </button>
          <div class="tpl-feedback" role="alert" aria-live="polite"></div>
        </div>
      `,
          )
          .join("")
      : '<p class="text-secondary">No built-in templates found.</p>';

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Rubric Management</h2></div>

        <div style="margin-bottom:2rem">
          <h3 style="margin-bottom:1rem">Event Templates</h3>
          <p class="text-secondary" style="margin-bottom:1rem">Choose a pre-built scoring rubric for your event.</p>
          <div class="grid-3">${templateCardsHtml}</div>
        </div>

        <details class="card" style="margin-bottom:1.5rem">
          <summary style="cursor:pointer;font-weight:600">Upload Custom Rubric</summary>
          <div style="margin-top:1rem">
            <p class="text-secondary" style="margin-bottom:1rem">Upload a Markdown rubric file. Uses the standard HackerBoard scoring rubric template.</p>

            <div id="rubric-drop" role="button" tabindex="0" aria-label="Drop zone for rubric markdown file"
              style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:2rem;text-align:center;cursor:pointer;transition:border-color 0.2s;margin-bottom:1rem">
              <p>Drag & drop a .md file or click to browse</p>
              <input type="file" id="rubric-file" accept=".md,text/markdown" style="display:none" aria-label="Choose rubric markdown file">
            </div>

            <div style="margin-bottom:1rem">
              <label for="rubric-name"><strong>Rubric Name</strong></label>
              <input type="text" id="rubric-name" class="form-input" placeholder="e.g., InfraOps Microhack v2" aria-label="Rubric name">
            </div>

            <div id="rubric-preview-area" style="display:none;margin-bottom:1rem">
              <h4>Preview</h4>
              <pre id="rubric-preview" class="card" style="max-height:250px;overflow:auto;font-size:0.75rem;background:var(--surface);padding:0.75rem"></pre>
            </div>

            <div style="display:flex;gap:0.75rem;align-items:center">
              <label><input type="checkbox" id="rubric-activate"> Activate immediately</label>
              <button id="rubric-submit" class="btn btn-primary" type="button" disabled>Upload Rubric</button>
            </div>
            <div id="rubric-feedback" role="alert" aria-live="polite" style="margin-top:0.75rem"></div>
          </div>
        </details>

        ${activeRubric ? `<div class="card" style="margin-bottom:1.5rem"><p><strong>Active Rubric:</strong> ${escapeHtml(activeRubric.name)} (${activeRubric.baseTotal} pts + ${activeRubric.bonusTotal} bonus)</p></div>` : ""}

        <div class="card" style="padding:0;overflow:hidden">
          <table class="leaderboard-table" aria-label="Rubric list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Base Total</th>
                <th>Bonus</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${
                rubrics.length
                  ? rubrics
                      .map(
                        (r) => `
                  <tr>
                    <td>${escapeHtml(r.name || r.rowKey)}</td>
                    <td>${r.baseTotal || "—"}</td>
                    <td>+${r.bonusTotal || 0}</td>
                    <td><span class="badge badge-${r.isActive ? "approved" : "pending"}">${r.isActive ? "Active" : "Archived"}</span></td>
                    <td>${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                `,
                      )
                      .join("")
                  : '<tr><td colspan="5" class="text-center text-secondary" style="padding:2rem">No rubrics uploaded</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>
    `;

    attachTemplateListeners(container, user);
    attachRubricListeners(container, user);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load rubrics: ${escapeHtml(err.message)}</p></div>`;
  }
}

function attachTemplateListeners(container, user) {
  document.querySelectorAll(".tpl-activate").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const slug = btn.dataset.slug;
      const feedback = btn
        .closest(".rubric-tpl-card")
        .querySelector(".tpl-feedback");

      try {
        btn.disabled = true;
        feedback.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        await api.rubrics.activateTemplate(slug);
        clearRubricCache();
        feedback.innerHTML = `<p style="color:var(--success)">Activated!</p>`;
        setTimeout(() => renderRubricManager(container, user), 1200);
      } catch (err) {
        feedback.innerHTML = `<p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
        btn.disabled = false;
      }
    });
  });
}

function attachRubricListeners(container, user) {
  const dropZone = document.getElementById("rubric-drop");
  const fileInput = document.getElementById("rubric-file");
  const previewArea = document.getElementById("rubric-preview-area");
  const preview = document.getElementById("rubric-preview");
  const submitBtn = document.getElementById("rubric-submit");
  const feedback = document.getElementById("rubric-feedback");
  let markdownContent;

  dropZone?.addEventListener("click", () => fileInput?.click());
  dropZone?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput?.click();
    }
  });
  dropZone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--accent)";
  });
  dropZone?.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "var(--border)";
  });
  dropZone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--border)";
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  });
  fileInput?.addEventListener("change", () => {
    if (fileInput.files?.[0]) loadFile(fileInput.files[0]);
  });

  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      markdownContent = reader.result;
      preview.textContent = markdownContent;
      previewArea.style.display = "block";
      submitBtn.disabled = false;
    };
    reader.readAsText(file);
  }

  submitBtn?.addEventListener("click", async () => {
    if (!markdownContent) return;
    const name = document.getElementById("rubric-name")?.value?.trim();
    const activate = document.getElementById("rubric-activate")?.checked;

    if (!name) {
      feedback.innerHTML = `<p style="color:var(--danger)">Please provide a rubric name.</p>`;
      return;
    }

    try {
      feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Uploading...</div>`;
      await api.rubrics.create({
        name,
        sourceMarkdown: markdownContent,
        activate,
      });
      if (activate) clearRubricCache();
      feedback.innerHTML = `<p style="color:var(--success)">Rubric uploaded${activate ? " and activated" : ""}!</p>`;
      setTimeout(() => renderRubricManager(container, user), 1500);
    } catch (err) {
      feedback.innerHTML = `<p style="color:var(--danger)">Upload failed: ${escapeHtml(err.message)}</p>`;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
