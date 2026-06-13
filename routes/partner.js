const express = require('express');
const adminService = require('../lib/adminService');
const sessionStorageService = require('../lib/sessionStorageService');
const { requirePartner } = require('../middleware/requirePartner');

const router = express.Router();

router.use(requirePartner);

router.get('/dathub/containers', async (_req, res) => {
  try {
    const containers = await adminService.listSessionContainers();
    res.json({ success: true, containers, count: containers.length });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to list containers.' });
  }
});

router.get('/dathub/sessions', async (_req, res) => {
  try {
    const containers = await adminService.listSessionContainers();
    const sessions = [];
    const errors = {};

    for (const container of containers) {
      const result = await sessionStorageService.downloadSession(container, { format: 'datcom' });
      if (result.success) {
        sessions.push({
          container: result.meta?.container || container,
          cookieCount: result.meta?.exportCookieCount || 0,
          lastUpdated: result.data?.['dat.com']?.lastUpdated || null,
          session: result.data,
        });
      } else {
        errors[container] = result.message || 'Download failed.';
      }
    }

    res.json({
      success: true,
      count: sessions.length,
      failed: Object.keys(errors).length,
      sessions,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load partner sessions.' });
  }
});

router.get('/dathub/sessions/:container', async (req, res) => {
  try {
    const container = String(req.params.container || '').toUpperCase();
    const result = await sessionStorageService.downloadSession(container, { format: 'datcom' });
    if (!result.success) {
      const status = result.message?.includes('No session') ? 404 : 500;
      return res.status(status).json(result);
    }

    res.json({
      success: true,
      container: result.meta?.container || container,
      cookieCount: result.meta?.exportCookieCount || 0,
      lastUpdated: result.data?.['dat.com']?.lastUpdated || null,
      session: result.data,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load partner session.' });
  }
});

module.exports = router;
