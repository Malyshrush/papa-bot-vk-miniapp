import { useEffect, useRef, useState } from 'react';
import { loadCommunityTokenStatus, saveCommunityToken } from './api.js';
import { requestCommunityToken } from './vk.js';

export default function CommunityTokens({ communityId, launchParams }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const admin = launchParams.vk_viewer_group_role === 'admin';
  useEffect(() => {
    const attempt = ++generation.current;
    setStatus(null); setError(''); setNotice(''); setBusy(false);
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
    const attempt = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const current = await loadCommunityTokenStatus(communityId, launchParams);
      if (attempt !== generation.current) return;
      setStatus(current.status);
      if (current.status.count >= 7) { setNotice('Сохранено максимальное количество ключей: 7 / 7.'); return; }
      const token = await requestCommunityToken(communityId);
      if (attempt !== generation.current) return;
      const saved = await saveCommunityToken(communityId, token, launchParams);
      if (attempt !== generation.current) return;
      setStatus(saved.status);
      setNotice(saved.duplicate ? 'VK вернул уже сохранённый ключ. Счётчик не изменился.' : 'Ключ проверен и сохранён в PAPA BOT. Можно выполнить автонастройку в кабинете.');
    } catch (failure) {
      if (attempt === generation.current) setError(failure?.message || 'Не удалось сохранить ключ. Повторите запрос.');
    } finally { if (attempt === generation.current) setBusy(false); }
  };
  return <section className="notice community-token-panel" aria-label="Ключи сообщества">
    <h2>Ключи сообщества</h2>
    <p>Сохранено ключей: <strong>{status ? status.count : '—'} / 7</strong></p>
    <p>Подтвердите разрешения в окне VK — ключ автоматически сохранится в этом сообществе PAPA BOT. Затем запустите автонастройку Callback API в кабинете.</p>
    <p>Счётчик учитывает разные сохранённые ключи. VK может повторно выдать тот же ключ.</p>
    {admin ? <button type="button" className="primary-button" onClick={obtain} disabled={busy || status?.count >= 7}>{busy ? 'Запрашиваем и сохраняем…' : status?.count >= 7 ? 'Сохранено 7 из 7 ключей' : 'Получить и сохранить ключ через VK'}</button>
      : <p>Получить ключ может администратор сообщества. Для редактора эта операция недоступна.</p>}
    {notice ? <p role="status">{notice}</p> : null}
    {error ? <p className="inline-error" role="alert">{error}</p> : null}
  </section>;
}
