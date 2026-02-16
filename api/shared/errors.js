function errorResponse(code, message, status = 400) {
  return {
    status,
    body: { error: { code, message } },
    headers: { "Content-Type": "application/json" },
  };
}

module.exports = { errorResponse };
