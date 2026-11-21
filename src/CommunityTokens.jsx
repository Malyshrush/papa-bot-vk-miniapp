import { useEffect, useRef, useState } from 'react';
import { loadCommunityTokenStatus, saveCommunityToken } from './api.js';

export default function CommunityTokens({ communityId, launchParams, onOpenCabinet }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const importedKey = useRef(null);
  const generation = useRef(0);
  const admin = launchParams.vk_viewer_group_role === 'admin';
  useEffect(() => {
    const attempt = ++generation.current;
    setStatus(null); setError(''); setNotice(''); setBusy(false);
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
  const obtain = async () => {
    if (busy || !admin) return;
    const entered = String(importedKey.current?.value || '').trim();
    if (!entered) { setError('Вставьте отдельный ключ, созданный в настройках этого сообщества VK.'); return; }
    if (importedKey.current) importedKey.current.value = '';
    const attempt = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const current = await loadCommunityTokenStatus(communityId, launchParams);
      if (attempt !== generation.current) return;
      setStatus(current.status);
      if (current.status.count >= 7) { setNotice('Сохранено максимальное количество ключей: 7 / 7.'); return; }
      const token = entered;
      if (attempt !== generation.current) return;
      const saved = await saveCommunityToken(communityId, token, launchParams);
      if (attempt !== generation.current) return;
      setStatus(saved.status);
      if (saved.duplicate) {
        setNotice('Этот ключ уже сохранён. Для резервного создайте отдельный ключ в настройках сообщества VK.');
      } else {
        setNotice('Ключ проверен и добавлен. Прежние ключи сохранены.');
      }
    } catch (failure) {
      if (attempt === generation.current) setError(failure?.message || 'Не удалось сохранить ключ. Повторите запрос.');
    } finally { if (attempt === generation.current) setBusy(false); }
  };
  return <section className="notice community-token-panel" aria-label="Ключи сообщества">
    <h2>Ключи сообщества</h2>
    <p>Сохранено ключей: <strong>{status ? status.count : '—'} / 7</strong></p>
    <p>Создайте ключ в настройках сообщества VK, скопируйте его и добавьте вручную. Затем запустите автонастройку Callback API в кабинете.</p>
    <p>Для подключения достаточно одного подходящего ключа. Можно хранить до семи разных ключей; заполнять все семь не требуется.</p>
    {admin ? <form className="admin-group-form community-token-import" onSubmit={event => { event.preventDefault(); obtain(); }}>
      <h3>Добавить ключ вручную</h3>
      <ol>
        <li>Откройте управление этим сообществом VK → «Работа с API» (может находиться в разделе «Дополнительно») → «Создать ключ».</li>
        <li>Разрешите «Управление сообществом» и «Сообщения». При необходимости выберите доступ к фото, документам и другим используемым функциям.</li>
        <li>Подтвердите создание в VK, скопируйте отдельный ключ и вставьте ниже. Действующий ключ удалять не нужно.</li>
      </ol>
      <a href={`https://vk.ru/club${communityId}`} target="_blank" rel="noopener noreferrer">Открыть это сообщество VK</a>
      <label>Ключ сообщества<input ref={importedKey} type="password" maxLength="4096" autoComplete="new-password" autoCapitalize="off" spellCheck={false} disabled={busy || status?.count >= 7} /></label>
      <p>Проверим права и принадлежность этому сообществу. Ключ не сохраняется в браузерном хранилище; поле очищается при отправке.</p>
      <button type="submit" className="primary-button" disabled={busy || status?.count >= 7}>{busy ? 'Проверяем и сохраняем…' : status?.count >= 7 ? 'Сохранено 7 из 7 ключей' : 'Проверить и сохранить ключ'}</button>
    </form> : <p>Добавить ключ может администратор сообщества.</p>}
    {admin && onOpenCabinet ? <div className="service-entry-actions"><button type="button" className="secondary-button" onClick={onOpenCabinet}>Открыть кабинет</button></div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
