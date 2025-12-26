export function errorResponse(code, message, details = {}) {
  const safeDetails = details && typeof details === "object" ? details : {};
  return {
    ok: false,
    error: {
      code,
      message,
      details: safeDetails,
      timestamp: new Date().toISOString()
    }
  };
}