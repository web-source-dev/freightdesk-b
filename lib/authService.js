const { defaultExpiryIso } = require('./expiry');
const { getUserSupabase, getSessionSupabase } = require('./supabase');

async function syncUserToSessionDb(userRow) {
  let sessionSupabase;
  try {
    sessionSupabase = getSessionSupabase();
  } catch {
    return;
  }

  if (!userRow?.username) return;

  const subscriptionExpiry = userRow.subscription_expiry || defaultExpiryIso();
  const now = new Date().toISOString();
  const payload = {
    username: userRow.username,
    email: userRow.email || `${userRow.username}@local`,
    data_source_container: (userRow.data_source_container || 'A').toUpperCase(),
    accessed_websites: userRow.accessed_websites || '{ datone }',
    subscription_expiry: subscriptionExpiry,
    max_tabs: userRow.max_tabs ?? 8,
    max_browser_instances: userRow.max_browser_instances ?? 1,
    account_manager: userRow.account_manager || null,
    phone_support: userRow.phone_support || null,
    anydesk_id: userRow.anydesk_id || null,
    is_blocked: Boolean(userRow.is_blocked),
    block_reason: userRow.block_reason || null,
    role: userRow.role || 'user',
    is_admin: Boolean(userRow.is_admin || userRow.role === 'admin'),
    auto_load_enabled: Boolean(userRow.auto_load_enabled),
    updated_at: now,
  };

  if (userRow.password_hash || userRow.password) {
    payload.password_hash = userRow.password_hash || userRow.password;
    payload.password = userRow.password || userRow.password_hash;
  }

  const { data: existing, error: lookupError } = await sessionSupabase
    .from('users')
    .select('id')
    .eq('username', userRow.username)
    .maybeSingle();

  if (lookupError) {
    console.warn('[SyncUser] Session DB lookup failed:', lookupError.message);
    return;
  }

  if (existing?.id) {
    const { error } = await sessionSupabase.from('users').update(payload).eq('id', existing.id);
    if (error) console.warn('[SyncUser] Session DB update failed:', error.message);
    return;
  }

  const { error } = await sessionSupabase.from('users').insert({ ...payload, created_at: now });
  if (error) console.warn('[SyncUser] Session DB insert failed:', error.message);
}

function mapUserRow(row) {
  const subscriptionExpiry = row.subscription_expiry || defaultExpiryIso();

  return {
    id: row.id,
    username: row.username,
    email: row.email || `${row.username}@local`,
    role: row.role || 'user',
    max_tabs: row.max_tabs ?? 8,
    max_browser_instances: row.max_browser_instances || 1,
    expiry: subscriptionExpiry,
    subscription_expiry: subscriptionExpiry,
    account_manager: row.account_manager,
    data_source_container: row.data_source_container || 'A',
    accessedWebsites: row.accessed_websites || '{ datone }',
    auto_load_enabled: row.auto_load_enabled || false,
    phone_support: row.phone_support,
    anydesk_id: row.anydesk_id,
    is_blocked: row.is_blocked,
  };
}

async function signIn(username, password, deviceFingerprint = null) {
  const supabase = getUserSupabase();

  const { data: userRow, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !userRow) {
    throw new Error(`Username "${username}" not found. Please check your username and try again.`);
  }

  if (userRow.is_blocked) {
    const reason = userRow.block_reason || 'Account blocked';
    throw new Error(
      `Your account has been blocked. Reason: ${reason}. Contact ${userRow.account_manager || 'support'}.`
    );
  }

  if (userRow.subscription_expiry && new Date(userRow.subscription_expiry) < new Date()) {
    throw new Error(
      `Your subscription expired on ${new Date(userRow.subscription_expiry).toLocaleDateString()}. Contact ${userRow.account_manager || 'support'} to renew.`
    );
  }

  const storedPassword = userRow.password_hash ?? userRow.password;
  if (storedPassword !== password) {
    throw new Error(`Invalid password for "${username}". Please check your password and try again.`);
  }

  if (deviceFingerprint) {
    if (!userRow.device_fingerprint || userRow.device_fingerprint !== deviceFingerprint) {
      await supabase
        .from('users')
        .update({
          device_fingerprint: deviceFingerprint,
          device_registered_at: new Date().toISOString(),
          last_device_change: new Date().toISOString(),
        })
        .eq('id', userRow.id);
    }
  }

  await supabase
    .from('users')
    .update({ failed_login_attempts: 0, last_login: new Date().toISOString() })
    .eq('id', userRow.id);

  await syncUserToSessionDb({
    ...userRow,
    password_hash: storedPassword,
    password: storedPassword,
  });

  return mapUserRow(userRow);
}

async function getUserById(userId) {
  const supabase = getUserSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
  if (error || !data) return null;

  const { password, password_hash, device_fingerprint, ...safe } = data;
  return safe;
}

module.exports = {
  signIn,
  mapUserRow,
  getUserById,
  syncUserToSessionDb,
};
