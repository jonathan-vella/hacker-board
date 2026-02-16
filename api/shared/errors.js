export function errorResponse(code, message, status = 400) {
  return {
    status,
    jsonBody: { error: { code, message } },
  };
}
