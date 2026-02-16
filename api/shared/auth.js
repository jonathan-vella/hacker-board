export function getClientPrincipal(req) {
  const header = req.headers.get("x-ms-client-principal");
  if (!header) return undefined;
  const decoded = Buffer.from(header, "base64").toString("utf-8");
  return JSON.parse(decoded);
}

export function requireRole(req, role) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userRoles.includes(role)) {
    return {
      status: 403,
      jsonBody: {
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      },
    };
  }
  return undefined;
}
