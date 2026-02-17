const STORAGE_KEY = "hb-dismissed-notifications";
const TOAST_DURATION = 5000;

let toastContainer;

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveDismissed(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function dismissNotification(id) {
  const dismissed = getDismissed();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    saveDismissed(dismissed);
  }
}

export function isDismissed(id) {
  return getDismissed().includes(id);
}

export function clearDismissed() {
  localStorage.removeItem(STORAGE_KEY);
}

function ensureToastContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.className = "toast-container";
    toastContainer.setAttribute("aria-live", "polite");
    toastContainer.setAttribute("aria-label", "Notifications");
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "info") {
  const container = ensureToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");

  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast-close";
  closeBtn.setAttribute("aria-label", "Dismiss notification");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => toast.remove());
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, TOAST_DURATION);
}

export async function updatePendingBadge(apiModule) {
  const badge = document.getElementById("pending-count-badge");
  if (!badge) return;

  try {
    const submissions = await apiModule.submissions.list("pending");
    const count = Array.isArray(submissions) ? submissions.length : 0;
    badge.textContent = count > 0 ? count : "";
    badge.style.display = count > 0 ? "inline-flex" : "none";
    badge.setAttribute(
      "aria-label",
      `${count} pending submission${count !== 1 ? "s" : ""}`,
    );
  } catch {
    badge.style.display = "none";
  }
}
