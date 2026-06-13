const appConfig = require('../config/appConfig');

const BUCKET = 'loadbase-sessions';
const LABELS_PATH = '_meta/container-labels.json';
const VALID_LABELS = new Set([
  'new',
  'single',
  'double',
  'multi_without_auto',
  'multi_with_auto',
]);

function sessionHeaders(contentType = 'application/json') {
  const key = appConfig.SESSION_SUPABASE_SERVICE_KEY || appConfig.SESSION_SUPABASE_ANON_KEY;
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    'Content-Type': contentType,
  };
}

function isConfigured() {
  const url = appConfig.SESSION_SUPABASE_URL;
  const key = appConfig.SESSION_SUPABASE_SERVICE_KEY || appConfig.SESSION_SUPABASE_ANON_KEY;
  return Boolean(url && key);
}

async function readLabelsMap() {
  if (!isConfigured()) return {};

  const url = appConfig.SESSION_SUPABASE_URL;
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${LABELS_PATH}`, {
    headers: sessionHeaders(),
  });

  if (!res.ok) {
    return {};
  }

  try {
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

async function writeLabelsMap(labels) {
  if (!isConfigured()) {
    throw new Error('Session storage is not configured on the API server.');
  }

  const url = appConfig.SESSION_SUPABASE_URL;
  const body = JSON.stringify(labels, null, 2);
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${LABELS_PATH}`, {
    method: 'POST',
    headers: {
      ...sessionHeaders('application/json'),
      'x-upsert': 'true',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save container labels (${res.status}): ${text}`);
  }

  return labels;
}

function normalizeLabel(label) {
  const value = String(label || 'new').toLowerCase();
  if (!VALID_LABELS.has(value)) {
    throw new Error('Label must be one of: new, single, double, multi_without_auto, multi_with_auto');
  }
  return value;
}

function normalizeContainer(container) {
  const value = String(container || '').toUpperCase().trim();
  if (!value) throw new Error('Container id is required.');
  return value;
}

async function getAllLabels() {
  return readLabelsMap();
}

async function getLabel(container) {
  const labels = await readLabelsMap();
  return labels[normalizeContainer(container)] || 'new';
}

async function setLabel(container, label) {
  const normalizedContainer = normalizeContainer(container);
  const normalizedLabel = normalizeLabel(label);
  const labels = await readLabelsMap();
  labels[normalizedContainer] = normalizedLabel;
  await writeLabelsMap(labels);
  return { container: normalizedContainer, label: normalizedLabel };
}

module.exports = {
  VALID_LABELS: [...VALID_LABELS],
  getAllLabels,
  getLabel,
  setLabel,
};
