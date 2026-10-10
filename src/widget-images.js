import bridge from '@vkontakte/vk-bridge';
import { PAPA_BOT_VK_APP_ID } from './vk.js';

const API_BASE = 'https://api.vk.com/method/';
const TYPES = { tiles_wide: '160x240', tiles_square: '160x160', covers: '510x128',
  list: '50x50', compact_list: '50x50', reviews: '50x50', clients: '50x50' };

function assertVkUploadUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || !['vk.com', 'vk.ru', 'userapi.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
    throw new Error('VK вернул небезопасный адрес загрузки. Изображение не отправлено.');
  }
  return url.toString();
}

async function widgetToken(groupId) {
  const auth = await bridge.send('VKWebAppGetCommunityAuthToken', { app_id: PAPA_BOT_VK_APP_ID, group_id: groupId, scope: 'app_widget' });
  const token = String(auth?.access_token || '');
  if (!token || String(auth?.group_id || groupId) !== String(groupId)) throw new Error('VK не выдал право app_widget для этого сообщества.');
  return token;
}

async function readLimitedJson(response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 262144) throw new Error('VK вернул слишком большой ответ.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('VK вернул пустой ответ.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 262144) { await reader.cancel(); throw new Error('VK вернул слишком большой ответ.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const text = new TextDecoder().decode(bytes);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('VK вернул некорректный ответ.'); }
  if (!response.ok || data?.error) {
    const code = Number(data?.error?.error_code || data?.error || 0);
    throw new Error(code ? `VK отклонил изображение (код ${code}). Черновик сохранён.` : 'VK не принял изображение. Черновик сохранён.');
  }
  return data;
}

async function vkMethod(method, params, token) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const body = new URLSearchParams({ ...params, access_token: token, v: '5.199' });
    return await readLimitedJson(await fetch(`${API_BASE}${method}`, { method: 'POST', body, signal: controller.signal }));
  } finally { window.clearTimeout(timeout); }
}

export async function uploadWidgetImage(communityId, type, file) {
  const groupId = Number(communityId);
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error('Не выбрано сообщество VK.');
  if (!TYPES[type]) throw new Error('Неизвестный формат изображения.');
  if (!file || !['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Выберите JPG или PNG до 5 МБ.');
  }
  const token = await widgetToken(groupId);
  const server = await vkMethod('appWidgets.getGroupImageUploadServer', { image_type: TYPES[type] }, token);
  const uploadUrl = assertVkUploadUrl(server?.response?.upload_url);
  const form = new FormData();
  form.append('photo', file);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60000);
  let uploaded;
  try { uploaded = await readLimitedJson(await fetch(uploadUrl, { method: 'POST', body: form, signal: controller.signal })); }
  finally { window.clearTimeout(timeout); }
  const saved = await vkMethod('appWidgets.saveGroupImage', { image: uploaded.image, hash: uploaded.hash }, token);
  const image = saved?.response;
  const id = String(image?.id || '');
  const url = image?.images?.find(entry => entry.url && entry.width >= 50)?.url || '';
  if (!/^\d+_\d+$/.test(id)) throw new Error('VK не подтвердил сохранение изображения.');
  return { imageId: id, imageUrl: url };
}

export async function resolveWidgetClient(communityId, rawLink) {
  const groupId = Number(communityId);
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error('Не выбрано сообщество VK.');
  let link;
  try { link = new URL(String(rawLink || '')); } catch { throw new Error('Укажите ссылку на сообщество VK.'); }
  if (link.protocol !== 'https:' || !['vk.ru', 'vk.com'].includes(link.hostname) || link.username || link.password
    || !/^\/(?:club|public)?[a-zA-Z0-9_.-]{2,80}\/?$/.test(link.pathname)) {
    throw new Error('Укажите прямую HTTPS-ссылку на сообщество VK.');
  }
  const screenName = link.pathname.replace(/^\//, '').replace(/\/$/, '');
  const token = await widgetToken(groupId);
  const result = await vkMethod('groups.getById', { group_id: screenName, fields: 'photo_50' }, token);
  const group = result?.response?.groups?.[0];
  const id = Number(group?.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !group?.name) throw new Error('VK не нашёл это сообщество. Проверьте ссылку.');
  return { title: String(group.name), url: `https://vk.ru/club${id}`, imageId: `club${id}`, imageUrl: String(group.photo_50 || '') };
}
