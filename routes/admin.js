const express = require('express');
const adminService = require('../lib/adminService');
const sessionStorageService = require('../lib/sessionStorageService');
const { signAdminToken } = require('../lib/jwt');
const { requireAdmin } = require('../middleware/requireAdmin');

const router = express.Router();

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await adminService.verifyAdminCredentials(username.trim(), password);
    const token = signAdminToken(user);
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    res.status(401).json({ error: err.message || 'Login failed.' });
  }
});

router.get('/auth/session', requireAdmin, (req, res) => {
  res.json({
    id: req.admin.id,
    username: req.admin.username,
    role: req.admin.role,
  });
});

router.get('/users', requireAdmin, async (req, res) => {
  try {
    res.json(await adminService.listUsers(req.query.search || ''));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to list users.' });
  }
});

router.post('/users', requireAdmin, async (req, res) => {
  try {
    res.status(201).json(await adminService.createUser(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to create user.' });
  }
});

router.patch('/users/:id', requireAdmin, async (req, res) => {
  try {
    res.json(await adminService.updateUser(req.params.id, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update user.' });
  }
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    await adminService.deleteUser(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to delete user.' });
  }
});

router.get('/containers', requireAdmin, async (_req, res) => {
  try {
    res.json(await adminService.listSessionContainers());
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to list containers.' });
  }
});

router.get('/sessions/download/:container', requireAdmin, async (req, res) => {
  try {
    const container = String(req.params.container || '').toUpperCase();
    const format = String(req.query.format || 'raw').toLowerCase();
    const allowed = new Set(['raw', 'datcom', 'session']);
    if (!allowed.has(format)) {
      return res.status(400).json({ error: 'Invalid format. Use raw, datcom, or session.' });
    }

    const result = await sessionStorageService.downloadSession(container, {
      format,
      sessionName: req.query.sessionName || undefined,
    });
    if (!result.success) {
      return res.status(result.message?.includes('No session') ? 404 : 500).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Session download failed.' });
  }
});

router.get('/sessions/download-all', requireAdmin, async (req, res) => {
  try {
    const format = String(req.query.format || 'raw').toLowerCase();
    const allowed = new Set(['raw', 'datcom', 'session']);
    if (!allowed.has(format)) {
      return res.status(400).json({ error: 'Invalid format. Use raw, datcom, or session.' });
    }

    const containers = await adminService.listSessionContainers();
    const sessions = {};
    const errors = {};

    for (const container of containers) {
      const result = await sessionStorageService.downloadSession(container, { format });
      if (result.success) {
        sessions[container] = result.data;
      } else {
        errors[container] = result.message || 'Download failed.';
      }
    }

    res.json({
      success: true,
      format,
      containers,
      downloaded: Object.keys(sessions).length,
      failed: Object.keys(errors).length,
      sessions,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Bulk session download failed.' });
  }
});

module.exports = router;
