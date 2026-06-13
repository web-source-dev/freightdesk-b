const appConfig = require('../config/appConfig');
const {
  convertCookiesToExportFormat,
  toDatComExport,
  toSessionContainerExport,
} = require('./cookieFormat');

const BUCKET = 'loadbase-sessions';

function sessionHeaders() {
  const key = appConfig.SESSION_SUPABASE_SERVICE_KEY || appConfig.SESSION_SUPABASE_ANON_KEY;
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': 'application/json',
  };
}

async function listStorageFiles(containerId, limit = 10) {
  const url = appConfig.SESSION_SUPABASE_URL;
  if (!url) throw new Error('Session storage is not configured on the API server.');

  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: sessionHeaders(),
    body: JSON.stringify({
      prefix: `${containerId}/`,
      limit,
      sortBy: { column: 'updated_at', order: 'desc' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Storage list failed (${res.status})`);
  }

  return res.json();
}

async function downloadStorageObject(containerId, fileName) {
  const url = appConfig.SESSION_SUPABASE_URL;
  const key = appConfig.SESSION_SUPABASE_SERVICE_KEY || appConfig.SESSION_SUPABASE_ANON_KEY;
  const objectPath = `${containerId}/${fileName}`;

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${objectPath}`, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });

  if (!res.ok) {
    return null;
  }

  const text = await res.text();
  if (fileName.endsWith('.json')) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  return text.trim();
}

async function downloadSession(containerId, options = {}) {
  if (!containerId) {
    return { success: false, message: 'Container id is required.' };
  }

  const normalized = String(containerId).toUpperCase();
  const format = options.format || 'raw';

  try {
    const cookies = await downloadStorageObject(normalized, 'cookies.json');
    const localStorage = await downloadStorageObject(normalized, 'localStorage.json');
    const sessionStorage = await downloadStorageObject(normalized, 'sessionStorage.json');
    const userAgent = await downloadStorageObject(normalized, 'user-agent.txt');

    if (!cookies || (Array.isArray(cookies) && cookies.length === 0)) {
      return {
        success: false,
        message: `No session cookies found for container ${normalized}.`,
      };
    }

    const cookieArray = Array.isArray(cookies) ? cookies : [];
    const components = [cookies, localStorage, sessionStorage, userAgent].filter(Boolean).length;

    let exportData;
    if (format === 'datcom') {
      exportData = toDatComExport(cookieArray);
    } else if (format === 'session') {
      exportData = toSessionContainerExport(cookieArray, {
        sessionId: normalized,
        sessionName: options.sessionName || `Container ${normalized}`,
        container: normalized,
      });
    } else {
      exportData = {
        cookies: cookieArray,
        localStorage: localStorage && typeof localStorage === 'object' ? localStorage : {},
        sessionStorage: sessionStorage && typeof sessionStorage === 'object' ? sessionStorage : {},
        userAgent: typeof userAgent === 'string' ? userAgent : '',
      };
    }

    return {
      success: true,
      message: `Loaded ${components} session components into RAM for account ${normalized}`,
      format,
      data: exportData,
      meta: {
        container: normalized,
        cookieCount: cookieArray.length,
        exportCookieCount:
          format === 'raw' ? cookieArray.length : convertCookiesToExportFormat(cookieArray).length,
      },
    };
  } catch (err) {
    return { success: false, message: err.message || 'Session download failed.' };
  }
}

async function checkForNewSession(containerId, sinceIso) {
  const files = await listStorageFiles(containerId, 10);
  const cookiesFile = (files || []).find((f) => f.name === 'cookies.json');
  if (!cookiesFile?.updated_at) {
    return { hasNew: false, cookiesUpdatedAt: null };
  }

  const cookiesUpdatedAt = cookiesFile.updated_at;
  const since = sinceIso ? new Date(sinceIso) : null;
  const fileUpdatedAt = new Date(cookiesUpdatedAt);
  const hasNew = since ? fileUpdatedAt > since : false;

  return { hasNew, cookiesUpdatedAt };
}

module.exports = {
  downloadSession,
  checkForNewSession,
  listStorageFiles,
};
