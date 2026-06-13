/**
 * Convert between Puppeteer/DevTools cookie format and DAT session export formats.
 *
 * Input (storage / Puppeteer): expires, size, session, sameSite: "None"|"Lax"|"Strict"
 * Output (export): expirationDate, sameSite: unspecified|lax|strict|no_restriction
 */

function normalizeSameSite(value) {
  if (value == null || value === '') return 'unspecified';
  const v = String(value).toLowerCase();
  if (v === 'none' || v === 'no_restriction') return 'no_restriction';
  if (v === 'lax') return 'lax';
  if (v === 'strict') return 'strict';
  return 'unspecified';
}

function resolveExpirationDate(cookie) {
  if (cookie.expirationDate != null && Number(cookie.expirationDate) > 0) {
    return Number(cookie.expirationDate);
  }
  if (cookie.expires != null && Number(cookie.expires) > 0) {
    return Number(cookie.expires);
  }
  return null;
}

function convertToExportCookie(cookie) {
  if (!cookie || !cookie.name || cookie.value == null || !cookie.domain) {
    return null;
  }

  const result = {
    name: cookie.name,
    value: String(cookie.value),
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: normalizeSameSite(cookie.sameSite),
  };

  const expirationDate = resolveExpirationDate(cookie);
  if (expirationDate != null) {
    result.expirationDate = expirationDate;
  }

  return result;
}

function convertCookiesToExportFormat(cookies) {
  if (!Array.isArray(cookies)) return [];
  return cookies.map(convertToExportCookie).filter(Boolean);
}

function toDatComExport(cookies, { lastUpdated } = {}) {
  const now = lastUpdated || new Date().toISOString();
  return {
    'dat.com': {
      cookies: convertCookiesToExportFormat(cookies),
      lastUpdated: now,
    },
  };
}

function toSessionContainerExport(cookies, options = {}) {
  const now = options.lastUpdated || new Date().toISOString();
  const converted = convertCookiesToExportFormat(cookies);

  return {
    sessionId: options.sessionId || options.container || 'unknown',
    sessionName: options.sessionName || options.container || 'Unknown Session',
    'dat.com': {
      cookies: converted,
      lastUpdated: now,
    },
    lastUpdated: now,
    sourceZipFile: options.sourceZipFile || null,
    extractionDate: now,
    hasCookies: converted.length > 0,
    cookieCount: converted.length,
  };
}

function convertToStorageCookie(cookie) {
  if (!cookie || !cookie.name || cookie.value == null || !cookie.domain) {
    return null;
  }

  const expirationDate = resolveExpirationDate(cookie);
  const isSession = expirationDate == null;

  const result = {
    name: cookie.name,
    value: String(cookie.value),
    domain: cookie.domain,
    path: cookie.path || '/',
    secure: Boolean(cookie.secure),
    httpOnly: Boolean(cookie.httpOnly),
    sameSite: cookie.sameSite || 'Lax',
    session: isSession,
    size: String(cookie.value).length,
    expires: isSession ? -1 : expirationDate,
  };

  return result;
}

function convertCookiesToStorageFormat(cookies) {
  if (!Array.isArray(cookies)) return [];
  return cookies.map(convertToStorageCookie).filter(Boolean);
}

module.exports = {
  normalizeSameSite,
  convertToExportCookie,
  convertCookiesToExportFormat,
  toDatComExport,
  toSessionContainerExport,
  convertToStorageCookie,
  convertCookiesToStorageFormat,
};
