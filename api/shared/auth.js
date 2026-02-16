function getClientPrincipal(req) {
  const header = req.headers["x-ms-client-principal"];
  if (!header) return null;
  const encoded = Buffer.from(header, "base64");
  return JSON.parse(encoded.toString("ascii"));
}

function requireRole(req, role) {
  const principal = getClientPrincipal(req);
  if (!principal || !principal.userRoles.includes(role)) {
    return {
      status: 403,
      body: {
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      },
    };
  }
  return null;
}

module.exports = { getClientPrincipal, requireRole };
