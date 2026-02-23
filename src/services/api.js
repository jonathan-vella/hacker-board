const API_BASE = "/api";

async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const error = new Error(
      errorBody?.error?.message || `API error: ${response.status}`,
    );
    error.status = response.status;
    error.code = errorBody?.error?.code;
    throw error;
  }

  if (response.status === 204) return undefined;
  return response.json();
}

export const api = {
  teams: {
    list: () => apiFetch("/teams"),
    create: (data) =>
      apiFetch("/teams", { method: "POST", body: JSON.stringify(data) }),
    update: (data) =>
      apiFetch("/teams", { method: "PUT", body: JSON.stringify(data) }),
    delete: (teamName) =>
      apiFetch("/teams", {
        method: "DELETE",
        body: JSON.stringify({ teamName }),
      }),
    assign: () =>
      apiFetch("/teams/assign", {
        method: "POST",
      }),
  },

  scores: {
    list: (team) =>
      apiFetch(`/scores${team ? `?team=${encodeURIComponent(team)}` : ""}`),
    override: (data) =>
      apiFetch("/scores", { method: "POST", body: JSON.stringify(data) }),
  },

  upload: (data) =>
    apiFetch("/upload", { method: "POST", body: JSON.stringify(data) }),

  submissions: {
    list: (status, team) => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (team) params.set("team", team);
      const qs = params.toString();
      return apiFetch(`/submissions${qs ? `?${qs}` : ""}`);
    },
    validate: (data) =>
      apiFetch("/submissions/validate", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  attendees: {
    list: () => apiFetch("/attendees"),
    me: () => apiFetch("/attendees/me"),
    join: () => apiFetch("/attendees/me", { method: "POST" }),
    remove: (alias) =>
      apiFetch("/attendees", {
        method: "DELETE",
        body: JSON.stringify({ alias }),
      }),
    move: (alias, toTeam) =>
      apiFetch("/attendees/move", {
        method: "POST",
        body: JSON.stringify({ alias, toTeam }),
      }),
  },

  awards: {
    list: () => apiFetch("/awards"),
    assign: (data) =>
      apiFetch("/awards", { method: "POST", body: JSON.stringify(data) }),
  },

  rubrics: {
    list: () => apiFetch("/rubrics"),
    active: () => apiFetch("/rubrics/active"),
    create: (data) =>
      apiFetch("/rubrics", { method: "POST", body: JSON.stringify(data) }),
    templates: () => apiFetch("/rubrics/templates"),
    activateTemplate: (slug) =>
      apiFetch(`/rubrics/templates/${encodeURIComponent(slug)}/activate`, {
        method: "POST",
      }),
  },

  flags: {
    get: () => apiFetch("/flags"),
    update: (flags) =>
      apiFetch("/flags", { method: "PUT", body: JSON.stringify(flags) }),
  },
};
