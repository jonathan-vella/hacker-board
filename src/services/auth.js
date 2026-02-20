let cachedUser;
let cachedAlias;

export async function getCurrentUser() {
  if (cachedUser) return cachedUser;

  try {
    // Use /api/me instead of /.auth/me — on Linux containers App Service Easy Auth
    // injects the principal as X-MS-CLIENT-PRINCIPAL header, which /api/me decodes.
    // The built-in /.auth/me endpoint is not reliably intercepted before the container.
    const response = await fetch("/api/me");
    if (!response.ok) return undefined;
    const data = await response.json();
    cachedUser = data?.clientPrincipal ?? undefined;
    return cachedUser;
  } catch {
    return undefined;
  }
}

/**
 * Returns the caller's anonymous alias (e.g. "Team03-Hacker07").
 * Returns undefined if the user hasn't joined the event yet.
 */
export async function getMyAlias() {
  if (cachedAlias) return cachedAlias;
  try {
    // Use a response-aware wrapper so a 404 (unregistered user) doesn't
    // propagate as a browser console error — return undefined silently.
    const res = await fetch("/api/attendees/me");
    if (!res.ok) return undefined;
    const profile = await res.json();
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
  // Redirect to the site root after GitHub OAuth (not the current page, which
  // could be /#/logout and cause a sign-in → logout loop).
  const origin =
    window.location.origin ||
    window.location.protocol + "//" + window.location.host;
  return `/.auth/login/github?post_login_redirect_uri=${encodeURIComponent(origin + "/")}`;
}

export function logoutUrl() {
  return "/.auth/logout?post_logout_redirect_uri=/%23/logout";
}

export function clearCache() {
  cachedUser = undefined;
  cachedAlias = undefined;
}
