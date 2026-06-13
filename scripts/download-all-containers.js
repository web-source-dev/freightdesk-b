#!/usr/bin/env node
/**
 * Download DAT session files for every container in Supabase Storage.
 *
 * Modes:
 *   Local (default) — uses SESSION_SUPABASE_* from freightdesk-api/.env
 *   Remote          — admin login + API loop (--api-url or FREIGHTDESK_API_URL)
 *
 * Usage:
 *   cd freightdesk-api
 *   node scripts/download-all-containers.js
 *   node scripts/download-all-containers.js --out ./backups/sessions
 *   node scripts/download-all-containers.js --api-url https://freightdesk.rtnglobal.co
 *
 * Env (remote mode):
 *   ADMIN_USERNAME, ADMIN_PASSWORD
 */
const fs = require('fs');
const path = require('path');
const {
  toDatComExport,
  toSessionContainerExport,
} = require('../lib/cookieFormat');

const SESSION_FILES = ['cookies.json', 'localStorage.json', 'sessionStorage.json', 'user-agent.txt'];

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = { out: path.join(process.cwd(), 'downloaded-sessions'), apiUrl: null, containers: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out' && argv[i + 1]) {
      args.out = path.resolve(argv[++i]);
    } else if ((arg === '--api-url' || arg === '--url') && argv[i + 1]) {
      args.apiUrl = argv[++i].replace(/\/$/, '');
    } else if (arg === '--containers' && argv[i + 1]) {
      args.containers = argv[++i]
        .split(',')
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  if (!args.apiUrl) {
    args.apiUrl = (process.env.FREIGHTDESK_API_URL || '').replace(/\/$/, '') || null;
  }
  return args;
}

function printHelp() {
  console.log(`
Download all DAT session containers to disk.

  node scripts/download-all-containers.js [options]

Options:
  --out <dir>           Output folder (default: ./downloaded-sessions)
  --api-url <url>       Use remote API + admin login (else local .env storage)
  --containers A,B,P    Only these containers (default: all in storage)
  --help                Show this help

Remote env:
  ADMIN_USERNAME, ADMIN_PASSWORD
`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, String(text ?? ''), 'utf8');
}

function saveSessionBundle(outDir, container, data) {
  const containerDir = path.join(outDir, container);
  ensureDir(containerDir);

  const cookies = data.cookies || [];
  writeJson(path.join(containerDir, 'cookies.json'), cookies);
  writeJson(path.join(containerDir, 'localStorage.json'), data.localStorage || {});
  writeJson(path.join(containerDir, 'sessionStorage.json'), data.sessionStorage || {});
  writeText(path.join(containerDir, 'user-agent.txt'), data.userAgent || '');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  writeJson(path.join(containerDir, `dat.com_cookies_${timestamp}.json`), toDatComExport(cookies));
  writeJson(
    path.join(containerDir, `${container}.json`),
    toSessionContainerExport(cookies, {
      sessionId: container,
      sessionName: `Container ${container}`,
      container,
    })
  );

  writeJson(path.join(containerDir, 'manifest.json'), {
    container,
    downloadedAt: new Date().toISOString(),
    cookieCount: Array.isArray(cookies) ? cookies.length : 0,
    localStorageKeys: Object.keys(data.localStorage || {}).length,
    sessionStorageKeys: Object.keys(data.sessionStorage || {}).length,
    hasUserAgent: Boolean(data.userAgent),
    exportFormats: ['cookies.json', `dat.com_cookies_${timestamp}.json`, `${container}.json`],
  });

  return containerDir;
}

async function apiRequest(baseUrl, route, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

async function adminLogin(baseUrl, username, password) {
  const result = await apiRequest(baseUrl, '/api/admin/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  if (!result?.token) throw new Error('Admin login did not return a token.');
  return result.token;
}

async function downloadViaRemoteApi(args) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in .env for remote mode.');
  }

  console.log(`[Remote] API: ${args.apiUrl}`);
  console.log('[Remote] Admin login...');
  const token = await adminLogin(args.apiUrl, username, password);

  let containers = args.containers;
  if (!containers?.length) {
    console.log('[Remote] Listing containers...');
    containers = await apiRequest(args.apiUrl, '/api/admin/containers', { token });
  }

  if (!containers?.length) {
    console.warn('[Remote] No containers found in storage.');
    return { containers: [], ok: [], failed: [] };
  }

  console.log(`[Remote] Found ${containers.length} container(s): ${containers.join(', ')}`);

  const ok = [];
  const failed = [];

  for (const container of containers) {
    const label = String(container).toUpperCase();
    process.stdout.write(`[Remote] Downloading ${label}... `);
    try {
      const result = await apiRequest(args.apiUrl, `/api/admin/sessions/download/${label}`, {
        token,
      });
      if (!result?.success || !result.data) {
        throw new Error(result?.message || 'Empty session payload');
      }
      const dir = saveSessionBundle(args.out, label, result.data);
      ok.push(label);
      console.log(`OK → ${dir}`);
    } catch (err) {
      failed.push({ container: label, error: err.message });
      console.log(`FAILED (${err.message})`);
    }
  }

  return { containers, ok, failed };
}

async function downloadViaLocalStorage(args) {
  loadDotEnv();
  const adminService = require('../lib/adminService');
  const sessionStorageService = require('../lib/sessionStorageService');

  let containers = args.containers;
  if (!containers?.length) {
    console.log('[Local] Listing containers from Supabase Storage...');
    containers = await adminService.listSessionContainers();
  }

  if (!containers?.length) {
    console.warn('[Local] No containers found in storage.');
    return { containers: [], ok: [], failed: [] };
  }

  console.log(`[Local] Found ${containers.length} container(s): ${containers.join(', ')}`);

  const ok = [];
  const failed = [];

  for (const container of containers) {
    const label = String(container).toUpperCase();
    process.stdout.write(`[Local] Downloading ${label}... `);
    try {
      const result = await sessionStorageService.downloadSession(label);
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Empty session payload');
      }
      const dir = saveSessionBundle(args.out, label, result.data);
      ok.push(label);
      console.log(`OK → ${dir}`);
    } catch (err) {
      failed.push({ container: label, error: err.message });
      console.log(`FAILED (${err.message})`);
    }
  }

  return { containers, ok, failed };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  ensureDir(args.out);
  console.log(`Output directory: ${args.out}`);

  const useRemote = Boolean(args.apiUrl);
  const summary = useRemote ? await downloadViaRemoteApi(args) : await downloadViaLocalStorage(args);

  const summaryPath = path.join(args.out, 'download-summary.json');
  writeJson(summaryPath, {
    mode: useRemote ? 'remote' : 'local',
    apiUrl: useRemote ? args.apiUrl : null,
    finishedAt: new Date().toISOString(),
    total: summary.containers.length,
    succeeded: summary.ok,
    failed: summary.failed,
  });

  console.log('\n--- Summary ---');
  console.log(`Succeeded: ${summary.ok.length}/${summary.containers.length}`);
  if (summary.failed.length) {
    console.log('Failed:');
    for (const item of summary.failed) {
      console.log(`  - ${item.container}: ${item.error}`);
    }
  }
  console.log(`Summary written to ${summaryPath}`);

  process.exit(summary.failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[download-all-containers]', err.message);
  process.exit(1);
});
