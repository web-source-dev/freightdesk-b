const path = require('path');
const fs = require('fs');

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return false;
  }

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
}

const envLoaded = loadDotEnv();
if (envLoaded) {
  console.log('[FreightDesk API] Loaded .env');
}

const cliPortArg = process.argv.find((arg, index) => index >= 2 && /^\d+$/.test(arg));
const cliPort = cliPortArg ? Number(cliPortArg) : null;

const APP_NAME = process.env.APP_NAME || 'FreightDesk';
const APP_COMPANY = process.env.APP_COMPANY || APP_NAME;
const API_PORT = cliPort || Number(process.env.API_PORT || process.env.FREIGHTDESK_API_PORT || 3850);
const API_URL = process.env.FREIGHTDESK_API_URL || `http://localhost:${API_PORT}`;

const SESSION_SUPABASE_URL = process.env.SESSION_SUPABASE_URL || process.env.SUPABASE_URL;
const SESSION_SUPABASE_SERVICE_KEY =
  process.env.SESSION_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SESSION_SUPABASE_ANON_KEY =
  process.env.SESSION_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const USER_SUPABASE_URL = process.env.USER_SUPABASE_URL;
const USER_SUPABASE_SERVICE_KEY = process.env.USER_SUPABASE_SERVICE_KEY;

const API_JWT_SECRET =
  process.env.API_JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? null : 'freightdesk-dev-api-secret-change-me');

module.exports = {
  APP_NAME,
  APP_COMPANY,
  API_PORT,
  API_URL,
  SESSION_SUPABASE_URL,
  SESSION_SUPABASE_SERVICE_KEY,
  SESSION_SUPABASE_ANON_KEY,
  USER_SUPABASE_URL,
  USER_SUPABASE_SERVICE_KEY,
  API_JWT_SECRET,
};
