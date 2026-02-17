let cachedUser;

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

export function isAdmin(user) {
  return user?.userRoles?.includes("admin") || false;
}

export function isMember(user) {
  return user?.userRoles?.includes("member") || false;
}

export function getUsername(user) {
  return user?.userDetails || "Anonymous";
}

export function loginUrl() {
  return "/.auth/login/github";
}

export function logoutUrl() {
  return "/.auth/logout";
}

export function clearCache() {
  cachedUser = undefined;
}
