import { useEffect, useRef, useState } from 'react';
import { confirmWidget, deleteWidget, loadWidgets, previewWidget, saveWidget } from './api.js';
import { buildCommunityPluginUrl, COMMUNITY_PLUGIN, showCommunityWidgetPreview } from './vk.js';
import { resolveWidgetClient, uploadWidgetImage } from './widget-images.js';
import WidgetImageAdjuster from './WidgetImageAdjuster.jsx';
import WidgetTypeThumbnail from './WidgetTypeThumbnail.jsx';
import WidgetExtraEditor, { EXTRA_TYPES, extraDraft, WidgetExtraVisual } from './WidgetExtraEditor.jsx';
import WidgetIntegrationPanel from './WidgetIntegrationPanel.jsx';
import { collectWidgetIssues, widgetValidationError } from './widget-validation.js';

const TYPES = [
  ['tiles_wide', 'Прямоугольные плитки', 3, 10],
  ['tiles_square', 'Квадратные плитки', 3, 10],
  ['covers', 'Обложки с акцией', 1, 3],
  ['list', 'Список', 1, 6],
  ['compact_list', 'Компактный список', 1, 6],
  ['reviews', 'Отзывы', 1, 6],
  ['clients', 'Наши клиенты', 1, 6],
  ['text', 'Текст', 0, 0],
  ['table', 'Таблица', 1, 10],
  ['match', 'Один матч', 1, 1],
  ['matches', 'Несколько матчей', 1, 6],
  ['donation', 'Сбор средств', 0, 0]
];
const TYPE_BY_ID = Object.fromEntries(TYPES.map(type => [type[0], type]));
const EMPTY_ROW = { title: '', description: '', detail: '', address: '', time: '', button: '', url: '', buttonUrl: '', imageId: '', imageUrl: '' };

