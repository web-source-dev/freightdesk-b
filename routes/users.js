const express = require('express');
const authService = require('../lib/authService');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/:id', requireAuth, async (req, res) => {
  const user = await authService.getUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json(user);
});

module.exports = router;
