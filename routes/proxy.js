const express = require('express');
const proxyManager = require('../lib/legacy/utils/proxyManager');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/config', requireAuth, async (req, res) => {
  try {
    const container = req.query.container || req.auth.container || 'A';
    const userId = req.query.userId || req.auth.sub || null;
    const config = await proxyManager.getProxyConfig(container, null, userId);
    if (!config) {
      return res.status(404).json({ error: 'No proxy configuration found.' });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load proxy config.' });
  }
});

router.get('/relay-server', requireAuth, async (_req, res) => {
  try {
    const relay = await proxyManager.fetchRelayServer();
    res.json(relay);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load relay server.' });
  }
});

router.post('/test', requireAuth, async (req, res) => {
  try {
    const { host, port, timeoutMs } = req.body || {};
    if (!host || !port) {
      return res.status(400).json({ error: 'host and port are required.' });
    }
    const ok = await proxyManager.testProxyConnection(host, Number(port), timeoutMs || 8000);
    res.json({ success: ok });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Proxy test failed.' });
  }
});

router.post('/clear-cache', requireAuth, (_req, res) => {
  proxyManager.clearCache();
  res.json({ success: true });
});

module.exports = router;
