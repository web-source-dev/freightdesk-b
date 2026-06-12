const { verifyToken } = require('../lib/jwt');
const { readBearerToken } = require('./requireAuth');

function isAdminPayload(payload) {
  return payload && (payload.role === 'admin' || payload.is_admin === true);
}

function requireAdmin(req, res, next) {
  const token = readBearerToken(req);
  const payload = verifyToken(token);
  if (!isAdminPayload(payload)) {
    return res.status(401).json({ error: 'Admin session expired. Please sign in again.' });
  }
  req.auth = payload;
  req.admin = { id: payload.sub, username: payload.username, role: payload.role };
  next();
}

module.exports = { requireAdmin, isAdminPayload };
