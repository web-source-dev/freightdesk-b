const express = require('express');
const authService = require('../lib/authService');
const { signUserToken } = require('../lib/jwt');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password, deviceFingerprint } = req.body || {};
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await authService.signIn(username.trim(), password, deviceFingerprint || null);
    const token = signUserToken(user);

    res.json({
      success: true,
      token,
      user: {
        ...user,
        sessionToken: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
  } catch (err) {
    res.status(401).json({ error: err.message || 'Login failed.' });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await authService.getUserById(req.auth.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json(authService.mapUserRow(user));
});

module.exports = router;
