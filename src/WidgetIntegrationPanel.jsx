import { useEffect, useRef, useState } from 'react';
import { widgetIntegration } from './api.js';
import { requestWidgetAutomationToken } from './vk.js';

export default function WidgetIntegrationPanel({ draft, savedWidget, communityId, launchParams, activeId, revision, change, onImport, externalBusy }) {
  const [status, setStatus] = useState(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [teamId, setTeamId] = useState('');
  const [filter, setFilter] = useState('');
  const [fixtures, setFixtures] = useState(null);
  const [limited, setLimited] = useState(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const source = draft.dataSource?.provider || 'manual';
  const ids = draft.dataSource?.fixtureIds || [];
  const allowed = draft.type === 'donation' ? 'donationalerts' : 'api-football';
  const blocked = busy || externalBusy;
  const call = (action, payload = {}) => widgetIntegration(communityId, action, payload, launchParams);
  const refresh = async () => {
    const attempt = generation.current;
    try { const result = await call('status'); if (alive.current && generation.current === attempt) { setStatus(result); setError(''); } } catch (failure) { if (alive.current && generation.current === attempt) setError(failure.message); }
  };
  useEffect(() => { alive.current = true; refresh(); return () => { alive.current = false; generation.current++; }; }, [communityId, launchParams?.sign]);
  useEffect(() => { refresh(); }, [activeId, revision]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 10000); return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!authUrl) return;
    let cancelled = false; let timer; const until = Date.now() + 300000;
    const poll = async () => {
      try { const result = await call('status'); if (!cancelled && alive.current) {
        setStatus(result);
        if (result.donationAlerts?.connected && result.donationAlerts.oauthStatus === 'completed') { setAuthUrl(''); setNotice('DonationAlerts подключён.'); return; }
        if (result.donationAlerts?.oauthStatus === 'failed') { setAuthUrl(''); setError('Подключение DonationAlerts не подтверждено. Повторите подключение.'); return; }
      } } catch (_) { /* explicit refresh remains available */ }
      if (!cancelled && Date.now() < until) timer = setTimeout(poll, 5000);
      else if (!cancelled) { setAuthUrl(''); setError('Время подключения DonationAlerts истекло. Начните подключение заново.'); }
    };
    timer = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [authUrl, communityId]);
  const run = async (action, payload = {}) => {
    const attempt = ++generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'enable') payload = { ...payload, widgetAccessToken: await requestWidgetAutomationToken(communityId) };
      if (!alive.current || generation.current !== attempt) return;
      const result = await call(action, payload);
      if (!alive.current || generation.current !== attempt) return;
      if (action === 'donation-start') {
        const url = new URL(result.authorizationUrl);
        if (url.origin !== 'https://www.donationalerts.com' || url.pathname !== '/oauth/authorize' || url.username || url.password || url.hash) throw new Error('Некорректный адрес подключения DonationAlerts.');
        setAuthUrl(url.href); setStatus(result.status);
      } else if (action === 'import') { onImport(result.widget); setStatus(result.status); setNotice('Данные матчей загружены. Сохраните черновик и опубликуйте виджет.'); }
      else if (action === 'football-fixtures') { setFixtures(result.fixtures || []); setLimited(result.limited === true); setStatus(result.status); }
      else { setStatus(result); if (result.widget && ['enable', 'sync'].includes(action)) onImport(result.widget, true); setNotice(action === 'enable' ? 'Автообновление включено. VK подтвердил обновление.' : action === 'disable' ? 'Автообновление выключено.' : action === 'sync' ? 'Проверка данных завершена.' : 'Подключение сохранено.'); }
      if (action === 'football-connect') setKey('');
      if (action === 'donation-disconnect') setAuthUrl('');
    } catch (failure) {
      try { const latest = await call('status'); if (alive.current && generation.current === attempt) setStatus(latest); } catch (_) { /* preserve the last status */ }
      if (alive.current && generation.current === attempt) setError(failure.message || 'Не удалось выполнить действие.');
    }
    finally { if (alive.current && generation.current === attempt) setBusy(false); }
  };
  const setSource = provider => { change('dataSource', { provider, fixtureIds: ids }); if (provider === 'manual' && source === 'donationalerts') change('donation', { ...draft.donation, buttonUrl: '' }); setError(''); setNotice(''); };
  const automation = status?.automation;
  const selectedActive = Boolean(draft.id && draft.id === activeId);
  const unsaved = !savedWidget || JSON.stringify(savedWidget) !== JSON.stringify(draft);
  const running = automation?.enabled && automation.widgetId === draft.id;
  const select = id => change('dataSource', { provider: source, fixtureIds: draft.type === 'match' ? [id] : ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id].slice(0, 6) });
  const visibleFixtures = (fixtures || []).filter(item => `${item.home} ${item.away} ${item.league}`.toLowerCase().includes(filter.toLowerCase())).slice(0, 30);
  return <section className="widget-integration-panel" aria-label="Источник данных виджета">
    <h2>Источник данных</h2>
    <label>Обновление данных<select value={source} disabled={blocked} onChange={event => setSource(event.target.value)}><option value="manual">Вручную</option><option value={allowed}>{draft.type === 'donation' ? 'DonationAlerts' : 'API-Football'}</option></select></label>
    {source !== 'manual' ? <>
      {source === 'donationalerts' ? <>
        <p>{status?.donationAlerts?.connected ? `Подключён DonationAlerts: ${status.donationAlerts.account}` : 'DonationAlerts пока не подключён.'}</p>
        <p className="widget-field-hint">Сумма учитывает новые донаты после запуска этого сбора, в выбранной валюте. Число участников задаётся вручную. Копейки учитываются в расчёте, шкала VK показывает целые единицы валюты. Один активный сбор получает все новые донаты подключённого аккаунта.</p>
        <div className="widget-integration-actions"><button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('donation-start')}>{status?.donationAlerts?.connected ? 'Подключить другой аккаунт' : 'Подключить DonationAlerts'}</button>
          {status?.donationAlerts?.connected ? <button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('donation-disconnect')}>Отключить DonationAlerts</button> : null}</div>
        {authUrl ? <p><a href={authUrl} target="_blank" rel="noopener noreferrer">Подтвердить доступ в DonationAlerts</a></p> : null}
        {status?.donationAlerts?.oauthReady === false ? <p className="widget-field-hint">Для подключения владелец PAPA BOT должен настроить OAuth-приложение DonationAlerts на сервере.</p> : null}
      </> : <>
        <p>{status?.football?.connected ? 'API-Football подключён.' : 'API-Football пока не подключён.'}</p>
        <label>Ключ API-Football<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} placeholder={status?.football?.connected ? 'Оставьте пустым, чтобы сохранить действующий ключ' : 'Ключ из кабинета API-Sports'} /></label>
        <div className="widget-integration-actions"><button type="button" className="widget-secondary" disabled={blocked || !key.trim()} onClick={() => run('football-connect', { apiKey: key.trim() })}>Проверить и сохранить ключ</button>{status?.football?.connected ? <button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('football-disconnect')}>Отключить API-Football</button> : null}</div>
        <div className="widget-inline-fields"><label>Дата матчей<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label>ID команды — необязательно<input inputMode="numeric" value={teamId} onChange={event => setTeamId(event.target.value)} /></label></div>
        <button type="button" className="widget-secondary" disabled={blocked || !status?.football?.connected} onClick={() => run('football-fixtures', { date, teamId })}>Найти матчи</button>
        {fixtures !== null ? <>
          <label>Поиск команды или турнира<input value={filter} onChange={event => setFilter(event.target.value)} /></label>
          <p className="widget-field-hint">Найдено: {fixtures.length}. Показаны первые 30 совпадений. {limited ? 'Ответ ограничен: уточните ID команды.' : ''}</p>
          <div className="widget-fixtures">{visibleFixtures.map(item => <label key={item.id}><input type={draft.type === 'match' ? 'radio' : 'checkbox'} name="selected-fixture" checked={ids.includes(item.id)} disabled={blocked || (draft.type !== 'match' && ids.length >= 6 && !ids.includes(item.id))} onChange={() => select(item.id)} /><span>{item.home} — {item.away}<small>{item.league} · {new Date(item.date).toLocaleString('ru-RU')}</small></span></label>)}</div>
        </> : null}
        <details><summary>ID матчей вручную</summary><label>ID выбранных матчей<input value={ids.join(', ')} onChange={event => change('dataSource', { provider: source, fixtureIds: event.target.value.split(/[\s,]+/).filter(Boolean) })} placeholder={draft.type === 'match' ? '123456' : '123456, 123457'} /></label></details>
        <p>Выбрано матчей: {ids.length}{ids.length ? ` · ${ids.join(', ')}` : ''}</p>
        <button type="button" className="widget-secondary" disabled={blocked || !ids.length || !status?.football?.connected} onClick={() => run('import', { widget: draft })}>Загрузить данные матчей</button>
        <p className="widget-field-hint">Названия, счёт и состояние обновляются из API-Football. Логотипы загружаются отдельно. Доступность лиг и задержка данных зависят от тарифа.</p>
      </>}
      <label>Интервал проверки<select value={intervalMinutes} disabled={blocked} onChange={event => setIntervalMinutes(Number(event.target.value))}>{[1, 5, 15, 60].map(value => <option key={value} value={value}>{value} мин.</option>)}</select></label>
      <p className="widget-field-hint">Чаще проверка — больше запросов к провайдеру. Расписание выполняется сервером; фактическое время последней проверки показано ниже.</p>
      <p>{running ? 'Автообновление этого виджета включено.' : 'Автообновление этого виджета выключено.'}</p>
      {automation?.pausedForEditing ? <p className="widget-field-hint">При сохранении и подготовке публикации автообновление приостанавливается. После публикации включите его снова.</p> : null}
      {automation?.lastCheckedAt ? <small>Последняя проверка: {new Date(automation.lastCheckedAt).toLocaleString('ru-RU')}</small> : null}
      {automation?.lastUpdatedAt ? <small>Обновление VK: {new Date(automation.lastUpdatedAt).toLocaleString('ru-RU')}</small> : null}
      {running && automation?.nextCheckAt ? <small>Следующая проверка не раньше: {new Date(automation.nextCheckAt).toLocaleString('ru-RU')}</small> : null}
      {running && automation?.finished ? <small>Все выбранные матчи завершены. Результаты проверяются раз в сутки для возможных исправлений.</small> : null}
      {automation?.skippedCurrency ? <small>Донатов в других валютах не учтено: {automation.skippedCurrency}</small> : null}
      {automation?.error && !error ? <p className="widget-integration-error" role="alert">{automation.error}{automation.vkCode != null ? ` Код VK: ${automation.vkCode}.` : ''}</p> : null}
      {!selectedActive ? <p className="widget-field-hint">Сохраните и опубликуйте этот виджет в VK, затем включите автообновление.</p> : null}
      {selectedActive && unsaved ? <p className="widget-field-hint">Перед включением автообновления сохраните изменения и проверьте публикацию виджета.</p> : null}
      <div className="widget-integration-actions"><button type="button" className="widget-secondary" disabled={blocked || !selectedActive || unsaved} onClick={() => run('enable', { widgetId: draft.id, intervalMinutes })}>{running ? 'Обновить разрешение VK' : 'Включить автообновление'}</button>
        <button type="button" className="widget-secondary" disabled={blocked || !running || unsaved} onClick={() => run('sync')}>Обновить сейчас</button>
        <button type="button" className="widget-secondary" disabled={blocked || !running} onClick={() => run('disable')}>Выключить автообновление</button></div>
      {draft.type === 'donation' && selectedActive ? <button type="button" className="widget-secondary" disabled={blocked || unsaved} onClick={() => { if (window.confirm('Начать учёт новых донатов с текущей суммы виджета? Поступления до этого момента не прибавятся.')) run('enable', { widgetId: draft.id, intervalMinutes, reset: true }); }}>Начать новый период учёта</button> : null}
    </> : null}
    <button type="button" className="widget-secondary" disabled={blocked} onClick={refresh}>Обновить состояние подключения</button>
    {busy ? <p role="status">Подождите…</p> : null}
    {error && source !== 'manual' ? <p className="widget-integration-error" role="alert">{error}</p> : null}
    {notice ? <p className="widget-integration-notice" role="status">{notice}</p> : null}
  </section>;
}
