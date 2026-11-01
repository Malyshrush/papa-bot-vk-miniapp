import { useEffect, useRef, useState } from 'react';
import { widgetIntegration } from './api.js';
import { requestWidgetAutomationToken } from './vk.js';
import { findLeague, leagueLabel, searchLeagues, seasonForDate, seasonsFor, CATALOG_UPDATED_AT } from './football-leagues.js';

export default function WidgetIntegrationPanel({ draft, savedWidget, communityId, launchParams, activeId, revision, change, onImport, externalBusy, onManagedBalance }) {
  const [status, setStatus] = useState(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authUrl, setAuthUrl] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [date, setDate] = useState(() => draft.dataSource?.matchDate || '');
  const [leagueId, setLeagueId] = useState(draft.dataSource?.leagueId || '');
  const [season, setSeason] = useState(draft.dataSource?.season || '');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [teamId, setTeamId] = useState('');
  const [filter, setFilter] = useState('');
  const [fixtures, setFixtures] = useState(null);
  const [limited, setLimited] = useState(false);
  const [totalFixtures, setTotalFixtures] = useState(0);
  const [report, setReport] = useState('');
  const [initialFunded, setInitialFunded] = useState('');
  const alive = useRef(true);
  const generation = useRef(0);
  const intervalEdited = useRef(false);
  const reportRef = useRef(null);
  const source = draft.dataSource?.provider || 'manual';
  const ids = draft.dataSource?.fixtureIds || [];
  const allowed = draft.type === 'donation' ? 'donationalerts' : 'api-football';
  const blocked = busy || externalBusy;
  const allowedSeasons = status?.football?.availableSeasons || [];
  const selectedLeague = findLeague(leagueId);
  const availableSeasons = seasonsFor(selectedLeague, allowedSeasons);
  const filteredLeagues = searchLeagues(leagueFilter);
  if (selectedLeague && !filteredLeagues.some(item => item.id === selectedLeague.id)) filteredLeagues.unshift(selectedLeague);
  const chooseSeason = next => { const info = selectedLeague?.seasons.find(item => String(item.year) === String(next)); setSeason(String(next || '')); if (date && info && (date < info.start || date > info.end)) setDate(''); setFixtures(null); };
  const chooseLeague = id => { const league = findLeague(id), info = seasonForDate(league, date, allowedSeasons); setLeagueId(id); setSeason(info ? String(info.year) : ''); if (date && info && (date < info.start || date > info.end)) setDate(''); setFixtures(null); setFilter(''); };
  const call = (action, payload = {}) => widgetIntegration(communityId, action, payload, launchParams);
  const refresh = async () => {
    const attempt = generation.current;
    try { const result = await call('status'); if (alive.current && generation.current === attempt) { setStatus(result); setError(''); } } catch (failure) { if (alive.current && generation.current === attempt) setError(failure.message); }
  };
  useEffect(() => { alive.current = true; setReport(''); setStatus(null); setKey(''); setInitialFunded(''); intervalEdited.current = false; refresh(); return () => { alive.current = false; generation.current++; }; }, [communityId, launchParams?.sign]);
  useEffect(() => { refresh(); }, [activeId, revision]);
  useEffect(() => { if (selectedLeague && allowedSeasons.length && !allowedSeasons.includes(Number(season))) { const next = seasonForDate(selectedLeague, date, allowedSeasons); chooseSeason(next?.year || ''); } }, [status?.football?.availableSeasons, leagueId]);
  useEffect(() => { onManagedBalance?.({ communityId, widgetId: draft.id, managed: (status?.automation?.widgetId === draft.id && Number.isSafeInteger(status?.automation?.trackedMinor)) || Boolean(status?.collections?.some(item => item.widgetId === draft.id)) }); }, [status, draft.id, communityId, onManagedBalance]);
  useEffect(() => { if (!report) return; const timer = setTimeout(() => setReport(''), 300000); return () => clearTimeout(timer); }, [report]);
  useEffect(() => { if (!report) return; const frame = requestAnimationFrame(() => reportRef.current?.scrollIntoView({ block: 'nearest' })); return () => cancelAnimationFrame(frame); }, [report]);
  useEffect(() => {
    const saved = status?.automation;
    if (!intervalEdited.current && saved && saved.widgetId === draft.id && [1, 5, 15, 60].includes(saved.intervalMinutes)) setIntervalMinutes(saved.intervalMinutes);
  }, [status, draft.id]);
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
      } else if (action === 'diagnostics') { setReport(JSON.stringify(result.report, null, 2)); }
      else if (action === 'import') { onImport(result.widget); setStatus(result.status); setNotice('Данные матчей загружены. Сохраните черновик и опубликуйте виджет.'); }
      else if (action === 'football-fixtures') { setFixtures(result.fixtures || []); setTotalFixtures(result.total ?? result.fixtures?.length ?? 0); setLimited(result.limited === true); setStatus(result.status); }
      else { setStatus(result); if (result.widget && ['enable', 'sync'].includes(action)) onImport(result.widget, true); setNotice(action === 'enable' ? 'Автообновление включено. VK подтвердил обновление.' : action === 'disable' ? 'Автообновление выключено.' : action === 'sync' ? 'Проверка данных завершена.' : 'Подключение сохранено.'); }
      if (action === 'football-connect') setKey('');
      if (action === 'donation-disconnect') setAuthUrl('');
    } catch (failure) {
      try { const latest = await call('status'); if (alive.current && generation.current === attempt) setStatus(latest); } catch (_) { /* preserve the last status */ }
      if (alive.current && generation.current === attempt) setError((failure.message || 'Не удалось выполнить действие.') + (Number.isSafeInteger(failure.vkCode) ? ` Код VK: ${failure.vkCode}.` : ''));
    }
    finally { if (alive.current && generation.current === attempt) setBusy(false); }
  };
  const setSource = provider => { change('dataSource', { provider, fixtureIds: ids }); if (provider === 'manual' && source === 'donationalerts') change('donation', { ...draft.donation, buttonUrl: '' }); setError(''); setNotice(''); };
  const automation = status?.automation;
  const selectedAutomation = Boolean(draft.id && automation?.widgetId === draft.id);
  const trackedMinor = automation && automation.widgetId === draft.id ? automation.trackedMinor : status?.collections?.find(item => item.widgetId === draft.id)?.trackedMinor;
  const selectedActive = Boolean(draft.id && draft.id === activeId);
  const unsaved = !savedWidget || JSON.stringify(savedWidget) !== JSON.stringify(draft);
  const running = automation?.enabled && automation.widgetId === draft.id;
  const select = id => {
    const nextIds = draft.type === 'match' ? [id] : ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id].slice(0, 6);
    const next = { ...draft, dataSource: { provider: source, fixtureIds: nextIds, leagueId, season, matchDate: date } };
    // Apply IDs and imported rows together: a failed lookup keeps the previous match.
    if (nextIds.length) run('import', { widget: next }); else onImport({ ...next, rows: [] });
  };
  const matchingFixtures = (fixtures || []).filter(item => (!date || item.day === date) && `${item.home} ${item.away} ${item.league}`.toLowerCase().includes(filter.toLowerCase()));
  const visibleFixtures = matchingFixtures.slice(0, 30);
  return <section className="widget-integration-panel" aria-label="Источник данных виджета">
    <h2>Источник данных</h2>
    <label>Обновление данных<select value={source} disabled={blocked} onChange={event => setSource(event.target.value)}><option value="manual">Вручную</option><option value={allowed}>{draft.type === 'donation' ? 'DonationAlerts' : 'API-Football'}</option></select></label>
    {source !== 'manual' ? <>
      {source === 'donationalerts' ? <>
        <p>{status?.donationAlerts?.connected ? `Подключён DonationAlerts: ${status.donationAlerts.account}` : 'DonationAlerts пока не подключён.'}</p>
        <p className="widget-field-hint">Сумма учитывает новые донаты после запуска этого сбора, в выбранной валюте. Число участников задаётся вручную. Копейки учитываются в расчёте, шкала VK показывает целые единицы валюты. Один активный сбор получает все новые донаты подключённого аккаунта.</p>
        <p className="widget-field-hint">После подключения аккаунта сохраните и опубликуйте сбор: это подтвердит получателя для кнопки поддержки. Автообновление суммы включается отдельно. При смене аккаунта опубликуйте виджет заново.</p>
        <div className="widget-integration-actions"><button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('donation-start')}>{status?.donationAlerts?.connected ? 'Подключить другой аккаунт' : 'Подключить DonationAlerts'}</button>
          {status?.donationAlerts?.connected ? <button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('donation-disconnect')}>Отключить DonationAlerts</button> : null}</div>
        {authUrl ? <p><a href={authUrl} target="_blank" rel="noopener noreferrer">Подтвердить доступ в DonationAlerts</a></p> : null}
        {status?.donationAlerts?.oauthReady === false ? <p className="widget-field-hint">Для подключения владелец PAPA BOT должен настроить OAuth-приложение DonationAlerts на сервере.</p> : null}
      </> : <>
        <p>{status?.football?.connected ? 'API-Football подключён.' : 'API-Football пока не подключён.'}</p>
        {status?.football?.plan ? <p className="widget-field-hint">Тариф: {status.football.plan}. {Number.isSafeInteger(status.football.used) && Number.isSafeInteger(status.football.limit) ? `По последней проверке использовано ${status.football.used} из ${status.football.limit} запросов в сутки.` : ''}</p> : null}
        {status?.football?.plan === 'Free' ? <p className="widget-field-hint">Бесплатный тариф ограничивает сезоны и число запросов. Данные каждого выбранного матча запрашиваются отдельно: при интервале {intervalMinutes} мин. и {Math.max(1, ids.length)} матчах — до {Math.ceil(1440 / intervalMinutes) * Math.max(1, ids.length)} запросов в сутки. Поиск и первоначальная загрузка расходуют дополнительные запросы.</p> : null}
        <label>Ключ API-Football<input type="password" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} placeholder={status?.football?.connected ? 'Оставьте пустым, чтобы сохранить действующий ключ' : 'Ключ из кабинета API-Sports'} /></label>
        <div className="widget-integration-actions"><button type="button" className="widget-secondary" disabled={blocked || !key.trim()} onClick={() => run('football-connect', { apiKey: key.trim() })}>Проверить и сохранить ключ</button>{status?.football?.connected ? <button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('football-disconnect')}>Отключить API-Football</button> : null}</div>
        {status?.football?.connected ? <button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('football-account')}>Проверить тариф и лимиты</button> : null}
        <label>Поиск лиги<input value={leagueFilter} disabled={blocked} onChange={event => setLeagueFilter(event.target.value)} placeholder="Название лиги или страна" /></label>
        <label>Лига<select value={leagueId} disabled={blocked} onChange={event => chooseLeague(event.target.value)}><option value="">Выберите лигу</option>{filteredLeagues.map(league => <option key={league.id} value={league.id}>{leagueLabel(league)}</option>)}</select></label>
        <p className="widget-field-hint">Справочник API-Football от {new Date(CATALOG_UPDATED_AT).toLocaleDateString('ru-RU')}. Поиск и выбор лиги выполняются в приложении без запросов вашего ключа.</p>
        <label>Сезон<select value={season} disabled={blocked || !selectedLeague} onChange={event => chooseSeason(event.target.value)}><option value="">Выберите сезон</option>{availableSeasons.map(item => <option key={item.year} value={item.year}>{item.year} · {item.start} — {item.end}</option>)}</select></label>
        {allowedSeasons.length ? <p className="widget-field-hint">API разрешил вашему тарифу сезоны: {allowedSeasons.join(', ')}. Дата поиска должна относиться к выбранному сезону.</p> : null}
        {selectedLeague && !availableSeasons.length ? <p>У этой лиги нет сезонов из доступного вашему тарифу диапазона. Выберите другую лигу.</p> : null}
        <div className="widget-inline-fields"><label>Дата матчей — необязательно (МСК)<input type="date" value={date} disabled={blocked} onChange={event => { const next = event.target.value, info = seasonForDate(selectedLeague, next, allowedSeasons); setDate(next); if (next && info && next >= info.start && next <= info.end && String(info.year) !== season) { setSeason(String(info.year)); setFixtures(null); } }} /></label><label>ID команды — необязательно<input inputMode="numeric" value={teamId} disabled={blocked} onChange={event => setTeamId(event.target.value)} /></label></div>
        <p className="widget-field-hint">Загружаются только выбранная лига и сезон. Дата и поиск по названию фильтруют полученный список без новых запросов.</p>
        <button type="button" className="widget-secondary" disabled={blocked || !status?.football?.connected || !leagueId || !season} onClick={() => run('football-fixtures', { date, teamId, leagueId, season })}>Найти матчи</button>
        {fixtures !== null ? <>
          <label>Поиск команды или турнира<input value={filter} onChange={event => setFilter(event.target.value)} /></label>
          <p className="widget-field-hint">Найдено в сезоне: {totalFixtures}. После фильтрации: {matchingFixtures.length}; показаны первые 30 совпадений. {limited ? 'Ответ ограничен: уточните ID команды.' : ''}</p>
          {!fixtures.length ? <p>В выбранной лиге и сезоне матчей нет. Выберите другой сезон или уберите ID команды.</p> : null}
          {fixtures.length > 0 && !visibleFixtures.length ? <p>Совпадений по дате и названию нет. Измените или очистите фильтры.</p> : null}
          <div className="widget-fixtures">{visibleFixtures.map(item => <label key={item.id}><input type={draft.type === 'match' ? 'radio' : 'checkbox'} name="selected-fixture" checked={ids.includes(item.id)} disabled={blocked || (draft.type !== 'match' && ids.length >= 6 && !ids.includes(item.id))} onChange={() => select(item.id)} /><span>{item.home} — {item.away}<small>{item.league} · {new Date(item.date).toLocaleString('ru-RU')}</small></span></label>)}</div>
        </> : null}
        <details><summary>ID матчей вручную</summary><label>ID выбранных матчей<input value={ids.join(', ')} onChange={event => change('dataSource', { provider: source, fixtureIds: event.target.value.split(/[\s,]+/).filter(Boolean) })} placeholder={draft.type === 'match' ? '123456' : '123456, 123457'} /></label></details>
        <p>Выбрано матчей: {ids.length}{ids.length ? ` · ${ids.join(', ')}` : ''}</p>
        <button type="button" className="widget-secondary" disabled={blocked || !ids.length || !status?.football?.connected} onClick={() => run('import', { widget: draft })}>Загрузить данные матчей</button>
        <p className="widget-field-hint">Выбор матча из списка сразу заполняет команды, счёт и состояние. Для ID, введённых вручную, нажмите «Загрузить данные матчей». Для самостоятельного заполнения выберите источник «Вручную». Логотипы загружаются отдельно. Доступность сезонов и задержка данных зависят от тарифа.</p>
      </>}
      <label>Интервал проверки<select value={intervalMinutes} disabled={blocked} onChange={event => { intervalEdited.current = true; setIntervalMinutes(Number(event.target.value)); }}>{[1, 5, 15, 60].map(value => <option key={value} value={value}>{value} мин.</option>)}</select></label>
      <p className="widget-field-hint">Чаще проверка — больше запросов к провайдеру. Расписание выполняется сервером; фактическое время последней проверки показано ниже.</p>
      <p>{running ? 'Автообновление этого виджета включено.' : 'Автообновление этого виджета выключено.'}</p>
      {selectedAutomation && automation?.pausedForEditing ? <p className="widget-field-hint">Автообновление приостановлено изменением активного виджета или подготовкой публикации. Завершите публикацию или продолжите текущий сбор кнопкой включения.</p> : null}
      {draft.type === 'donation' && Number.isSafeInteger(trackedMinor) ? <p>Учтено PAPA BOT: {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(trackedMinor / 100)} {draft.donation?.currency || 'RUB'}. Прогресс этого сбора сохраняется при переключении виджетов.</p> : null}
      {selectedAutomation && automation?.lastCheckedAt ? <small>Последняя проверка: {new Date(automation.lastCheckedAt).toLocaleString('ru-RU')}</small> : null}
      {selectedAutomation && automation?.lastUpdatedAt ? <small>Обновление VK: {new Date(automation.lastUpdatedAt).toLocaleString('ru-RU')}</small> : null}
      {running && automation?.nextCheckAt ? <small>Следующая проверка не раньше: {new Date(automation.nextCheckAt).toLocaleString('ru-RU')}</small> : null}
      {running && automation?.finished ? <small>Все выбранные матчи завершены. Результаты проверяются раз в сутки для возможных исправлений.</small> : null}
      {automation?.skippedCurrency ? <small>Донатов в других валютах не учтено: {automation.skippedCurrency}</small> : null}
      {selectedAutomation && automation?.error && !error ? <p className="widget-integration-error" role="alert">{automation.error}{automation.vkCode != null ? ` Код VK: ${automation.vkCode}.` : ''}</p> : null}
      {!selectedActive ? <p className="widget-field-hint">Сохраните и опубликуйте этот виджет в VK, затем включите автообновление.</p> : null}
      {selectedActive && unsaved ? <p className="widget-field-hint">Перед включением автообновления сохраните изменения и проверьте публикацию виджета.</p> : null}
      <div className="widget-integration-actions"><button type="button" className="widget-secondary" disabled={blocked || !selectedActive || unsaved} onClick={() => run('enable', { widgetId: draft.id, intervalMinutes })}>{running ? 'Обновить разрешение VK' : 'Включить автообновление'}</button>
        <button type="button" className="widget-secondary" disabled={blocked || !running || unsaved} onClick={() => run('sync')}>Обновить сейчас</button>
        <button type="button" className="widget-secondary" disabled={blocked || !running} onClick={() => run('disable')}>Выключить автообновление</button></div>
      {draft.type === 'donation' && selectedActive ? <details><summary>Новый период учёта</summary><label>Начальная сумма нового периода<input type="number" min="0" max="99999999" step="1" value={initialFunded} placeholder={draft.donation?.funded || '0'} onChange={event => setInitialFunded(event.target.value)} /></label><button type="button" className="widget-secondary" disabled={blocked || unsaved} onClick={() => { if (window.confirm('Начать новый период? Текущая сумма этого сбора будет заменена, а поступления до этого момента не прибавятся.')) run('enable', { widgetId: draft.id, intervalMinutes, reset: true, ...(initialFunded !== '' ? { initialFunded } : {}) }); }}>Начать новый период учёта</button></details> : null}
    </> : null}
    <button type="button" className="widget-secondary" disabled={blocked} onClick={refresh}>Обновить состояние подключения</button>
    <button type="button" className="widget-secondary" disabled={blocked} onClick={() => run('diagnostics', { widgetId: draft.id })}>Диагностика автообновления</button>
    {report ? <div className="widget-sync-diagnostics" ref={reportRef}><label>Отчёт для разработчика<textarea readOnly rows={10} value={report} spellCheck={false} onFocus={event => event.target.select()} /></label><button type="button" className="widget-secondary" onClick={async () => { try { await navigator.clipboard.writeText(report); setNotice('Диагностика скопирована.'); } catch (_) { setNotice('Выделите и скопируйте текст отчёта.'); } }}>Скопировать диагностику</button></div> : null}
    {busy ? <p role="status">Подождите…</p> : null}
    {error && source !== 'manual' ? <p className="widget-integration-error" role="alert">{error}</p> : null}
    {notice ? <p className="widget-integration-notice" role="status">{notice}</p> : null}
  </section>;
}
