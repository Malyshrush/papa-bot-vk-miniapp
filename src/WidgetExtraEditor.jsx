export const EXTRA_TYPES = new Set(['text', 'table', 'match', 'matches', 'donation']);
export const blankTeam = () => ({ name: '', description: '', imageId: '', imageUrl: '' });
export const blankMatch = () => ({ teamA: blankTeam(), teamB: blankTeam(), scoreA: '', scoreB: '', state: '', liveUrl: '', url: '', eventsA: [], eventsB: [] });
export const blankTableRow = columns => ({ imageId: '', imageUrl: '', cells: columns.map(() => ({ text: '', url: '' })) });
export function extraDraft(type) {
  if (type === 'text') return { text: '', description: '', rows: [] };
  if (type === 'table') { const columns = [{ text: '', align: 'left' }, { text: '', align: 'left' }]; return { columns, rows: [blankTableRow(columns)] }; }
  if (['match', 'matches'].includes(type)) return { rows: [blankMatch()] };
  return { rows: [], donation: { text: '', textUrl: '', buttonUrl: '', currency: 'RUB', goal: '', funded: '0', backers: '0', start: '', end: '' } };
}

function dateValue(timestamp) {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp) * 1000);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function WidgetExtraEditor({ draft, change, changeRow, busy, hint, onImage, feedbackAt, managedBalance }) {
  const image = (value, index, team, label) => <div className="widget-image-picker widget-small-image-picker">
    <label>{label}{hint(false, team ? 'логотипы команд — у обеих или ни у одной' : 'иконка только для первой ячейки')}
      <input type="file" accept="image/jpeg,image/png" disabled={busy} onChange={event => { if (event.target.files?.[0]) onImage(index, team, event.target.files[0]); event.target.value = ''; }} />
    </label>
    {value?.imageUrl ? <img src={value.imageUrl} alt={label} /> : null}
    {value?.imageId ? <><small>Загружено в VK: {value.imageId}</small><button type="button" className="widget-secondary" disabled={busy} onClick={() => {
      if (team) changeRow(index, team, { ...value, imageId: '', imageUrl: '' });
      else change('rows', draft.rows.map((row, at) => at === index ? { ...row, imageId: '', imageUrl: '' } : row));
    }}>Убрать изображение</button></> : <small>{draft.type === 'match' ? '50×50' : '24×24'} · JPG/PNG до 5 МБ</small>}
  </div>;

  if (draft.type === 'text') return <div className="widget-extra-editor">
    <label>Текст виджета{hint(false, 'до 200 символов')}<textarea value={draft.text || ''} maxLength={200} onChange={event => change('text', event.target.value)} /></label>
    <label>Описание под текстом{hint(false, 'до 200 символов')}<textarea value={draft.description || ''} maxLength={200} onChange={event => change('description', event.target.value)} /></label>
  </div>;

  if (draft.type === 'donation') {
    const value = draft.donation || {};
    const update = (field, next) => change('donation', { ...value, [field]: next });
    return <div className="widget-extra-editor">
      <p className="widget-field-hint">{draft.dataSource?.provider === 'donationalerts' ? 'После включения автообновления сумма будет обновляться автоматически. Число участников задаётся вручную. После публикации кнопка виджета откроет страницу перехода к DonationAlerts в Mini App.' : 'Суммы и число участников задаются вручную. Для автоматического учёта выберите DonationAlerts выше.'}</p>
      <label>Цель сбора{hint(false, 'до 80 символов')}<input value={value.text || ''} maxLength={80} onChange={event => update('text', event.target.value)} /></label>
      <label>Ссылка цели сбора{hint(false)}<input type="url" value={value.textUrl || ''} placeholder="https://vk.ru/..." onChange={event => update('textUrl', event.target.value)} /></label>
      {draft.dataSource?.provider !== 'donationalerts' ? <label>Ссылка кнопки поддержки{hint(true, 'страница сбора внутри VK')}<input type="url" value={value.buttonUrl || ''} placeholder="https://vk.ru/..." onChange={event => update('buttonUrl', event.target.value)} /></label> : null}
      <label>Валюта{hint(true)}<select value={value.currency || 'RUB'} onChange={event => update('currency', event.target.value)}>{['RUB', 'USD', 'EUR', 'UAH', 'BYN', 'KZT', 'MDL', 'AZN', 'GEL', 'AMD', 'ILS', 'GBP', 'TMT', 'BYR', 'KZS'].map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>Целевая сумма{hint(true, 'целое число от 1 до 99 999 999')}<input type="number" min={1} max={99999999} step={1} value={value.goal ?? ''} onChange={event => update('goal', event.target.value)} /></label>
      <div className="widget-inline-fields">
        <label>Собранная сумма{hint(false, managedBalance ? 'ведётся сервером; для ручного старта используйте новый период учёта' : 'по умолчанию 0')}<input type="number" min={0} max={99999999} step={1} readOnly={Boolean(managedBalance && draft.dataSource?.provider === 'donationalerts')} value={value.funded ?? ''} onChange={event => update('funded', event.target.value)} /></label>
        <label>Число участников{hint(false, 'по умолчанию 0')}<input type="number" min={0} max={99999999} step={1} value={value.backers ?? ''} onChange={event => update('backers', event.target.value)} /></label>
      </div>
      <div className="widget-inline-fields">{[['start', 'Начало сбора'], ['end', 'Окончание сбора']].map(([field, label]) => <label key={field}>{label}{hint(Boolean(value[field === 'start' ? 'end' : 'start']), 'обе даты или ни одной; ваше местное время')}<input type="datetime-local" value={dateValue(value[field])} onChange={event => update(field, event.target.value ? String(Math.floor(new Date(event.target.value).getTime() / 1000)) : '')} /></label>)}</div>
    </div>;
  }

  if (draft.type === 'table') {
    const columns = draft.columns || [];
    const updateColumn = (at, field, value) => change('columns', columns.map((column, index) => index === at ? { ...column, [field]: value } : column));
    const updateCell = (at, cellIndex, field, value) => changeRow(at, 'cells', draft.rows[at].cells.map((cell, index) => index === cellIndex ? { ...cell, [field]: value } : cell));
    return <div className="widget-extra-editor">
      <h2>Столбцы <small>{columns.length}/6</small></h2>
      <p className="widget-field-hint">От 1 до 6 столбцов и от 1 до 10 строк данных. Заголовки столбцов, отдельные ячейки, ссылки и иконки необязательны.</p>
      {columns.map((column, index) => <div className="widget-row-editor" key={index}>
        <label>Заголовок столбца {index + 1}{hint(false, 'до 50 символов')}<input maxLength={50} value={column.text} onChange={event => updateColumn(index, 'text', event.target.value)} /></label>
        <label>Выравнивание столбца {index + 1}<select value={column.align} onChange={event => updateColumn(index, 'align', event.target.value)}><option value="left">Слева</option><option value="center">По центру</option><option value="right">Справа</option></select></label>
        <button type="button" className="widget-secondary" disabled={busy || columns.length <= 1} onClick={() => {
          change('columns', columns.filter((_, at) => at !== index));
          change('rows', draft.rows.map(row => ({ ...row, cells: row.cells.filter((_, at) => at !== index) })));
        }}>Удалить столбец {index + 1}</button>
      </div>)}
      <button type="button" className="widget-secondary" disabled={busy || columns.length >= 6} onClick={() => {
        change('columns', [...columns, { text: '', align: 'left' }]);
        change('rows', draft.rows.map(row => ({ ...row, cells: [...row.cells, { text: '', url: '' }] })));
      }}>+ Добавить столбец</button>
      <h2>Строки <small>{draft.rows.length}/10</small></h2>
      {draft.rows.map((row, index) => <div className="widget-row-editor" key={index}>
        <div className="widget-row-heading"><strong>Строка {index + 1}</strong><button type="button" disabled={busy || draft.rows.length <= 1} onClick={() => change('rows', draft.rows.filter((_, at) => at !== index))}>Удалить</button></div>
        {columns.map((column, at) => <div className="widget-table-cell-editor" key={at}>
          <label>Строка {index + 1}, столбец {at + 1}{hint(false, 'до 100 символов')}<input maxLength={100} value={row.cells[at]?.text || ''} onChange={event => updateCell(index, at, 'text', event.target.value)} /></label>
          <label>Ссылка ячейки {index + 1}.{at + 1}{hint(false)}<input type="url" value={row.cells[at]?.url || ''} placeholder="https://vk.ru/..." onChange={event => updateCell(index, at, 'url', event.target.value)} /></label>
        </div>)}
        {image(row, index, null, `Иконка первой ячейки строки ${index + 1}`)}{feedbackAt(`image:${index}`)}
      </div>)}
      <button type="button" className="widget-secondary" disabled={busy || draft.rows.length >= 10} onClick={() => change('rows', [...draft.rows, blankTableRow(columns)])}>+ Добавить строку</button>
    </div>;
  }

  return <div className="widget-extra-editor">
    <h2>{draft.type === 'match' ? 'Матч' : `Матчи ${draft.rows.length}/6`}</h2>
    <p className="widget-field-hint">Названия команд и счёт обязательны для публикации. {draft.dataSource?.provider === 'api-football' ? 'Названия, счёт, состояние и доступные голевые события загружаются из API-Football.' : 'Счёт и события обновляются вручную.'} Логотипы необязательны, но указываются для обеих команд.</p>
    {draft.rows.map((row, index) => <div className="widget-row-editor" key={index} role="group" aria-label={`Матч ${index + 1}`}>
      <div className="widget-row-heading"><strong>Матч {index + 1}</strong>{draft.type === 'matches' ? <button type="button" disabled={busy || draft.rows.length <= 1} onClick={() => change('rows', draft.rows.filter((_, at) => at !== index))}>Удалить</button> : null}</div>
      {['teamA', 'teamB'].map((side, at) => <div className="widget-team-editor" key={side}>
        <h3>Команда {at + 1}</h3>
        <label>Название команды {at + 1}{hint(true)}<input value={row[side]?.name || ''} maxLength={50} onChange={event => changeRow(index, side, { ...row[side], name: event.target.value })} /></label>
        <label>Описание команды {at + 1}{hint(false, 'например, город; до 50 символов')}<input value={row[side]?.description || ''} maxLength={50} onChange={event => changeRow(index, side, { ...row[side], description: event.target.value })} /></label>
        <label>Счёт команды {at + 1}{hint(true, 'целое число от −999 до 999')}<input type="number" min={-999} max={999} step={1} value={row[at === 0 ? 'scoreA' : 'scoreB'] ?? ''} onChange={event => changeRow(index, at === 0 ? 'scoreA' : 'scoreB', event.target.value)} /></label>
        {image(row[side], index, side, `Логотип команды ${at + 1}`)}
        {draft.type === 'match' ? <div className="widget-match-events">
          <h3>События команды {at + 1}</h3>
          {(row[at === 0 ? 'eventsA' : 'eventsB'] || []).map((entry, eventIndex) => {
            const eventsKey = at === 0 ? 'eventsA' : 'eventsB';
            const updateEvent = (field, value) => changeRow(index, eventsKey, row[eventsKey].map((item, n) => n === eventIndex ? { ...item, [field]: value } : item));
            return <div key={eventIndex} className="widget-table-cell-editor">
              <label>Игрок или событие {eventIndex + 1}{hint(true, 'если событие добавлено')}<input maxLength={50} value={entry.event} onChange={event => updateEvent('event', event.target.value)} /></label>
              <label>Минута события {eventIndex + 1}{hint(true, 'целое число от 0')}<input type="number" min={0} step={1} value={entry.minute} onChange={event => updateEvent('minute', event.target.value)} /></label>
              <button type="button" className="widget-secondary" onClick={() => changeRow(index, eventsKey, row[eventsKey].filter((_, n) => n !== eventIndex))}>Убрать событие</button>
            </div>;
          })}
          <button type="button" className="widget-secondary" disabled={(row[at === 0 ? 'eventsA' : 'eventsB'] || []).length >= 6} onClick={() => {
            const field = at === 0 ? 'eventsA' : 'eventsB'; changeRow(index, field, [...(row[field] || []), { event: '', minute: '' }]);
          }}>+ Добавить событие команды {at + 1}</button>
        </div> : null}
      </div>)}
      {feedbackAt(`image:${index}`)}
      <label>Состояние матча{hint(false, draft.type === 'matches' ? 'выводится вместо ссылки на трансляцию' : 'до 50 символов')}<input maxLength={50} value={row.state || ''} onChange={event => changeRow(index, 'state', event.target.value)} /></label>
      {draft.type === 'matches' ? <>
        <label>Ссылка матча{hint(false)}<input type="url" value={row.url || ''} placeholder="https://vk.ru/..." onChange={event => changeRow(index, 'url', event.target.value)} /></label>
        <label>Ссылка трансляции{hint(false, 'видна, если состояние матча пустое')}<input type="url" value={row.liveUrl || ''} placeholder="https://vk.ru/video..." onChange={event => changeRow(index, 'liveUrl', event.target.value)} /></label>
      </> : null}
    </div>)}
    {draft.type === 'matches' ? <button type="button" className="widget-secondary" disabled={busy || draft.rows.length >= 6} onClick={() => change('rows', [...draft.rows, blankMatch()])}>+ Добавить матч</button> : null}
  </div>;
}

export function WidgetExtraVisual({ widget }) {
  const rows = widget.rows || [];
  if (widget.type === 'text') return <div className="widget-extra-text"><p>{widget.text}</p>{widget.description ? <small>{widget.description}</small> : null}</div>;
  if (widget.type === 'table') return <table className="widget-data-table"><thead><tr>{(widget.columns || []).map((column, index) => <th key={index} style={{ textAlign: column.align }}>{column.text}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{(widget.columns || []).map((column, at) => <td key={at} style={{ textAlign: column.align }}>{at === 0 && row.imageUrl ? <img src={row.imageUrl} alt="" /> : null}<span className={row.cells?.[at]?.url ? 'widget-preview-link' : ''}>{row.cells?.[at]?.text}</span></td>)}</tr>)}</tbody></table>;
  if (widget.type === 'donation') {
    const donation = widget.donation || {};
    const number = value => new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
    const progress = Number(donation.goal) > 0 ? Math.min(100, Math.max(0, Number(donation.funded || 0) / Number(donation.goal) * 100)) : 0;
    const remaining = donation.end ? Math.max(0, Math.ceil((Number(donation.end) * 1000 - Date.now()) / 86400000)) : null;
    return <div className="widget-donation-preview"><p className={donation.textUrl ? 'widget-preview-link' : ''}>{donation.text}</p><strong>{number(donation.funded)} {donation.currency || 'RUB'}</strong><span>из {number(donation.goal)} {donation.currency || 'RUB'}</span><div className="widget-progress-track" role="progressbar" aria-label="Прогресс сбора" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${progress}%` }} /></div><small>{number(donation.backers)} участников{remaining !== null ? ` · Осталось дней: ${remaining}` : ''}</small><span className="widget-visual-button">Поддержать</span></div>;
  }
  const team = (value, label) => <div className="widget-match-team">{value?.imageUrl ? <img src={value.imageUrl} alt="" /> : null}<strong>{value?.name || label}</strong>{value?.description ? <small>{value.description}</small> : null}</div>;
  return <div className="widget-match-list">{rows.map((row, index) => <div className="widget-match-preview" key={index}>
    <div className="widget-match-scoreline">{team(row.teamA, 'Команда 1')}<strong className="widget-match-score">{row.scoreA === '' || row.scoreA == null ? '—' : row.scoreA} : {row.scoreB === '' || row.scoreB == null ? '—' : row.scoreB}</strong>{team(row.teamB, 'Команда 2')}</div>
    {row.state ? <small>{row.state}</small> : widget.type === 'matches' && row.liveUrl ? <small className="widget-preview-link">Трансляция</small> : null}
    {widget.type === 'match' ? <div className="widget-match-event-columns">{['eventsA', 'eventsB'].map(side => <div key={side}>{(row[side] || []).map((event, at) => <small key={at}>{event.event}{event.minute !== '' ? ` · ${event.minute}′` : ''}</small>)}</div>)}</div> : null}
  </div>)}</div>;
}
