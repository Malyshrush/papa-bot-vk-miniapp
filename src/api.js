const API_BASE = import.meta.env.VITE_PAPA_BOT_API_URL || '';
const PAPA_BOT_PRODUCTION_API_URL = 'https://functions.yandexcloud.net/d4eg37ikm3vl5tm1mjld';
const REQUEST_TIMEOUT_MS = 12000;

function resolveApiBase() {
  if (API_BASE) return API_BASE;
  if (window.location.hostname === 'malyshrush.github.io') return PAPA_BOT_PRODUCTION_API_URL;
  return window.location.origin;
}

function buildUrl(params = {}) {
  const url = new URL(resolveApiBase());
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || '\u041e\u0448\u0438\u0431\u043a\u0430 Mini App');
    error.code = String(data.error || '');
    throw error;
  }
  return data;
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
    return await readJson(response);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0431\u044b\u0441\u0442\u0440\u043e \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043e\u0442\u0432\u0435\u0442 Mini App. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function appendLaunchParams(params, launchParams) {
  const next = { ...params };
  Object.entries(launchParams || {}).forEach(([key, value]) => {
    if (key === 'sign' || key.startsWith('vk_')) next[key] = value;
  });
  return next;
}

export function loadGroups(communityId, launchParams) {
  return requestJson(buildUrl(appendLaunchParams({ miniapp: 'groups', c: communityId }, launchParams)));
}

export function loadGroup(communityId, slug, launchParams) {
  return requestJson(buildUrl(appendLaunchParams({ miniapp: 'group', c: communityId, g: slug }, launchParams)));
}

export function subscribeGroup(communityId, slug, launchParams) {
  return requestJson(buildUrl({ miniapp: 'subscribe', c: communityId, g: slug }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams })
  });
}

export function unsubscribeGroup(communityId, slug, launchParams) {
  return requestJson(buildUrl({ miniapp: 'unsubscribe', c: communityId, g: slug }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams })
  });
}

export function loadAdminGroups(communityId, launchParams) {
  return requestJson(buildUrl(appendLaunchParams({ miniapp: 'admin-groups', c: communityId }, launchParams)));
}

export function createAdminGroup(communityId, group, launchParams) {
  return requestJson(buildUrl({ miniapp: 'admin-create-group', c: communityId }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams, group })
  });
}

export function completeVkHandoff(ticket, payload, launchParams) {
  return requestJson(buildUrl({ miniapp: 'complete-handoff' }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, ...(payload || {}), launchParams })
  });
}

export function failVkHandoff(ticket, reason, launchParams) {
  return requestJson(buildUrl({ miniapp: 'fail-handoff' }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, reason, launchParams })
  });
}

export function createCabinetLogin(launchParams) {
  return requestJson(buildUrl({ miniapp: 'create-cabinet-login' }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams })
  });
}
