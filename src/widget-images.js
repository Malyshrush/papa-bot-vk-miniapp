import bridge from '@vkontakte/vk-bridge';
import { PAPA_BOT_VK_APP_ID } from './vk.js';
import { uploadWidgetImageRequest, lookupWidgetClientRequest } from './api.js';

const TYPES = { tiles_wide: '160x240', tiles_square: '160x160', covers: '510x128',
  list: '50x50', compact_list: '50x50', reviews: '50x50', clients: '50x50' };

async function widgetToken(groupId) {
  const auth = await bridge.send('VKWebAppGetCommunityAuthToken', { app_id: PAPA_BOT_VK_APP_ID, group_id: groupId, scope: 'app_widget' });
  const token = String(auth?.access_token || '');
  if (!token || String(auth?.group_id || groupId) !== String(groupId)) throw new Error('VK не выдал право app_widget для этого сообщества.');
  return token;
}

export async function uploadWidgetImage(communityId, type, file, launchParams) {
  const groupId = Number(communityId);
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error('Не выбрано сообщество VK.');
  if (!TYPES[type]) throw new Error('Неизвестный формат изображения.');
  if (!file || !['image/jpeg', 'image/png'].includes(file.type) || file.size > 1024 * 1024) {
    throw new Error('Подготовленный кадр должен быть JPG или PNG размером до 1 МБ.');
  }
  const token = await widgetToken(groupId);
  const imageBase64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать подготовленный кадр.'));
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.readAsDataURL(file);
  });
  try {
    const image = await uploadWidgetImageRequest(groupId, { type, mimeType: file.type, imageBase64, communityToken: token }, launchParams);
    return { imageId: image.imageId, imageUrl: image.imageUrl };
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Не удалось связаться с сервером загрузки. Проверьте интернет и повторите попытку.');
    throw error;
  }
}

export async function resolveWidgetClient(communityId, rawLink, launchParams) {
  const groupId = Number(communityId);
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error('Не выбрано сообщество VK.');
  const token = await widgetToken(groupId);
  try {
    const result = await lookupWidgetClientRequest(groupId, { rawLink, communityToken: token }, launchParams);
    return { title: result.title, url: result.url, imageId: result.imageId, imageUrl: result.imageUrl };
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Не удалось связаться с сервером. Проверьте интернет и повторите поиск клиента.');
    throw error;
  }
}
