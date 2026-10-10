const API_BASE = import.meta.env.VITE_PAPA_BOT_API_URL || '';
const PAPA_BOT_PRODUCTION_API_URL = 'https://functions.yandexcloud.net/d4eg37ikm3vl5tm1mjld';
const REQUEST_TIMEOUT_MS = 30000;
const READ_REQUEST_TIMEOUT_MS = 25000;
const MAX_READ_ATTEMPTS = 2;
const READ_RETRY_DELAY_MS = 500;

function resolveApiBase() {
  if (API_BASE) return API_BASE;
  if (['localhost', '127.0.0.1'].includes(window.location.hostname)) return window.location.origin;
  if (['papabott.ru', 'vk.papabot.ru'].includes(window.location.hostname)) return `${window.location.origin}/api`;
  return PAPA_BOT_PRODUCTION_API_URL;
}

export function resolveMiniAppImageUrl(value) {
  const original = String(value || '').trim();
  if (!original) return '';
  try {
    const image = new URL(original);
    const backend = new URL(PAPA_BOT_PRODUCTION_API_URL);
    const proxy = new URL(resolveApiBase());
    const allowedKeys = new Set(['miniappAsset', 'assetProfile', 'assetCommunity', 'assetExt']);
    const keys = [...image.searchParams.keys()];
    if (proxy.protocol !== 'https:' || proxy.origin !== window.location.origin || proxy.pathname !== '/api'
      || image.origin !== backend.origin || image.pathname !== backend.pathname || image.hash
      || !image.searchParams.get('miniappAsset') || keys.length !== new Set(keys).size
      || keys.some(key => !allowedKeys.has(key))) return original;
    proxy.search = image.search;
    return proxy.toString();
  } catch {
    return original;
  }
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
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') {
    const error = new Error('Сервер вернул некорректный ответ. Повторите загрузку.');
    error.code = 'miniapp_invalid_response';
    error.status = response.status;
    throw error;
  }
  if (!response.ok || data.success === false) {
    const error = new Error(data.message || data.error || '\u041e\u0448\u0438\u0431\u043a\u0430 Mini App');
    error.code = String(data.error || '');
    error.status = response.status;
    throw error;
  }
  if (data.success !== true) {
    const error = new Error('Сервер вернул неполный ответ. Повторите загрузку.');
    error.code = 'miniapp_invalid_response';
    error.status = response.status;
    throw error;
  }
  return data;
}

async function requestJson(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
    return await readJson(response);
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error('Сервер не ответил вовремя. Проверьте интернет и повторите загрузку.');
      timeoutError.code = 'miniapp_timeout';
      throw timeoutError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isTransientReadError(error) {
  const status = Number(error?.status);
  return error?.code === 'miniapp_timeout'
    || error?.code === 'miniapp_invalid_response'
    || error instanceof TypeError
    || status === 429
    || status >= 500 && status <= 599;
}

async function requestReadJson(url) {
  for (let attempt = 1; attempt <= MAX_READ_ATTEMPTS; attempt += 1) {
    try {
      return await requestJson(url, {}, READ_REQUEST_TIMEOUT_MS);
    } catch (error) {
      if (attempt === MAX_READ_ATTEMPTS || !isTransientReadError(error)) throw error;
      await new Promise(resolve => window.setTimeout(resolve, READ_RETRY_DELAY_MS));
    }
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
  return requestReadJson(buildUrl(appendLaunchParams({ miniapp: 'groups', c: communityId }, launchParams)));
}

export function loadGroup(communityId, slug, launchParams) {
  return requestReadJson(buildUrl(appendLaunchParams({ miniapp: 'group', c: communityId, g: slug }, launchParams)));
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
  return requestReadJson(buildUrl(appendLaunchParams({ miniapp: 'admin-groups', c: communityId }, launchParams)));
}

export function createAdminGroup(communityId, group, launchParams) {
  return requestJson(buildUrl({ miniapp: 'admin-create-group', c: communityId }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams, group })
  });
}

export function saveAdminDisplay(communityId, display, launchParams) {
  return requestJson(buildUrl({ miniapp: 'admin-display', c: communityId }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams, display })
  });
}

export function loadWidgets(communityId, launchParams) {
  return requestReadJson(buildUrl(appendLaunchParams({ miniapp: 'widgets', c: communityId }, launchParams)));
}

function widgetAction(action, communityId, payload, launchParams) {
  return requestJson(buildUrl({ miniapp: action, c: communityId }), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams, ...payload })
  });
}

export function saveWidget(communityId, widget, launchParams) {
  return widgetAction('widget-save', communityId, { widget }, launchParams);
}

export function previewWidget(communityId, widgetId, launchParams) {
  return widgetAction('widget-preview', communityId, { widgetId }, launchParams);
}

export function confirmWidget(communityId, widgetId, expectedActiveId, launchParams) {
  return widgetAction('widget-confirm', communityId, { widgetId, expectedActiveId }, launchParams);
}

export function uploadWidgetImageRequest(communityId, payload, launchParams) {
  return requestJson(buildUrl({ miniapp: 'widget-image-upload', c: communityId }), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams, ...payload })
  }, 90000);
}

export function lookupWidgetClientRequest(communityId, payload, launchParams) {
  return widgetAction('widget-client-lookup', communityId, payload, launchParams);
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
