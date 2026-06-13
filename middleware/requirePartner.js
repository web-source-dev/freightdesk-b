const appConfig = require('../config/appConfig');

function readPartnerKey(req) {
  const headerKey = req.headers['x-dathub-partner-key'];
  if (headerKey) return String(headerKey).trim();

  const auth = req.headers.authorization || '';
  if (auth.startsWith('Partner ')) {
    return auth.slice(8).trim();
  }

  return null;
}

function requirePartner(req, res, next) {
  const expected = appConfig.DATHUB_PARTNER_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'Partner API is not configured on this server.' });
  }

  const provided = readPartnerKey(req);
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing partner API key.' });
  }

  req.partner = { name: 'dathub' };
  next();
}

module.exports = { requirePartner, readPartnerKey };
