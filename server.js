/**
 * FreightDesk API — secrets stay on this server, not in the desktop app.
 */
const express = require('express');
const cors = require('cors');
const appConfig = require('./config/appConfig');
const authRoutes = require('./routes/auth');
const proxyRoutes = require('./routes/proxy');
const sessionRoutes = require('./routes/session');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

if (!appConfig.API_JWT_SECRET) {
  console.error('[FreightDesk API] API_JWT_SECRET is required in production.');
  process.exit(1);
}

if (!appConfig.USER_SUPABASE_URL || !appConfig.USER_SUPABASE_SERVICE_KEY) {
  console.error('[FreightDesk API] USER_SUPABASE_URL and USER_SUPABASE_SERVICE_KEY are required.');
  process.exit(1);
}

if (!appConfig.SESSION_SUPABASE_URL || !appConfig.SESSION_SUPABASE_SERVICE_KEY) {
  console.error('[FreightDesk API] SESSION_SUPABASE_URL and SESSION_SUPABASE_SERVICE_KEY are required.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: appConfig.APP_NAME });
});

app.use('/api/auth', authRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error('[FreightDesk API]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(appConfig.API_PORT, () => {
  console.log(`[FreightDesk API] ${appConfig.APP_NAME} at ${appConfig.API_URL}`);
  if (!process.env.API_JWT_SECRET) {
    console.warn('[FreightDesk API] Dev JWT secret in use — set API_JWT_SECRET for production.');
  }
});
