const jwt = require('jsonwebtoken');
const appConfig = require('../config/appConfig');

const TOKEN_TTL = process.env.API_TOKEN_TTL || '30d';

const ADMIN_TOKEN_TTL = process.env.ADMIN_TOKEN_TTL || '8h';

function signUserToken(user) {
  if (!appConfig.API_JWT_SECRET) {
    throw new Error('API_JWT_SECRET is required.');
  }

  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      container: user.data_source_container,
    },
    appConfig.API_JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

function signAdminToken(user) {
  if (!appConfig.API_JWT_SECRET) {
    throw new Error('API_JWT_SECRET is required.');
  }

  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: 'admin',
      is_admin: true,
    },
    appConfig.API_JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_TTL }
  );
}

function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, appConfig.API_JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { signUserToken, signAdminToken, verifyToken, TOKEN_TTL, ADMIN_TOKEN_TTL };
