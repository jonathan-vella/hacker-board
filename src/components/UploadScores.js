import { api } from "../services/api.js";

export async function renderUploadScores(container, user) {
  if (!user) {
    container.innerHTML = `<section class="card text-center" style="padding:3rem"><h2>Sign In Required</h2><p class="text-secondary mt-2">Please sign in to upload scores.</p></section>`;
    return;
  }

  container.innerHTML = `
    <section>
      <div class="section-header"><h2>Upload Scores (JSON)</h2></div>
      <div class="card">
        <div id="drop-zone" role="button" tabindex="0" aria-label="Drop zone for JSON file upload"
          style="border:2px dashed var(--border);border-radius:var(--radius-md);padding:3rem;text-align:center;cursor:pointer;transition:border-color 0.2s">
          <p style="font-size:1.125rem;margin-bottom:0.5rem">Drag & drop a JSON file here</p>
          <p class="text-secondary">or click to browse</p>
          <input type="file" id="file-input" accept=".json,application/json" style="display:none" aria-label="Choose JSON file">
        </div>

        <div id="preview-area" style="display:none;margin-top:1.5rem">
          <h3>Preview</h3>
          <pre id="json-preview" class="card" style="max-height:300px;overflow:auto;font-size:0.8125rem;background:var(--surface);margin-top:0.5rem"></pre>
          <div style="display:flex;gap:0.75rem;margin-top:1rem">
            <button id="submit-upload" class="btn btn-primary" type="button">Submit</button>
            <button id="cancel-upload" class="btn" type="button">Cancel</button>
          </div>
        </div>

        <div id="upload-feedback" role="alert" aria-live="polite" style="margin-top:1rem"></div>
      </div>
    </section>
  `;

  attachUploadListeners();
}

function attachUploadListeners() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const previewArea = document.getElementById("preview-area");
  const jsonPreview = document.getElementById("json-preview");
  const feedback = document.getElementById("upload-feedback");
  let pendingData;

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
    if (file) handleFile(file);
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    if (!file.name.endsWith(".json")) {
      feedback.innerHTML = `<p style="color:var(--danger)">Only .json files are accepted.</p>`;
      return;
    }
    if (file.size > 256 * 1024) {
      feedback.innerHTML = `<p style="color:var(--danger)">File too large (max 256 KB).</p>`;
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        pendingData = JSON.parse(reader.result);
        jsonPreview.textContent = JSON.stringify(pendingData, undefined, 2);
        previewArea.style.display = "block";
        feedback.innerHTML = "";
      } catch {
        feedback.innerHTML = `<p style="color:var(--danger)">Invalid JSON file.</p>`;
      }
    };
    reader.readAsText(file);
  }

  document.getElementById("cancel-upload")?.addEventListener("click", () => {
    pendingData = undefined;
    previewArea.style.display = "none";
    fileInput.value = "";
  });

  document
    .getElementById("submit-upload")
    ?.addEventListener("click", async () => {
      if (!pendingData) return;
      try {
        feedback.innerHTML = `<div class="loading"><div class="spinner"></div> Uploading...</div>`;
        await api.upload(pendingData);
        feedback.innerHTML = `<p style="color:var(--success)">Score uploaded and submitted for review.</p>`;
        pendingData = undefined;
        previewArea.style.display = "none";
        fileInput.value = "";
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
