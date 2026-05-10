/**
 * Resolve configured frontend origin(s) for backend CORS and link generation.
 * `FRONTEND_URL` supports either a single origin or a comma-separated list.
 */
function getFrontendOriginList() {
  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length === 0) {
    throw new Error('FRONTEND_URL environment variable is required');
  }

  return configuredOrigins;
}

function getFrontendCorsOrigin() {
  const origins = getFrontendOriginList();
  return origins.length === 1 ? origins[0] : origins;
}

function getPrimaryFrontendOrigin() {
  return getFrontendOriginList()[0];
}

module.exports = {
  getFrontendOriginList,
  getFrontendCorsOrigin,
  getPrimaryFrontendOrigin
};
