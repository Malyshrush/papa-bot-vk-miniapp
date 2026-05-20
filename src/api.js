const API_BASE = import.meta.env.VITE_PAPA_BOT_API_URL || '';

function buildUrl(params = {}) {
  const url = new URL(API_BASE || window.location.origin);
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
    throw new Error(data.message || data.error || '\u041e\u0448\u0438\u0431\u043a\u0430 Mini App');
  }
  return data;
}

function appendLaunchParams(params, launchParams) {
  const next = { ...params };
  Object.entries(launchParams || {}).forEach(([key, value]) => {
    if (key === 'sign' || key.startsWith('vk_')) next[key] = value;
  });
  return next;
}

export function loadGroups(communityId, launchParams) {
  return fetch(buildUrl(appendLaunchParams({ miniapp: 'groups', c: communityId }, launchParams))).then(readJson);
}

export function loadGroup(communityId, slug, launchParams) {
  return fetch(buildUrl(appendLaunchParams({ miniapp: 'group', c: communityId, g: slug }, launchParams))).then(readJson);
}

export function subscribeGroup(communityId, slug, launchParams) {
  return fetch(buildUrl({ miniapp: 'subscribe', c: communityId, g: slug }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams })
  }).then(readJson);
}

export function unsubscribeGroup(communityId, slug, launchParams) {
  return fetch(buildUrl({ miniapp: 'unsubscribe', c: communityId, g: slug }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launchParams })
  }).then(readJson);
}
