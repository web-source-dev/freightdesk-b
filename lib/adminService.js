const { defaultExpiryIso } = require('./expiry');
const { getUserSupabase } = require('./supabase');
const { syncUserToSessionDb } = require('./authService');
const appConfig = require('../config/appConfig');

const USER_LIST_COLUMNS =
  'id,username,email,phone_support,anydesk_id,data_source_container,accessed_websites,subscription_expiry,max_tabs,max_browser_instances,account_manager,is_blocked,block_reason,role,is_admin,auto_load_enabled,last_login,created_at,updated_at';

function isAdminUser(row) {
  return row.role === 'admin' || row.is_admin === true;
}

function sanitizeUser(row) {
  if (!row) return null;
  const { password, password_hash, device_fingerprint, ...safe } = row;
  return safe;
}

async function verifyAdminCredentials(username, password) {
  const supabase = getUserSupabase();
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !user) throw new Error('Invalid username or password.');
  if (!isAdminUser(user)) throw new Error('This account does not have admin access.');

  const storedPassword = user.password_hash ?? user.password;
  if (storedPassword !== password) throw new Error('Invalid username or password.');

  return sanitizeUser(user);
}

async function listUsers(search = '') {
  const supabase = getUserSupabase();
  let query = supabase.from('users').select(USER_LIST_COLUMNS).order('created_at', { ascending: false });

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(
      `username.ilike.%${term}%,email.ilike.%${term}%,data_source_container.ilike.%${term}%,account_manager.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(sanitizeUser);
}

async function createUser(payload) {
  if (!payload.username?.trim()) throw new Error('Username is required.');
  if (!payload.password?.trim()) throw new Error('Password is required.');
  if (!payload.data_source_container?.trim()) throw new Error('Session container is required.');

  const supabase = getUserSupabase();
  const now = new Date().toISOString();
  const isAdmin = payload.role === 'admin' || payload.is_admin === true;

  const row = {
    username: payload.username.trim(),
    password_hash: payload.password.trim(),
    password: payload.password.trim(),
    email: payload.email?.trim() || null,
    phone_support: payload.phone_support?.trim() || null,
    anydesk_id: payload.anydesk_id?.trim() || null,
    data_source_container: payload.data_source_container.trim().toUpperCase(),
    accessed_websites: payload.accessed_websites?.trim() || '{ datone }',
    subscription_expiry: payload.subscription_expiry || defaultExpiryIso(),
    max_tabs: Number(payload.max_tabs) || 8,
    max_browser_instances: Number(payload.max_browser_instances) || 1,
    account_manager: payload.account_manager?.trim() || null,
    is_blocked: Boolean(payload.is_blocked),
    block_reason: payload.block_reason?.trim() || null,
    role: isAdmin ? 'admin' : 'user',
    is_admin: isAdmin,
    auto_load_enabled: Boolean(payload.auto_load_enabled),
    updated_at: now,
  };

  const { data, error } = await supabase.from('users').insert(row).select(USER_LIST_COLUMNS).single();
  if (error) throw new Error(error.message);

  await syncUserToSessionDb({ ...row, ...data });
  return sanitizeUser(data);
}

async function updateUser(userId, payload) {
  if (!userId) throw new Error('User id is required.');

  const supabase = getUserSupabase();
  const isAdmin = payload.role === 'admin' || payload.is_admin === true;

  const row = {
    username: payload.username?.trim(),
    email: payload.email?.trim() || null,
    phone_support: payload.phone_support?.trim() || null,
    anydesk_id: payload.anydesk_id?.trim() || null,
    data_source_container: payload.data_source_container?.trim().toUpperCase(),
    accessed_websites: payload.accessed_websites?.trim() || '{ datone }',
    subscription_expiry: payload.subscription_expiry || defaultExpiryIso(),
    max_tabs: Number(payload.max_tabs) || 8,
    max_browser_instances: Number(payload.max_browser_instances) || 1,
    account_manager: payload.account_manager?.trim() || null,
    is_blocked: Boolean(payload.is_blocked),
    block_reason: payload.block_reason?.trim() || null,
    role: isAdmin ? 'admin' : 'user',
    is_admin: isAdmin,
    auto_load_enabled: Boolean(payload.auto_load_enabled),
    updated_at: new Date().toISOString(),
  };

  if (payload.password?.trim()) {
    row.password_hash = payload.password.trim();
    row.password = payload.password.trim();
  }

  const { data, error } = await supabase
    .from('users')
    .update(row)
    .eq('id', userId)
    .select(USER_LIST_COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  await syncUserToSessionDb({ ...row, ...data, username: data.username || row.username });
  return sanitizeUser(data);
}

async function deleteUser(userId) {
  if (!userId) throw new Error('User id is required.');
  const supabase = getUserSupabase();
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw new Error(error.message);
  return { success: true };
}

const containerLabelsService = require('./containerLabelsService');

async function listSessionContainerIds() {
  const url = appConfig.SESSION_SUPABASE_URL;
  const key = appConfig.SESSION_SUPABASE_SERVICE_KEY || appConfig.SESSION_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/storage/v1/object/list/loadbase-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: '', limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
    });

    if (!res.ok) return [];

    const items = await res.json();
    const containers = new Set();

    for (const item of items || []) {
      const name = item.name || '';
      const folder = name.split('/')[0];
      if (folder && !folder.includes('.') && folder !== '_meta') {
        containers.add(folder.toUpperCase());
      }
    }

    return [...containers].sort();
  } catch (err) {
    console.warn('[AdminService] Could not list session containers:', err.message);
    return [];
  }
}

async function listSessionContainers() {
  const ids = await listSessionContainerIds();
  const labels = await containerLabelsService.getAllLabels();

  return ids.map((container) => ({
    container,
    label: labels[container] || 'new',
  }));
}

module.exports = {
  verifyAdminCredentials,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listSessionContainerIds,
  listSessionContainers,
  isAdminUser,
};
