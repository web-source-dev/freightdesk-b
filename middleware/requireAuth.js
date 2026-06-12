const { verifyToken } = require('../lib/jwt');

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  req.auth = payload;
  next();
}

module.exports = { requireAuth, readBearerToken };
