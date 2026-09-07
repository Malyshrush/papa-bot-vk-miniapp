import bridge from '@vkontakte/vk-bridge';

const VK_BRIDGE_TIMEOUT_MS = 7000;
const VK_AUTH_TIMEOUT_MS = 120000;
export const PAPA_BOT_VK_APP_ID = Number(import.meta.env.VITE_VK_APP_ID || 54600849);
export const VK_USER_TOKEN_SCOPES = Object.freeze(['groups', 'photos', 'video', 'docs', 'wall', 'market']);

function sendBridgeWithTimeout(method, params, timeoutMessage, timeoutMs = VK_BRIDGE_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
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
  const handoff = String(params.get('handoff') || '').trim();
  return {
    communityId: params.get('c') || '',
    slug: params.get('g') || '',
    admin: params.get('admin') === '1',
    handoff,
    handoffTicket: params.get('t') || '',
    connectUserToken: handoff === 'user_token'
  };
}

export function setGroupHash(communityId, slug = '') {
  const params = new URLSearchParams();
  if (communityId) params.set('c', communityId);
  if (slug) params.set('g', slug);
  window.location.hash = params.toString();
}

function normalizeCommunityId(value) {
  const normalized = String(value || '').trim().replace(/^-/, '');
  return /^\d+$/.test(normalized) ? normalized : '';
}

export function buildMiniAppRedirectUrl(mode, customUrl, communityId) {
  const normalizedCommunityId = normalizeCommunityId(communityId);
  if (mode === 'messages') {
    return normalizedCommunityId ? `https://vk.com/im?sel=-${normalizedCommunityId}` : '';
  }
  if (mode === 'community') {
    return normalizedCommunityId ? `https://vk.com/club${normalizedCommunityId}` : '';
  }
  if (mode !== 'url') {
    return '';
  }

  try {
    const parsed = new URL(String(customUrl || '').trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.toString();
  } catch (error) {
    return '';
  }
}

export function openMiniAppRedirect(mode, customUrl, communityId) {
  const redirectUrl = buildMiniAppRedirectUrl(mode, customUrl, communityId);
  if (!redirectUrl) {
    return false;
  }
  window.open(redirectUrl, '_blank', 'noopener,noreferrer');
  return true;
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
    'VK не отвечает. Откройте Приложение авторизовавшись в VK или повторите попытку.'
  );
}

export async function addMiniAppToCommunity() {
  return sendBridgeWithTimeout(
    'VKWebAppAddToCommunity',
    { hide_success_modal: false },
    'VK не отвечает. Откройте Mini App внутри VK и повторите попытку.'
  );
}

export async function requestPapaBotUserToken() {
  const result = await sendBridgeWithTimeout(
    'VKWebAppGetAuthToken',
    { app_id: PAPA_BOT_VK_APP_ID, scope: VK_USER_TOKEN_SCOPES.join(',') },
    'VK не завершил авторизацию. Повторите вход и подтвердите разрешения.',
    VK_AUTH_TIMEOUT_MS
  );
  const accessToken = String(result?.access_token || '').trim();
  if (!accessToken) {
    throw new Error('VK не выдал ключ доступа. Повторите вход и подтвердите разрешения.');
  }
  return { accessToken, scope: String(result?.scope || VK_USER_TOKEN_SCOPES.join(',')) };
}

export async function openExternalServiceLink(url) {
  let serviceUrl;
  try {
    const parsedUrl = new URL(String(url || '').trim());
    if (parsedUrl.protocol !== 'https:') return false;
    serviceUrl = parsedUrl.toString();
  } catch (error) {
    return false;
  }

  try {
    await sendBridgeWithTimeout(
      'VKWebAppOpenLink',
      { url: serviceUrl },
      'VK не отвечает. Открываем сервис в отдельной вкладке.'
    );
    return true;
  } catch (error) {
    window.open(serviceUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
}
