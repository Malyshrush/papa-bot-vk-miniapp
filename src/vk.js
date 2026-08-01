import bridge from '@vkontakte/vk-bridge';

const VK_BRIDGE_TIMEOUT_MS = 7000;

function sendBridgeWithTimeout(method, params, timeoutMessage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), VK_BRIDGE_TIMEOUT_MS);
  });
  return Promise.race([bridge.send(method, params), timeout])
    .finally(() => window.clearTimeout(timeoutId));
}

export function parseLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  const result = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function parseRouteHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw);
  return {
    communityId: params.get('c') || '',
    slug: params.get('g') || ''
  };
}

export function setGroupHash(communityId, slug = '') {
  const params = new URLSearchParams();
  if (communityId) params.set('c', communityId);
  if (slug) params.set('g', slug);
  window.location.hash = params.toString();
}

export async function initVkBridge() {
  try {
    await sendBridgeWithTimeout(
      'VKWebAppInit',
      {},
      '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0438\u043d\u0438\u0446\u0438\u0430\u043b\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c VK Mini App'
    );
  } catch (error) {
    return false;
  }
  return true;
}

export async function allowMessagesFromGroup(communityId) {
  const groupId = Number(communityId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw new Error('\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u0438\u0442\u044c VK ID \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0430');
  }
  return sendBridgeWithTimeout(
    'VKWebAppAllowMessagesFromGroup',
    { group_id: groupId },
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u043b\u0443\u0447\u0438\u0442\u044c \u043e\u0442\u0432\u0435\u0442 VK. \u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 Mini App \u0432\u043d\u0443\u0442\u0440\u0438 VK \u0438 \u043f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435.'
  );
}
