let cachedUser;
let cachedAlias;

export async function getCurrentUser() {
  if (cachedUser) return cachedUser;

  try {
    const response = await fetch("/.auth/me");
    const data = await response.json();
    cachedUser = data?.clientPrincipal || undefined;
    return cachedUser;
  } catch {
    return undefined;
  }
}

/**
 * Returns the caller's anonymous alias (e.g. "Team03-Hacker07").
 * Returns undefined if the user hasn't joined the event yet.
 */
export async function getMyAlias(apiFetch) {
  if (cachedAlias) return cachedAlias;
  try {
    const profile = await apiFetch("/attendees/me");
    cachedAlias = profile?.alias;
    return cachedAlias;
  } catch {
    return undefined;
  }
}

export function isAdmin(user) {
  return user?.userRoles?.includes("admin") || false;
}

export function isMember(user) {
  return user?.userRoles?.includes("member") || false;
}

export function loginUrl() {
  return "/.auth/login/github";
}

export function logoutUrl() {
  return "/.auth/logout";
}

export function clearCache() {
  cachedUser = undefined;
  cachedAlias = undefined;
}
