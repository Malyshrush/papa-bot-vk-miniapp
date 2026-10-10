import { useEffect, useState } from 'react';
import { confirmWidget, loadWidgets, previewWidget, saveWidget } from './api.js';
import { showCommunityWidgetPreview } from './vk.js';
import { resolveWidgetClient, uploadWidgetImage } from './widget-images.js';
import WidgetImageAdjuster from './WidgetImageAdjuster.jsx';

const TYPES = [
  ['tiles_wide', 'Прямоугольные плитки', 3, 10],
  ['tiles_square', 'Квадратные плитки', 3, 10],
  ['covers', 'Обложки с акцией', 1, 3],
  ['list', 'Список', 1, 6],
  ['compact_list', 'Компактный список', 1, 6],
  ['reviews', 'Отзывы', 1, 6],
  ['clients', 'Наши клиенты', 1, 6]
];
const TYPE_BY_ID = Object.fromEntries(TYPES.map(type => [type[0], type]));
const EMPTY_ROW = { title: '', description: '', detail: '', address: '', time: '', button: '', url: '', buttonUrl: '', imageId: '', imageUrl: '' };

function createDraft(type) {
  return { type, name: TYPE_BY_ID[type][1], title: '', titleUrl: '', moreText: '', moreUrl: '',
    visibility: 'all', showImages: true, showButtons: !['reviews', 'clients'].includes(type), detailed: false,
    rows: Array.from({ length: TYPE_BY_ID[type][2] }, () => ({ ...EMPTY_ROW })) };
}

function previewClass(type) {
  if (type.startsWith('tiles_')) return `widget-visual--${type}`;
  return `widget-visual--${type}`;
}

function WidgetVisual({ widget }) {
  return <div className={`widget-visual ${previewClass(widget.type)}`}>
    <div className="widget-visual-top"><strong>{widget.title || widget.name}</strong><span>{widget.visibility === 'none' ? 'Не показывается' : 'Предпросмотр'}</span></div>
    <div className="widget-visual-rows">{widget.rows.map((row, index) => <div className="widget-visual-row" key={index}>
      {widget.showImages && row.imageUrl ? <img src={row.imageUrl} alt="" /> : widget.showImages && row.imageId ? <span className="widget-visual-image-id">✓</span> : null}
      <div className="widget-visual-copy"><strong>{row.title || `Элемент ${index + 1}`}</strong>
        {row.description ? <span>{row.description}</span> : null}
        {widget.detailed && row.detail ? <small>{row.detail}</small> : null}
        {row.address ? <small>⌖ {row.address}</small> : null}
        {row.time ? <small>◷ {row.time}</small> : null}
      </div>
      {widget.showButtons && row.button ? <span className="widget-visual-button">{row.button}</span> : null}
    </div>)}</div>
  </div>;
}

