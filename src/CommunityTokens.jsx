import { useEffect, useRef, useState } from 'react';
import { loadCommunityTokenStatus, saveCommunityToken } from './api.js';
import { requestCommunityToken } from './vk.js';

export default function CommunityTokens({ communityId, launchParams, onOpenCabinet }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const importedKey = useRef(null);
  const generation = useRef(0);
  const admin = launchParams.vk_viewer_group_role === 'admin';
  useEffect(() => {
    const attempt = ++generation.current;
    setStatus(null); setError(''); setNotice(''); setBusy(false); setImportOpen(false);
    if (importedKey.current) importedKey.current.value = '';
    if (admin) loadCommunityTokenStatus(communityId, launchParams).then(data => {
      if (attempt === generation.current) setStatus(data.status);
    }).catch(() => { if (attempt === generation.current) setError('Счётчик ключей пока недоступен. Повторите запрос.'); });
    return () => { ++generation.current; };
  }, [communityId, launchParams, admin]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const obtain = async (manual = false) => {
    if (busy || !admin) return;
    const entered = manual ? String(importedKey.current?.value || '').trim() : '';
    if (manual && !entered) { setError('Вставьте отдельный ключ, созданный в настройках этого сообщества VK.'); return; }
    if (importedKey.current) importedKey.current.value = '';
    const attempt = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const current = await loadCommunityTokenStatus(communityId, launchParams);
      if (attempt !== generation.current) return;
      setStatus(current.status);
      if (current.status.count >= 7) { setNotice('Сохранено максимальное количество ключей: 7 / 7.'); return; }
      const token = manual ? entered : await requestCommunityToken(communityId);
      if (attempt !== generation.current) return;
      const saved = await saveCommunityToken(communityId, token, launchParams);
      if (attempt !== generation.current) return;
      setStatus(saved.status);
      if (saved.duplicate) {
        setImportOpen(true);
        setNotice(manual ? 'Этот ключ уже сохранён. Для резервного создайте отдельный ключ в настройках сообщества VK.' : 'Ключ плагина уже подключён. Для отдельного резервного ключа используйте «Добавить другой ключ».');
      } else {
        setNotice(manual ? 'Другой ключ проверен и добавлен. Прежние ключи сохранены.' : 'Ключ плагина проверен и сохранён. Можно выполнить автонастройку в кабинете.');
      }
    } catch (failure) {
      if (attempt === generation.current) setError(failure?.message || 'Не удалось сохранить ключ. Повторите запрос.');
    } finally { if (attempt === generation.current) setBusy(false); }
  };
  return <section className="notice community-token-panel" aria-label="Ключи сообщества">
    <h2>Ключи сообщества</h2>
    <p>Сохранено ключей: <strong>{status ? status.count : '—'} / 7</strong></p>
    <p>{status?.count > 0 ? 'Ключ уже подключён. Повторный запрос через VK может вернуть тот же ключ; это не создание резервного.' : 'Подтвердите разрешения в окне VK — ключ плагина автоматически сохранится в этом сообществе PAPA BOT.'} Затем запустите автонастройку Callback API в кабинете.</p>
    <p>Для подключения достаточно одного подходящего ключа. Можно хранить до семи разных ключей; заполнять все семь не требуется.</p>
    {admin ? <div className="service-entry-actions">
      <button type="button" className="primary-button" data-community-key-request onClick={() => obtain(false)} disabled={busy || status?.count >= 7}>{busy ? 'Проверяем и сохраняем…' : status?.count >= 7 ? 'Сохранено 7 из 7 ключей' : status?.count > 0 ? 'Проверить доступ через VK' : 'Получить ключ плагина'}</button>
      <button type="button" className="secondary-button" aria-expanded={importOpen} onClick={() => { setImportOpen(value => !value); if (importedKey.current) importedKey.current.value = ''; }} disabled={busy || status?.count >= 7}>Добавить другой ключ</button>
      {onOpenCabinet ? <button type="button" className="secondary-button" onClick={onOpenCabinet} disabled={busy || status?.count >= 7}>Добавить ключ через сервис</button> : null}
    </div>
      : <p>Получить ключ может администратор сообщества. Для редактора эта операция недоступна.</p>}
    {admin && importOpen ? <form className="admin-group-form community-token-import" onSubmit={event => { event.preventDefault(); obtain(true); }}>
      <h3>Отдельный резервный ключ</h3>
      <p>В кабинете PAPA BOT доступна кнопка «Добавить ключ через VK» с отдельным окном разрешений и автоматическим сохранением. Если этот способ недоступен, можно добавить ключ вручную по инструкции ниже. User Token для получения ключа сообщества не требуется.</p>
      <ol>
        <li>Откройте управление этим сообществом VK → «Работа с API» (может находиться в разделе «Дополнительно») → «Создать ключ».</li>
        <li>Разрешите «Управление сообществом» и «Сообщения». При необходимости выберите доступ к фото, документам и другим используемым функциям.</li>
        <li>Подтвердите создание в VK, скопируйте отдельный ключ и вставьте ниже. Действующий ключ удалять не нужно.</li>
      </ol>
      <a href={`https://vk.ru/club${communityId}`} target="_blank" rel="noopener noreferrer">Открыть это сообщество VK</a>
      <label>Отдельный ключ сообщества<input ref={importedKey} type="password" maxLength="4096" autoComplete="new-password" autoCapitalize="off" spellCheck={false} disabled={busy || status?.count >= 7} /></label>
      <p>Проверим права и принадлежность этому сообществу. Ключ не сохраняется в браузерном хранилище; поле очищается при отправке.</p>
      <button type="submit" className="primary-button" disabled={busy || status?.count >= 7}>{busy ? 'Проверяем и сохраняем…' : 'Проверить и добавить другой ключ'}</button>
    </form> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
