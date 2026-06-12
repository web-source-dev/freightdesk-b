const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const appConfig = require('../config/appConfig');

let userSupabase = null;
let sessionSupabase = null;

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
};

function getUserSupabase() {
  if (userSupabase) return userSupabase;

  const { USER_SUPABASE_URL, USER_SUPABASE_SERVICE_KEY } = appConfig;
  if (!USER_SUPABASE_URL || !USER_SUPABASE_SERVICE_KEY) {
    throw new Error('USER_SUPABASE_URL and USER_SUPABASE_SERVICE_KEY must be set in .env');
  }

  userSupabase = createClient(USER_SUPABASE_URL, USER_SUPABASE_SERVICE_KEY, clientOptions);

  return userSupabase;
}

function getSessionSupabase() {
  if (sessionSupabase) return sessionSupabase;

  const url = appConfig.SESSION_SUPABASE_URL;
  const key = appConfig.SESSION_SUPABASE_SERVICE_KEY || appConfig.SESSION_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SESSION_SUPABASE_URL and SESSION_SUPABASE_SERVICE_KEY must be set in .env');
  }

  sessionSupabase = createClient(url, key, clientOptions);

  return sessionSupabase;
}

module.exports = { getUserSupabase, getSessionSupabase };
