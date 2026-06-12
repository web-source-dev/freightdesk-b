/**
 * Shim for legacy proxyManager — uses server-side session Supabase only.
 */
const { getSessionSupabase } = require('../../supabase');
const appConfig = require('../../../config/appConfig');

const supabase = getSessionSupabase();

module.exports = {
  supabase,
  SUPABASE_URL: appConfig.SESSION_SUPABASE_URL,
  SUPABASE_ANON_KEY: appConfig.SESSION_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_KEY: appConfig.SESSION_SUPABASE_SERVICE_KEY || '',
};
