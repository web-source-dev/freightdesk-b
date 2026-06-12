/**
 * FreightDesk API — secrets stay on this server, not in the desktop app.
 */
const appConfig = require('./config/appConfig');

function startupError(message) {
  console.error(`[FreightDesk API] ${message}`);
  process.exit(1);
}

const envPath = require('path').join(__dirname, '.env');
if (!require('fs').existsSync(envPath)) {
  startupError(
    `Missing .env file at ${envPath}\n` +
      '  Run: cp .env.example .env && nano .env\n' +
      '  Required: API_JWT_SECRET, USER_SUPABASE_*, SESSION_SUPABASE_*'
  );
}

if (!appConfig.API_JWT_SECRET) {
  startupError('API_JWT_SECRET is required. Set it in .env (NODE_ENV=production).');
}

if (!appConfig.USER_SUPABASE_URL || !appConfig.USER_SUPABASE_SERVICE_KEY) {
  startupError('USER_SUPABASE_URL and USER_SUPABASE_SERVICE_KEY are required in .env.');
}

if (!appConfig.SESSION_SUPABASE_URL || !appConfig.SESSION_SUPABASE_SERVICE_KEY) {
  startupError('SESSION_SUPABASE_URL and SESSION_SUPABASE_SERVICE_KEY are required in .env.');
}

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const proxyRoutes = require('./routes/proxy');
const sessionRoutes = require('./routes/session');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

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

app.listen(appConfig.API_PORT, '0.0.0.0', () => {
  console.log(`[FreightDesk API] ${appConfig.APP_NAME} listening on 0.0.0.0:${appConfig.API_PORT}`);
  console.log(`[FreightDesk API] Public URL: ${appConfig.API_URL}`);
});
