const express = require('express');
const sessionStorageService = require('../lib/sessionStorageService');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/download/:container', requireAuth, async (req, res) => {
  const container = req.params.container || req.auth.container || 'A';
  const result = await sessionStorageService.downloadSession(container);
  if (!result.success) {
    return res.status(result.message?.includes('No session') ? 404 : 500).json(result);
  }
  res.json(result);
});

router.get('/storage/check', requireAuth, async (req, res) => {
  try {
    const container = req.query.container || req.auth.container || 'A';
    const since = req.query.since || null;
    const result = await sessionStorageService.checkForNewSession(container, since);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Storage check failed.' });
  }
});

module.exports = router;
