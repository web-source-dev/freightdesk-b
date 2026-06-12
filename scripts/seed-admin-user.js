/**
 * Create users table (if needed) and seed default admin user.
 *
 * Usage (from freightdesk-api):
 *   npm run seed:admin
 *
 * Requires in freightdesk-api/.env:
 *   USER_SUPABASE_URL
 *   USER_SUPABASE_SERVICE_KEY
 *
 * For first-time setup (table missing), also set ONE of:
 *   USER_SUPABASE_DB_PASSWORD   (from Supabase → Project Settings → Database)
 *   USER_DATABASE_URL             (full postgres connection string)
 */
const fs = require('fs');
const path = require('path');

require('../config/appConfig');
const { getUserSupabase } = require('../lib/supabase');

const USERNAME = process.env.ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@FreightDesk2026';
const CONTAINER = (process.env.ADMIN_CONTAINER || 'A').toUpperCase();

function getProjectRef() {
  const match = (process.env.USER_SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
}

function getDatabaseUrl() {
  if (process.env.USER_DATABASE_URL) return process.env.USER_DATABASE_URL;

  const password = process.env.USER_SUPABASE_DB_PASSWORD;
  const ref = getProjectRef();
  if (!password || !ref) return null;

  const poolerHost = process.env.USER_SUPABASE_POOLER_HOST || 'aws-1-ap-northeast-1.pooler.supabase.com';
  const poolerPort = process.env.USER_SUPABASE_POOLER_PORT || '5432';
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolerHost}:${poolerPort}/postgres`;
}

async function runSqlFileViaPostgres() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) return false;

  let pg;
  try {
    pg = require('pg');
  } catch {
    throw new Error('Install pg first: npm install --save-dev pg');
  }

  const sqlPath = path.join(__dirname, 'user-db-schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log('[seed] Ran user-db-schema.sql via postgres connection');
    return true;
  } finally {
    await client.end();
  }
}

async function seedViaSupabaseClient() {
  const supabase = getUserSupabase();

  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('id, username')
    .eq('username', USERNAME)
    .maybeSingle();

  if (lookupError) {
    if (/schema cache|does not exist|relation.*users/i.test(lookupError.message)) {
      return { tableMissing: true };
    }
    throw new Error(lookupError.message);
  }

  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);

  const row = {
    username: USERNAME,
    password_hash: PASSWORD,
    password: PASSWORD,
    email: `${USERNAME}@freightdesk.local`,
    data_source_container: CONTAINER,
    accessed_websites: '{ datone }',
    subscription_expiry: expiry.toISOString(),
    max_tabs: 8,
    max_browser_instances: 1,
    role: 'admin',
    is_admin: true,
    is_blocked: false,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabase
      .from('users')
      .update(row)
      .eq('id', existing.id)
      .select('id, username, role, is_admin, data_source_container, subscription_expiry')
      .single();
    if (error) throw new Error(error.message);
    return { tableMissing: false, action: 'updated', data };
  }

  row.created_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('users')
    .insert(row)
    .select('id, username, role, is_admin, data_source_container, subscription_expiry')
    .single();
  if (error) throw new Error(error.message);
  return { tableMissing: false, action: 'created', data };
}

async function main() {
  let result = await seedViaSupabaseClient();

  if (result.tableMissing) {
    console.log('[seed] users table not found — creating schema via postgres...');
    const ran = await runSqlFileViaPostgres();
    if (!ran) {
      const ref = getProjectRef();
      console.error(`
Could not create the users table automatically.

Add your Supabase database password to freightdesk-api/.env:
  USER_SUPABASE_DB_PASSWORD=your-password

(Find it in Supabase Dashboard → Project Settings → Database → Database password)

Then run again:
  npm run seed:admin

Or paste scripts/user-db-schema.sql into the SQL editor:
  https://supabase.com/dashboard/project/${ref || 'YOUR_PROJECT_REF'}/sql/new
`);
      process.exit(1);
    }
    result = await seedViaSupabaseClient();
    if (result.tableMissing) {
      throw new Error('Table still missing after schema migration.');
    }
  }

  console.log(`[seed] Admin user ${result.action}:`);
  console.log(JSON.stringify(result.data, null, 2));
  console.log('\nAdmin login:');
  console.log(`  Username: ${USERNAME}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  Session container: ${CONTAINER}`);
}

main().catch((err) => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
