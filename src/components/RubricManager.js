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
    const rubrics = await api.rubrics.list();

    container.innerHTML = `
      <section>
        <div class="section-header"><h2>Rubric Management</h2></div>

        <div class="card" style="margin-bottom:1.5rem">
          <h3>Upload New Rubric</h3>
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
                    <td>${r.timestamp ? new Date(r.timestamp).toLocaleDateString() : "—"}</td>
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

    attachRubricListeners(container, user);
  } catch (err) {
    container.innerHTML = `<div class="card text-center"><p class="text-secondary">Failed to load rubrics: ${escapeHtml(err.message)}</p></div>`;
  }
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
      await api.rubrics.create({ name, markdown: markdownContent, activate });
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
