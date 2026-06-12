#!/usr/bin/env node
/**
 * Verify .env exists and required keys are set before starting PM2.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const required = [
  'API_JWT_SECRET',
  'USER_SUPABASE_URL',
  'USER_SUPABASE_SERVICE_KEY',
  'SESSION_SUPABASE_URL',
  'SESSION_SUPABASE_SERVICE_KEY',
];

if (!fs.existsSync(envPath)) {
  console.error('[check-env] MISSING .env file');
  console.error('[check-env] Run: cp .env.example .env && nano .env');
  process.exit(1);
}

require('../config/appConfig');

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error('[check-env] Missing or empty in .env:');
  missing.forEach((key) => console.error(`  - ${key}`));
  process.exit(1);
}

console.log('[check-env] OK — all required variables are set');
console.log('[check-env] API_PORT:', process.env.API_PORT || '3850');