export default function WidgetWorkspace({ communityId, launchParams, groups, onBack }) {
  const [catalogue, setCatalogue] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [fullPreview, setFullPreview] = useState(false);

  useEffect(() => {
    if (!error) return undefined;
    const timeout = window.setTimeout(() => setError(''), 12000);
    return () => window.clearTimeout(timeout);
  }, [error]);
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(''), 7000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!fullPreview) return undefined;
    const close = event => { if (event.key === 'Escape') setFullPreview(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [fullPreview]);

  const refresh = async () => {
    const data = await loadWidgets(communityId, launchParams);
    setCatalogue(data.widgets || []);
    setActiveId(data.activeId || '');
    return data;
  };

  useEffect(() => {
    let live = true;
    loadWidgets(communityId, launchParams).then(data => {
      if (live) { setCatalogue(data.widgets || []); setActiveId(data.activeId || ''); }
    }).catch(failure => { if (live) setError(failure.message || 'Не удалось загрузить виджеты.'); });
    return () => { live = false; };
  }, [communityId, launchParams]);

  const change = (key, value) => setDraft(current => ({ ...current, [key]: value }));
  const changeRow = (index, key, value) => setDraft(current => ({ ...current, rows: current.rows.map((row, at) => at === index ? { ...row, [key]: value } : row) }));
  const addRow = () => setDraft(current => ({ ...current, rows: [...current.rows, { ...EMPTY_ROW }] }));
  const removeRow = (index) => setDraft(current => ({ ...current, rows: current.rows.filter((_, at) => at !== index) }));
  const uploadImage = async (index, file) => {
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const image = await uploadWidgetImage(communityId, draft.type, file, launchParams);
      setDraft(current => ({ ...current, rows: current.rows.map((row, at) => at === index ? { ...row, ...image } : row) }));
      setNotice('Изображение загружено в VK. Сохраните черновик.');
    } catch (failure) { setError(failure.message || 'Не удалось загрузить изображение в VK.'); }
    finally { setBusy(false); }
  };
  const loadClient = async (index) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const client = await resolveWidgetClient(communityId, draft.rows[index].url, launchParams);
      setDraft(current => ({ ...current, rows: current.rows.map((row, at) => at === index ? { ...row, ...client } : row) }));
      setNotice('Сообщество клиента найдено в VK. Сохраните черновик.');
    } catch (failure) { setError(failure.message || 'VK не нашёл клиента.'); }
    finally { setBusy(false); }
  };

  const persist = async (notify = true) => {
    const data = await saveWidget(communityId, draft, launchParams);
    setDraft(data.widget);
    await refresh();
    if (notify) setNotice('Черновик сохранён. Сообщество пока не изменено.');
    return data.widget;
  };

  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await persist(); } catch (failure) { setError(failure.message || 'Не удалось сохранить виджет.'); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await persist(false);
      const fresh = await refresh();
      const previous = fresh.widgets?.find(widget => widget.id === fresh.activeId);
      if (previous && previous.id !== saved.id && previous.type !== saved.type &&
        !window.confirm('Публикация этого виджета отключит виджет другого типа. Продолжить?')) return;
      const compiled = await previewWidget(communityId, saved.id, launchParams);
      const accepted = await showCommunityWidgetPreview(communityId, compiled.type, compiled.code);
      if (!accepted) { setNotice('Публикация отменена в VK. Черновик сохранён.'); return; }
      const confirmed = await confirmWidget(communityId, saved.id, fresh.activeId || '', launchParams);
      setActiveId(confirmed.activeId);
      setNotice('Системное окно VK завершилось без ошибки. Проверьте блок в сообществе: это ещё не подтверждение его публикации.');
    } catch (failure) {
      setError(failure.message || 'VK не подтвердил публикацию. Черновик сохранён.');
    } finally { setBusy(false); }
  };

  const selected = TYPE_BY_ID[draft?.type];
  const limit = draft?.type === 'list' && draft.detailed ? 3 : selected?.[3];
  return <section className="widget-workspace" aria-label="Виджеты сообщества">
    <button className="back-button" type="button" onClick={draft ? () => setDraft(null) : onBack}>Назад</button>
    <p className="admin-workspace-kicker">PAPA BOT · Сообщество {communityId}</p>
    <h1>{draft ? draft.name : 'Виджеты сообщества'}</h1>
    <p>Соберите виджет, проверьте его здесь и подтвердите публикацию в окне VK. Один блок сообщества показывает один опубликованный виджет.</p>
    {error || notice ? <div className="widget-feedback-stack" aria-live="polite">
      {error ? <div className="inline-error" role="alert">{error}<button type="button" aria-label="Закрыть ошибку" onClick={() => setError('')}>×</button></div> : null}
      {notice ? <div className="widget-notice" role="status">{notice}<button type="button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}>×</button></div> : null}
    </div> : null}
    {!draft ? <>
      <div className="widget-type-grid">{TYPES.map(([type, label, min, max]) => <button className="widget-type-choice" type="button" key={type} onClick={() => { setDraft(createDraft(type)); setError(''); setNotice(''); }}>
        <strong>{label}</strong><span>{min}–{max} элементов</span></button>)}</div>
      <h2>Мои виджеты</h2>
      {catalogue.length ? <div className="widget-draft-list">{catalogue.map(widget => <button type="button" key={widget.id} onClick={() => { setDraft(widget); setError(''); setNotice(''); }}>
        <strong>{widget.name}</strong><span>{TYPE_BY_ID[widget.type]?.[1] || widget.type} · {widget.id === activeId ? 'последний выбранный в окне VK · проверьте на странице' : 'черновик'}</span>
      </button>)}</div> : <p>Черновиков пока нет. Выберите формат выше.</p>}
    </> : <>
      <div className="widget-editor-grid"><div className="widget-editor-fields">
        <label>Название в кабинете<input value={draft.name} maxLength="80" onChange={event => change('name', event.target.value)} /></label>
        <label>Заголовок виджета<input value={draft.title} maxLength="80" onChange={event => change('title', event.target.value)} /></label>
        <label>Ссылка заголовка<input type="url" value={draft.titleUrl} placeholder="https://vk.ru/..." onChange={event => change('titleUrl', event.target.value)} /></label>
        <div className="widget-editor-options">
          {!['tiles_wide', 'tiles_square', 'covers', 'clients'].includes(draft.type) ? <label><input type="checkbox" checked={draft.showImages} onChange={event => change('showImages', event.target.checked)} /> Изображения</label> : null}
          {!['reviews', 'clients'].includes(draft.type) ? <label><input type="checkbox" checked={draft.showButtons} onChange={event => change('showButtons', event.target.checked)} /> Кнопки</label> : null}
          {draft.type === 'list' ? <label><input type="checkbox" checked={draft.detailed} onChange={event => change('detailed', event.target.checked)} /> Подробное описание</label> : null}
        </div>
        <label>Желаемая аудитория<select value={draft.visibility} onChange={event => change('visibility', event.target.value)}>
          <option value="all">Всем пользователям</option><option value="subscribers">Подписчикам</option>
          <option value="admins">Администраторам</option><option value="none">Никому — не публиковать</option>
        </select></label>
        <p className="widget-field-hint">Итоговую аудиторию, включая «Никому», выберите в системном окне VK при публикации. Один лишь выбор здесь не меняет видимость в сообществе.</p>
        <label>Текст нижней ссылки<input value={draft.moreText} maxLength="40" onChange={event => change('moreText', event.target.value)} /></label>
        <label>Адрес нижней ссылки<input type="url" value={draft.moreUrl} placeholder="https://vk.ru/..." onChange={event => change('moreUrl', event.target.value)} /></label>
        <h2>Элементы <small>{draft.rows.length}/{limit}</small></h2>
        {draft.rows.map((row, index) => <div className="widget-row-editor" key={index}>
          <div className="widget-row-heading"><strong>Элемент {index + 1}</strong><button type="button" onClick={() => removeRow(index)} disabled={busy || draft.rows.length <= selected[2]}>Удалить</button></div>
          <label>{draft.type === 'reviews' ? 'Имя автора' : 'Название'}<input value={row.title} maxLength="100" onChange={event => changeRow(index, 'title', event.target.value)} /></label>
          <label>{draft.type === 'reviews' ? 'Текст отзыва' : 'Описание'}<textarea value={row.description} maxLength="300" onChange={event => changeRow(index, 'description', event.target.value)} /></label>
          {draft.detailed ? <label>Подробное описание<textarea value={row.detail} maxLength="300" onChange={event => changeRow(index, 'detail', event.target.value)} /></label> : null}
          {['list', 'compact_list'].includes(draft.type) ? <div className="widget-inline-fields">
            <label>Адрес<input value={row.address} maxLength="100" onChange={event => changeRow(index, 'address', event.target.value)} /></label>
            <label>Время<input value={row.time} maxLength="100" onChange={event => changeRow(index, 'time', event.target.value)} /></label>
          </div> : null}
          <label>Ссылка элемента<input type="url" value={row.url} placeholder="https://vk.ru/..." onChange={event => changeRow(index, 'url', event.target.value)} /></label>
          {draft.type === 'clients' ? <button type="button" className="widget-secondary" disabled={busy} onClick={() => loadClient(index)}>Загрузить сообщество клиента</button> : null}
          {groups.length ? <label>Или страница подписки<select value="" onChange={event => {
            const slug = event.target.value;
            if (slug) {
              const url = `https://vk.ru/app54600849#${new URLSearchParams({ c: communityId, g: slug })}`;
              changeRow(index, 'url', url);
              changeRow(index, 'buttonUrl', url);
            }
          }}><option value="">Выберите направление</option>{groups.map(group => <option value={group.slug} key={group.slug}>{group.title}</option>)}</select></label> : null}
          {draft.showButtons ? <div className="widget-inline-fields">
            <label>Кнопка<input value={row.button} maxLength="40" onChange={event => changeRow(index, 'button', event.target.value)} /></label>
            <label>Ссылка кнопки<input type="url" value={row.buttonUrl} placeholder="https://vk.ru/..." onChange={event => changeRow(index, 'buttonUrl', event.target.value)} /></label>
          </div> : null}
          {draft.showImages && draft.type !== 'clients' ? <div className="widget-image-picker"><label>Изображение для VK
            <input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={event => { if (event.target.files?.[0]) setPendingImage({ index, file: event.target.files[0] }); event.target.value = ''; }} />
          </label>{row.imageUrl ? <img src={row.imageUrl} alt={`Изображение элемента ${index + 1}`} /> : null}
          {row.imageId ? <small>Загружено в VK: {row.imageId}</small> : <small>{draft.type === 'covers' ? 'Рекомендуем 510×128' : draft.type === 'tiles_wide' ? 'Рекомендуем 160×240' : draft.type === 'tiles_square' ? 'Рекомендуем 160×160' : 'Рекомендуем 50×50'} · JPG/PNG до 5 МБ</small>}</div> : null}
        </div>)}
        <button type="button" className="widget-secondary" disabled={draft.rows.length >= limit} onClick={addRow}>+ Добавить элемент</button>
      </div><div className="widget-preview-pane"><h2>Предпросмотр</h2><WidgetVisual widget={draft} />
        <button type="button" className="widget-secondary widget-preview-open" onClick={() => setFullPreview(true)}>Открыть полный предпросмотр</button>
        <p>Это пример компоновки. Окончательный вид и ссылки проверяются в VK перед публикацией.</p>
        {draft.type.startsWith('tiles_') && draft.rows.length > 3 ? <p>На компьютере VK обычно показывает первые три плитки; остальные доступны в полной карточке.</p> : null}
      </div></div>
      <div className="widget-editor-actions"><button type="button" className="widget-secondary" disabled={busy} onClick={save}>{busy ? 'Подождите…' : 'Сохранить черновик'}</button>
        <button type="button" className="primary-button" disabled={busy} onClick={publish}>Проверить и опубликовать в VK</button></div>
      {pendingImage ? <WidgetImageAdjuster file={pendingImage.file} type={draft.type} onCancel={() => setPendingImage(null)} onApply={file => {
        const index = pendingImage.index;
        setPendingImage(null);
        uploadImage(index, file);
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
