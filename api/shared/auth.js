const ADMIN_USERS = (process.env.ADMIN_USERS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Normalizes App Service Easy Auth principal to a flat shape with userRoles.
 * Handles both the flat shape (identityProvider present) and the Linux
 * container claims-based format (auth_typ + claims array).
 */
export function normalizePrincipal(raw) {
  if (!raw) return undefined;

  let principal;
  if (raw.identityProvider || Array.isArray(raw.userRoles)) {
    // Already flat shape (local dev / Windows App Service / test mocks)
    principal = raw;
  } else {
    // Claims-based format (Linux App Service containers)
    const claims = raw.claims || [];
    const find = (typ) => claims.find((c) => c.typ === typ)?.val;
    principal = {
      identityProvider: raw.auth_typ,
      userId:
        find("urn:github:id") ||
        find(
          "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        ),
      userDetails: find("urn:github:login") || find(raw.name_typ),
      userRoles: claims
        .filter((c) => c.typ === raw.role_typ)
        .map((c) => c.val)
        .concat(["anonymous", "authenticated"]),
      avatarUrl: find("urn:github:avatar_url"),
      displayName: find(raw.name_typ),
    };
  }

  // Inject admin role when caller matches ADMIN_USERS env var
  const callerKey =
    `${principal.identityProvider}:${principal.userDetails}`.toLowerCase();
  if (
    ADMIN_USERS.includes(callerKey) &&
    !principal.userRoles?.includes("admin")
  ) {
    principal.userRoles = [...(principal.userRoles || []), "admin"];
  }

  return principal;
}

export function getClientPrincipal(req) {
  const header = req.headers.get("x-ms-client-principal");
  if (!header) return undefined;
  try {
    const raw = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
    return normalizePrincipal(raw);
  } catch {
    return undefined;
  }
}

export function requireRole(req, role) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userRoles?.includes(role)) {
    return {
      status: 403,
      jsonBody: {
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      },
    };
  }
  return undefined;
}