function publicationDiagnostic(stage, failure, draftSaved) {
  const data = failure?.error_data && typeof failure.error_data === 'object' ? failure.error_data : {};
  const numeric = value => Number.isSafeInteger(value) && value >= 0 && value <= 999999 ? String(value) : '';
  const safeText = value => typeof value === 'string' ? value.slice(0, 400)
    .replace(/https?:\/\/[^\s<>"']+/gi, '[адрес скрыт]')
    .replace(/\b(?:access_token|token|secret|password|hash|sign|key|cookie|session|authorization|bearer)\s*(?:[=:]\s*|\s+)[^\s,;]+/gi, '[данные скрыты]')
    .replace(/[A-Za-z0-9+/_=-]{16,}/g, '[данные скрыты]')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, 160) : '';
  const reason = safeText(data.error_reason || data.error_description || data.error_msg);
  const type = safeText(failure?.error_type);
  const vkCode = numeric(data.error_code);
  const status = numeric(failure?.status);
  const serverCode = /^[a-z0-9_]{1,48}$/i.test(String(failure?.code || '')) ? String(failure.code) : '';
  return [`Этап: ${stage}.`, draftSaved ? 'Черновик сохранён.' : 'Сохранение черновика не подтверждено.',
    type ? `Тип VK: ${type}.` : '', vkCode ? `Код VK: ${vkCode}.` : '', reason ? `Причина VK: ${reason}.` : '',
    status ? `HTTP: ${status}.` : '', serverCode ? `Код сервера: ${serverCode}.` : '',
    !type && !vkCode && !reason && !status && !serverCode ? 'Подробности ответа отсутствуют.' : ''].filter(Boolean).join(' ');
}

function createDraft(type) {
  return { type, name: TYPE_BY_ID[type][1], title: '', titleUrl: '', moreText: '', moreUrl: '',
    visibility: 'all', showImages: true, showButtons: !['reviews', 'clients'].includes(type), detailed: false,
    rows: Array.from({ length: TYPE_BY_ID[type][2] }, () => ({ ...EMPTY_ROW })),
    ...(EXTRA_TYPES.has(type) ? extraDraft(type) : {}) };
}

function previewClass(type) {
  if (type.startsWith('tiles_')) return `widget-visual--${type}`;
  return `widget-visual--${type}`;
}

function WidgetVisual({ widget }) {
  return <div className={`widget-visual ${previewClass(widget.type)}`}>
    <div className="widget-visual-top"><strong>{widget.title || widget.name}</strong><span>{widget.visibility === 'none' ? 'Не показывается' : 'Предпросмотр'}</span></div>
    {EXTRA_TYPES.has(widget.type) ? <WidgetExtraVisual widget={widget} /> : <div className="widget-visual-rows">{widget.rows.map((row, index) => <div className="widget-visual-row" key={index}>
      {widget.showImages && row.imageUrl ? <img src={row.imageUrl} alt="" /> : widget.showImages && row.imageId ? <span className="widget-visual-image-id">✓</span> : null}
      <div className="widget-visual-copy"><strong>{row.title || `Элемент ${index + 1}`}</strong>
        {row.description ? <span>{row.description}</span> : null}
        {widget.detailed && row.detail ? <small>{row.detail}</small> : null}
        {row.address ? <small>⌖ {row.address}</small> : null}
        {row.time ? <small>◷ {row.time}</small> : null}
      </div>
      {widget.showButtons && !['reviews', 'clients'].includes(widget.type) && row.button ? <span className={widget.type.startsWith('tiles_') ? 'widget-visual-link' : 'widget-visual-button'}>{row.button}</span> : null}
    </div>)}</div>}
    {widget.moreText ? <div className="widget-visual-footer">{widget.moreText} ›</div> : null}
  </div>;
}

export default function WidgetWorkspace({ communityId, launchParams, groups, onBack }) {
  const [catalogue, setCatalogue] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState(null);
  const [editorSession, setEditorSession] = useState(0);
  const [managedBalance, setManagedBalance] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publicationDetails, setPublicationDetails] = useState('');
  const [feedbackLocation, setFeedbackLocation] = useState('top');
  const [pendingImage, setPendingImage] = useState(null);
  const [fullPreview, setFullPreview] = useState(false);
  const feedbackRef = useRef(null);
  const scope = `${communityId}:${launchParams?.sign || ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  useEffect(() => {
    if (!error) return undefined;
    const timeout = window.setTimeout(() => setError(''), error.includes('Ответы:') ? 90000 : error.startsWith('Для ') ? 45000 : 12000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!publicationDetails) return undefined;
    const timeout = window.setTimeout(() => setPublicationDetails(''), 90000);
    return () => window.clearTimeout(timeout);
  }, [publicationDetails]);
  useEffect(() => {
    if (!error && !notice) return undefined;
    const frame = window.requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' }));
    return () => window.cancelAnimationFrame(frame);
  }, [error, notice, feedbackLocation]);
  useEffect(() => {
    if (!fullPreview) return undefined;
    const close = event => { if (event.key === 'Escape') setFullPreview(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [fullPreview]);

  const refresh = async () => {
    const data = await loadWidgets(communityId, launchParams);
    if (scopeRef.current !== scope) return data;
    setCatalogue(data.widgets || []);
    setActiveId(data.activeId || '');
    return data;
  };

  useEffect(() => {
    let live = true;
    setDraft(null); setSelectedType(''); setCatalogue([]); setActiveId('');
    setPendingImage(null); setFullPreview(false); setBusy(false);
    setError(''); setNotice(''); setPublicationDetails('');
    loadWidgets(communityId, launchParams).then(data => {
      if (live) { setCatalogue(data.widgets || []); setActiveId(data.activeId || ''); }
    }).catch(failure => { if (live) { setFeedbackLocation('top'); setError(failure.message || 'Не удалось загрузить виджеты.'); } });
    return () => { live = false; };
  }, [communityId, launchParams]);

  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const changeRow = (index, key, value) => setDraft(current => ({ ...current, rows: current.rows.map((row, at) => at === index ? { ...row, [key]: value } : row) }));
  const addRow = () => setDraft(current => ({ ...current, rows: [...current.rows, { ...EMPTY_ROW }] }));
  const removeRow = (index) => { setError(''); setNotice(''); setDraft(current => ({ ...current, rows: current.rows.filter((_, at) => at !== index) })); };
  const uploadImage = async (index, file, team = null) => {
    if (!file) return;
    setBusy(true); setError(''); setNotice(''); setPublicationDetails(''); setFeedbackLocation(`image:${index}`);
    try {
      const image = await uploadWidgetImage(communityId, draft.type, file, launchParams);
      if (scopeRef.current !== scope) return;
      setDraft(current => ({ ...current, rows: current.rows.map((row, at) => at === index ? (team ? { ...row, [team]: { ...row[team], ...image } } : { ...row, ...image }) : row) }));
      setNotice('Изображение загружено в VK. Сохраните черновик.');
    } catch (failure) { if (scopeRef.current === scope) setError(failure.message || 'Не удалось загрузить изображение в VK.'); }
    finally { if (scopeRef.current === scope) setBusy(false); }
  };
  const loadClient = async (index) => {
    setBusy(true); setError(''); setNotice(''); setPublicationDetails(''); setFeedbackLocation(`client:${index}`);
    try {
      const client = await resolveWidgetClient(communityId, draft.rows[index].url, launchParams);
      if (scopeRef.current !== scope) return;
      setDraft(current => ({ ...current, rows: current.rows.map((row, at) => at === index ? { ...row, ...client } : row) }));
      setNotice('Сообщество клиента найдено в VK. Сохраните черновик.');
    } catch (failure) { if (scopeRef.current === scope) setError(failure.message || 'VK не нашёл клиента.'); }
    finally { if (scopeRef.current === scope) setBusy(false); }
  };

  const persist = async (notify = true) => {
    const issues = collectWidgetIssues(draft, false);
    if (issues.length) throw widgetValidationError(issues, false);
    const data = await saveWidget(communityId, draft, launchParams);
    if (scopeRef.current !== scope) return data.widget;
    setDraft(data.widget);
    await refresh();
    if (scopeRef.current !== scope) return data.widget;
    if (notify) setNotice('Черновик сохранён. Сообщество пока не изменено.');
    return data.widget;
  };

  const save = async () => {
    setBusy(true); setError(''); setNotice(''); setPublicationDetails(''); setFeedbackLocation('actions');
    try { await persist(); } catch (failure) { if (scopeRef.current === scope) setError(failure.message || 'Не удалось сохранить виджет.'); }
    finally { if (scopeRef.current === scope) setBusy(false); }
  };

  const publish = async (existing = null) => {
    setBusy(true); setError(''); setNotice(''); setPublicationDetails(''); setFeedbackLocation(existing ? 'top' : 'actions');
    let stage = 'сохранение черновика';
    let draftSaved = false;
    try {
      const issues = collectWidgetIssues(existing || draft);
      if (issues.length) throw widgetValidationError(issues);
      const saved = existing || await persist(false);
      if (scopeRef.current !== scope) return;
      draftSaved = true;
      stage = 'проверка текущего виджета';
      const fresh = await refresh();
      if (scopeRef.current !== scope) return;
      const previous = fresh.widgets?.find(widget => widget.id === fresh.activeId);
      if (previous && previous.id !== saved.id && previous.type !== saved.type &&
        !window.confirm('Публикация этого виджета отключит виджет другого типа. Продолжить?')) return;
      stage = 'проверка и подготовка виджета';
      const compiled = await previewWidget(communityId, saved.id, launchParams);
      if (scopeRef.current !== scope) return;
      stage = 'системное окно VK';
      const accepted = await showCommunityWidgetPreview(communityId, compiled.type, compiled.code);
      if (scopeRef.current !== scope) return;
      if (!accepted) { setNotice('Публикация отменена. Черновик сохранён.'); return; }
      stage = 'сохранение результата в PAPA BOT';
      const confirmed = await confirmWidget(communityId, saved.id, fresh.activeId || '', launchParams);
      if (scopeRef.current !== scope) return;
      if (confirmed.activeId !== saved.id) throw new Error('Сервер не подтвердил выбранный виджет.');
      setActiveId(confirmed.activeId);
      setNotice('Виджет опубликован в сообществе. Проверьте публикацию.');
    } catch (failure) {
      if (scopeRef.current !== scope) return;
      if (failure?.code === 'invalid_widget' || failure?.status === 400) {
        setError(`${failure.message}\nМожно продолжить заполнение или сохранить незавершённый виджет в черновик. Для черновика нужны внутреннее название и корректные введённые ссылки.`);
        setPublicationDetails('');
        return;
      }
      setError(stage === 'системное окно VK' ? 'VK не подтвердил публикацию.' :
        failure?.status === 400 && typeof failure?.message === 'string' ? failure.message.slice(0, 200) : 'Не удалось завершить публикацию.');
      setPublicationDetails(publicationDiagnostic(stage, failure, draftSaved));
    } finally { if (scopeRef.current === scope) setBusy(false); }
  };

  const removeWidget = async widget => {
    if (!window.confirm(`Удалить «${widget.name}» из приложения?`)) return;
    setBusy(true); setError(''); setNotice(''); setPublicationDetails(''); setFeedbackLocation('top');
    try {
      const data = await deleteWidget(communityId, widget.id, activeId, launchParams);
      if (scopeRef.current !== scope) return;
      setCatalogue(data.widgets); setActiveId(data.activeId || '');
      setNotice('Виджет удалён из приложения.');
    } catch (failure) { if (scopeRef.current === scope) setError(failure.message || 'Не удалось удалить виджет.'); }
    finally { if (scopeRef.current === scope) setBusy(false); }
  };
  const openWidget = widget => { setEditorSession(value => value + 1); setSelectedType(widget.type); setDraft(structuredClone(widget)); setError(''); setNotice(''); setPublicationDetails(''); };

  const selected = TYPE_BY_ID[draft?.type];
  const hint = (required, detail = '') => <small className="widget-requirement">{required ? 'Обязательно для публикации' : 'Необязательно'}{detail ? ` · ${detail}` : ''}</small>;
  const limit = draft?.type === 'list' && draft.detailed ? 3 : selected?.[3];
  const detailedUploadError = error.includes('Ответы:');
  const feedbackAt = location => feedbackLocation === location && (error || notice || publicationDetails) ? <div className="widget-feedback-stack" ref={feedbackRef} aria-live="polite">
    {error || publicationDetails ? <div className="inline-error" role="alert">{publicationDetails ? <div className="widget-upload-diagnostic">
      <span>{error || 'Публикация не подтверждена.'} Скопируйте диагностику и пришлите её разработчику.</span>
      <label>Диагностика публикации VK<textarea readOnly rows={6} value={publicationDetails} onFocus={event => event.target.select()} /></label>
    </div> : detailedUploadError ? <div className="widget-upload-diagnostic">
      <span>Изображение не сохранено. Нажмите на поле ниже, скопируйте диагностику и пришлите её разработчику.</span>
      <label>Диагностика загрузки VK<textarea readOnly rows={6} value={error} onFocus={event => event.target.select()} /></label>
    </div> : <div className="widget-validation-message">{error}</div>}<button type="button" aria-label="Закрыть ошибку" onClick={() => { setError(''); setPublicationDetails(''); }}>×</button></div> : null}
    {notice ? <div className="widget-notice" role="status">{notice}<button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}>×</button></div> : null}
  </div> : null;
  return <section className="widget-workspace" aria-label="Виджеты сообщества">
    <button className="back-button" type="button" disabled={busy} onClick={() => {
      setError(''); setNotice(''); setPublicationDetails('');
      if (draft) setDraft(null); else if (selectedType) setSelectedType(''); else onBack();
    }}>Назад</button>
    <p className="admin-workspace-kicker">PAPA BOT · Сообщество {communityId}</p>
    <h1>{draft ? draft.name || 'Новый виджет' : selectedType ? TYPE_BY_ID[selectedType][1] : 'Виджеты сообщества'}</h1>
    <p>Соберите виджет, проверьте его здесь и подтвердите публикацию в окне VK. Один блок сообщества показывает один опубликованный виджет.</p>
    {feedbackAt('top')}
    {!draft ? <>
      {!selectedType ? <div className="widget-type-grid">{TYPES.map(([type, label, min, max]) => <button className="widget-type-choice" type="button" key={type} disabled={busy} onClick={() => { setSelectedType(type); setError(''); setNotice(''); }}>
        <WidgetTypeThumbnail type={type} />
        <strong>{label}</strong><span>{type === 'text' ? 'Текст и описание' : type === 'donation' ? 'Цель и прогресс сбора' : type === 'table' ? '1–6 столбцов · 1–10 строк' : type === 'match' ? 'Две команды и счёт' : `${min}–${max} элементов`} · Сохранено: {catalogue.filter(widget => widget.type === type).length}</span></button>)}</div> :
        <button className="primary-button widget-create" type="button" disabled={busy} onClick={() => { setEditorSession(value => value + 1); setDraft({ ...createDraft(selectedType), name: '' }); setError(''); setNotice(''); setPublicationDetails(''); }}>+ Создать виджет</button>}
      {selectedType ? <>
      <h2>Сохранённые виджеты</h2>
      <p className="widget-field-hint">Активный — последний опубликованный через приложение. Если видимость изменена напрямую в VK, проверьте её в сообществе. Для удаления активного виджета сначала опубликуйте другой.</p>
      {catalogue.some(widget => widget.type === selectedType) ? <div className="widget-saved-grid">{catalogue.filter(widget => widget.type === selectedType).map(widget => <article className="widget-saved-card" key={widget.id}>
        {widget.rows?.find(row => row.imageUrl)?.imageUrl ? <img src={widget.rows.find(row => row.imageUrl).imageUrl} alt="" /> : EXTRA_TYPES.has(widget.type) ? <WidgetTypeThumbnail type={widget.type} /> : null}
        <h3>{widget.name}</h3><span className={widget.id === activeId ? 'widget-status widget-status-active' : 'widget-status'}>{widget.id === activeId ? 'Активный' : 'Неактивный'}</span>
        <p>{TYPE_BY_ID[widget.type]?.[1] || widget.type}</p>
        <div className="widget-card-actions">
          <button type="button" className="widget-secondary" disabled={busy} onClick={() => openWidget(widget)}>Редактировать</button>
          <button type="button" className="widget-secondary widget-action-publish" disabled={busy} onClick={() => publish(widget)}>{widget.id === activeId ? 'Опубликовать снова' : 'Активировать'}</button>
          <button type="button" className="widget-secondary widget-action-delete" disabled={busy || widget.id === activeId} onClick={() => removeWidget(widget)}>Удалить</button>
        </div>
      </article>)}</div> : <p>В этом разделе пока нет сохранённых виджетов. Создайте первый.</p>}
      </> : null}
    </> : <>
      <div className="widget-editor-grid"><div className="widget-editor-fields">
        <label>Название в кабинете<small className="widget-requirement">Обязательно для черновика и публикации</small><input value={draft.name} maxLength="80" onChange={event => change('name', event.target.value)} /></label>
        <p className="widget-field-hint">Внутреннее название видно только в приложении. Например: «Осенняя акция».</p>
        <label>Заголовок виджета{hint(true)}<input value={draft.title} maxLength="80" onChange={event => change('title', event.target.value)} /></label>
        <label>Ссылка заголовка{hint(false, 'HTTPS-ссылка внутри VK')}<input type="url" value={draft.titleUrl} placeholder="https://vk.ru/..." onChange={event => change('titleUrl', event.target.value)} /></label>
        {!EXTRA_TYPES.has(draft.type) ? <div className="widget-editor-options">
          {!['tiles_wide', 'tiles_square', 'covers', 'clients'].includes(draft.type) ? <label><input type="checkbox" checked={draft.showImages} onChange={event => change('showImages', event.target.checked)} /> Изображения</label> : null}
          {!['reviews', 'clients'].includes(draft.type) ? <label><input type="checkbox" checked={draft.showButtons} onChange={event => change('showButtons', event.target.checked)} /> {draft.type.startsWith('tiles_') ? 'Ссылки под плитками' : 'Кнопки'}</label> : null}
          {draft.type === 'list' ? <label><input type="checkbox" checked={draft.detailed} onChange={event => change('detailed', event.target.checked)} /> Подробное описание</label> : null}
        </div> : null}
        <label>Желаемая аудитория{hint(false, 'по умолчанию — всем')}<select value={draft.visibility} onChange={event => change('visibility', event.target.value)}>
          <option value="all">Всем пользователям</option><option value="subscribers">Подписчикам</option>
          <option value="admins">Администраторам</option><option value="none">Никому — не публиковать</option>
        </select></label>
        <p className="widget-field-hint">Итоговую аудиторию, включая «Никому», выберите в системном окне VK при публикации. Один лишь выбор здесь не меняет видимость в сообществе.</p>
        <label>Текст нижней ссылки{hint(Boolean(draft.moreUrl), 'заполняется вместе с адресом')}<input value={draft.moreText} maxLength="40" onChange={event => change('moreText', event.target.value)} /></label>
        <label>Адрес нижней ссылки{hint(Boolean(draft.moreText), 'заполняется вместе с текстом')}<input type="url" value={draft.moreUrl} placeholder="https://vk.ru/..." onChange={event => change('moreUrl', event.target.value)} /></label>
        <p className="widget-field-hint">Для черновика можно оставить поля публикации пустыми. Для публикации заполните обязательные поля каждого элемента. Ссылки — полные HTTPS-адреса внутри VK.</p>
        {['donation', 'match', 'matches'].includes(draft.type) ? <WidgetIntegrationPanel key={`${communityId}:${editorSession}:${draft.type}`} draft={draft} savedWidget={catalogue.find(widget => widget.id === draft.id)} communityId={communityId} launchParams={launchParams} activeId={activeId} revision={catalogue} change={change} externalBusy={busy} onManagedBalance={setManagedBalance} onImport={(widget, persisted = false) => { setDraft(widget); if (persisted) setCatalogue(current => current.map(item => item.id === widget.id ? widget : item)); }} /> : null}
        {EXTRA_TYPES.has(draft.type) ? <WidgetExtraEditor draft={draft} change={change} changeRow={changeRow} busy={busy} hint={hint} managedBalance={managedBalance?.widgetId === draft.id && managedBalance?.communityId === communityId && managedBalance?.managed} feedbackAt={feedbackAt} onImage={(index, team, file) => setPendingImage({ index, team, file })} /> : <>
        <h2>Элементы <small>{draft.rows.length}/{limit}</small></h2>
        {draft.rows.map((row, index) => <div className="widget-row-editor" key={index}>
          <div className="widget-row-heading"><strong>Элемент {index + 1}</strong><button type="button" onClick={() => removeRow(index)} disabled={busy || draft.rows.length <= selected[2]}>Удалить</button></div>
          <label>{draft.type === 'reviews' ? 'Имя автора' : 'Название'}{hint(true)}<input value={row.title} maxLength="100" onChange={event => changeRow(index, 'title', event.target.value)} /></label>
          <label>{draft.type === 'reviews' ? 'Текст отзыва' : 'Описание'}{hint(draft.type === 'reviews' || (draft.type.startsWith('tiles_') && draft.rows.some(item => item.description?.trim())), draft.type.startsWith('tiles_') ? 'у всех плиток или ни у одной' : '')}<textarea value={row.description} maxLength="300" onChange={event => changeRow(index, 'description', event.target.value)} /></label>
          {draft.detailed ? <label>Подробное описание{hint(false)}<textarea value={row.detail} maxLength="300" onChange={event => changeRow(index, 'detail', event.target.value)} /></label> : null}
          {['list', 'compact_list'].includes(draft.type) ? <div className="widget-inline-fields">
            <label>Адрес{hint(false)}<input value={row.address} maxLength="100" onChange={event => changeRow(index, 'address', event.target.value)} /></label>
            <label>Время{hint(false)}<input value={row.time} maxLength="100" onChange={event => changeRow(index, 'time', event.target.value)} /></label>
          </div> : null}
          <label>{draft.type.startsWith('tiles_') ? 'Адрес плитки' : 'Ссылка элемента'}{hint(draft.type === 'clients' || draft.rows.some(item => item.url?.trim()), draft.type === 'clients' ? 'после ввода нажмите «Загрузить сообщество клиента»' : 'у всех элементов или ни у одного')}<input type="url" value={row.url} placeholder="https://vk.ru/..." onChange={event => {
            changeRow(index, 'url', event.target.value);
          }} /></label>
          {draft.type === 'clients' ? <><button type="button" className="widget-secondary" disabled={busy} onClick={() => loadClient(index)}>Загрузить сообщество клиента</button>{feedbackAt(`client:${index}`)}</> : null}
          {groups.length ? <label>Или страница подписки{hint(false, 'можно выбрать вместо ручного ввода ссылки')}<select value="" onChange={event => {
            const slug = event.target.value;
            if (slug) {
              const url = COMMUNITY_PLUGIN
                ? buildCommunityPluginUrl(communityId, slug)
                : `https://vk.ru/app54600849#${new URLSearchParams({ c: communityId, g: slug })}`;
              changeRow(index, 'url', url);
              changeRow(index, 'buttonUrl', url);
            }
          }}><option value="">Выберите направление</option>{groups.map(group => <option value={group.slug} key={group.slug}>{group.title}</option>)}</select></label> : null}
          {draft.showButtons ? <div className="widget-inline-fields">
            <label>{draft.type.startsWith('tiles_') ? 'Текст ссылки под плиткой' : 'Кнопка'}{hint(Boolean(row.buttonUrl), 'можно оставить действие целиком пустым')}<input value={row.button} maxLength="40" onChange={event => changeRow(index, 'button', event.target.value)} /></label>
            <label>{draft.type.startsWith('tiles_') ? 'Адрес ссылки под плиткой' : 'Ссылка кнопки'}{hint(Boolean(row.button) && !(draft.type.startsWith('tiles_') && row.url), draft.type.startsWith('tiles_') ? 'если пусто, используется адрес плитки' : 'нужен при заполненном тексте кнопки')}<input type="url" value={row.buttonUrl} placeholder="https://vk.ru/..." onChange={event => changeRow(index, 'buttonUrl', event.target.value)} /></label>
          </div> : null}
          {draft.showImages && draft.type !== 'clients' ? <div className="widget-image-picker">{feedbackAt(`image:${index}`)}<label>Изображение для VK
            {hint(['tiles_wide', 'tiles_square', 'covers'].includes(draft.type), 'сначала загрузите кадр в VK')}
            <input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={event => { if (event.target.files?.[0]) setPendingImage({ index, file: event.target.files[0] }); event.target.value = ''; }} />
          </label>{row.imageUrl ? <img src={row.imageUrl} alt={`Изображение элемента ${index + 1}`} /> : null}
          {row.imageId ? <small>Загружено в VK: {row.imageId}</small> : <small>{draft.type === 'covers' ? 'Рекомендуем 510×128' : draft.type === 'tiles_wide' ? 'Рекомендуем 160×240' : draft.type === 'tiles_square' ? 'Рекомендуем 160×160' : 'Рекомендуем 50×50'} · JPG/PNG до 5 МБ</small>}</div> : null}
        </div>)}
        <button type="button" className="widget-secondary" disabled={draft.rows.length >= limit} onClick={addRow}>+ Добавить элемент</button>
        </>}
      </div><div className="widget-preview-pane"><h2>Предпросмотр</h2><WidgetVisual widget={draft} />
        <button type="button" className="widget-secondary widget-preview-open" onClick={() => setFullPreview(true)}>Открыть полный предпросмотр</button>
        <p>Это пример компоновки. Окончательный вид и ссылки проверяются в VK перед публикацией.</p>
        {draft.type.startsWith('tiles_') && draft.rows.length > 3 ? <p>На компьютере VK обычно показывает первые три плитки; остальные доступны в полной карточке.</p> : null}
      </div></div>
      {feedbackAt('actions')}
      <div className="widget-editor-actions"><button type="button" className="widget-secondary" disabled={busy} onClick={save}>{busy ? 'Подождите…' : 'Сохранить черновик'}</button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => publish()}>Проверить и опубликовать в VK</button></div>
      {pendingImage ? <WidgetImageAdjuster file={pendingImage.file} type={draft.type} onCancel={() => setPendingImage(null)} onApply={file => {
        const index = pendingImage.index;
        const team = pendingImage.team;
        setPendingImage(null);
        uploadImage(index, file, team);
      }} /> : null}
      {fullPreview ? <div className="widget-full-preview-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setFullPreview(false); }}>
        <section className="widget-full-preview" role="dialog" aria-modal="true" aria-label="Полный предпросмотр виджета">
          <div className="widget-full-preview-heading"><h2>Полный предпросмотр</h2><button type="button" className="widget-secondary" onClick={() => setFullPreview(false)}>Закрыть</button></div>
          <WidgetVisual widget={draft} />
          <p>Показаны все элементы черновика. Окончательный вид и ссылки подтвердите в системном окне VK.</p>
        </section>
      </div> : null}
    </>}
  </section>;
}
