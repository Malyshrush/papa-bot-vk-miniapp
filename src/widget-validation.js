// Keep the server copy in src/modules/widget-validation.js in sync (contract tested).
function collectWidgetIssues(widget = {}, publication = true) {
  const issues = [];
  const rows = Array.isArray(widget.rows) ? widget.rows : [];
  const has = value => typeof value === 'string' && Boolean(value.trim());
  const add = (field, message) => issues.push({ field, message });
  const tile = ['tiles_wide', 'tiles_square'].includes(widget.type);
  const limits = { tiles_wide: [3, 10], tiles_square: [3, 10], covers: [1, 3], list: [1, widget.detailed ? 3 : 6], compact_list: [1, 6], reviews: [1, 6], clients: [1, 6], text: [0, 0], table: [1, 10], match: [1, 1], matches: [1, 6], donation: [0, 0] }[widget.type];
  if (!limits) { add('type', 'Выберите формат виджета.'); return issues; }
  const source = widget.dataSource?.provider || 'manual';
  if (source !== 'manual' && !((widget.type === 'donation' && source === 'donationalerts') || (['match', 'matches'].includes(widget.type) && source === 'api-football'))) add('dataSource.provider', 'Этот источник данных не подходит для выбранного формата.');
  if (source === 'api-football') {
    const ids = Array.isArray(widget.dataSource?.fixtureIds) ? widget.dataSource.fixtureIds : [];
    if (ids.length > (widget.type === 'match' ? 1 : 6) || new Set(ids).size !== ids.length || ids.some(id => !/^[1-9]\d{0,9}$/.test(String(id))) || (publication && !ids.length)) add('dataSource.fixtureIds', 'Укажите ID одного матча или до шести разных ID для списка матчей API-Football.');
  }
  if (!has(widget.name) && (publication || Object.hasOwn(widget, 'name'))) add('name', 'Укажите название виджета для приложения.');
  if (publication && !has(widget.title)) add('title', 'Добавьте заголовок виджета.');
  if (publication && (rows.length < limits[0] || rows.length > limits[1])) add('rows', widget.type === 'list' && widget.detailed ? 'Подробное описание допускает от одного до трёх элементов.' : `Для этого формата требуется от ${limits[0]} до ${limits[1]} элементов.`);
  const url = (field, value, label) => {
    if (!has(value)) return;
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol !== 'https:' || !['vk.ru', 'vk.com', 'vk.me'].includes(parsed.hostname) || parsed.username || parsed.password) throw Error();
    } catch { add(field, `${label}: укажите полную HTTPS-ссылку на vk.ru, vk.com или vk.me.`); }
  };
  url('titleUrl', widget.titleUrl, 'Ссылка заголовка');
  url('moreUrl', widget.moreUrl, 'Адрес нижней ссылки');
  if (publication && has(widget.moreText) && !has(widget.moreUrl)) add('moreUrl', 'Для ссылки внизу укажите адрес.');
  if (publication && has(widget.moreUrl) && !has(widget.moreText)) add('moreText', 'Укажите текст нижней ссылки или очистите её адрес.');
  if (['text', 'table', 'match', 'matches', 'donation'].includes(widget.type)) {
    const length = (field, value, max, label) => { if (String(value ?? '').length > max) add(field, `${label}: не более ${max} символов.`); };
    const integer = (field, value, min, max, label, required = false) => {
      if (value === '' || value === undefined || value === null) { if (publication && required) add(field, `${label}: укажите число.`); return; }
      if (!/^-?\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) add(field, `${label}: нужно целое число от ${min} до ${max}.`);
    };
    if (rows.length > limits[1]) add('rows', `Допускается не более ${limits[1]} элементов.`);
    if (widget.type === 'text') {
      length('text', widget.text, 200, 'Текст'); length('description', widget.description, 200, 'Описание');
    }
    if (widget.type === 'table') {
      const columns = Array.isArray(widget.columns) ? widget.columns : [];
      if (columns.length > 6 || (publication && columns.length < 1)) add('columns', 'В таблице должно быть от 1 до 6 столбцов.');
      columns.forEach((column, index) => {
        length(`columns.${index}.text`, column?.text, 50, `Столбец ${index + 1}`);
        if (column?.align && !['left', 'center', 'right'].includes(column.align)) add(`columns.${index}.align`, `Столбец ${index + 1}: выберите выравнивание.`);
      });
      rows.forEach((row, index) => {
        const cells = Array.isArray(row?.cells) ? row.cells : [];
        if (cells.length > columns.length || (publication && cells.length !== columns.length)) add(`rows.${index}.cells`, `Строка ${index + 1}: число ячеек должно совпадать с числом столбцов.`);
        cells.forEach((cell, at) => { length(`rows.${index}.cells.${at}.text`, cell?.text, 100, `Строка ${index + 1}, столбец ${at + 1}`); url(`rows.${index}.cells.${at}.url`, cell?.url, `Строка ${index + 1}, столбец ${at + 1}, ссылка`); });
      });
    }
    if (['match', 'matches'].includes(widget.type)) rows.forEach((row, index) => {
      const prefix = `Матч ${index + 1}`;
      length(`rows.${index}.state`, row?.state, 50, `${prefix}, состояние`);
      url(`rows.${index}.url`, row?.url, `${prefix}, ссылка`);
      url(`rows.${index}.liveUrl`, row?.liveUrl, `${prefix}, трансляция`);
      for (const team of ['teamA', 'teamB']) {
        const label = `${prefix}, команда ${team === 'teamA' ? '1' : '2'}`;
        if (publication && !has(row?.[team]?.name)) add(`rows.${index}.${team}.name`, `${label}: заполните название.`);
        length(`rows.${index}.${team}.name`, row?.[team]?.name, 50, `${label}, название`);
        length(`rows.${index}.${team}.description`, row?.[team]?.description, 50, `${label}, описание`);
      }
      if (publication && Boolean(row?.teamA?.imageId) !== Boolean(row?.teamB?.imageId)) add(`rows.${index}.teamB.imageId`, `${prefix}: загрузите логотипы обеих команд или удалите оба логотипа.`);
      integer(`rows.${index}.scoreA`, row?.scoreA, -999, 999, `${prefix}, счёт команды 1`, true);
      integer(`rows.${index}.scoreB`, row?.scoreB, -999, 999, `${prefix}, счёт команды 2`, true);
      if (widget.type === 'match') for (const side of ['eventsA', 'eventsB']) {
        const events = Array.isArray(row?.[side]) ? row[side] : [];
        if (events.length > 6) add(`rows.${index}.${side}`, `${prefix}: допускается до 6 событий каждой команды.`);
        events.forEach((event, at) => {
          const label = `${prefix}, команда ${side === 'eventsA' ? '1' : '2'}, событие ${at + 1}`;
          if (publication && !has(event?.event)) add(`rows.${index}.${side}.${at}.event`, `${label}: укажите игрока или событие.`);
          length(`rows.${index}.${side}.${at}.event`, event?.event, 50, label);
          integer(`rows.${index}.${side}.${at}.minute`, event?.minute, 0, 2147483647, `${label}, минута`, true);
        });
      }
    });
    if (widget.type === 'donation') {
      const donation = widget.donation || {};
      length('donation.text', donation.text, 80, 'Цель сбора');
      url('donation.textUrl', donation.textUrl, 'Ссылка цели сбора'); url('donation.buttonUrl', donation.buttonUrl, 'Ссылка кнопки поддержки');
      if (publication && source !== 'donationalerts' && !has(donation.buttonUrl)) add('donation.buttonUrl', 'Укажите ссылку кнопки поддержки на страницу VK.');
      integer('donation.goal', donation.goal, 1, 99999999, 'Целевая сумма', true);
      integer('donation.funded', donation.funded, 0, 99999999, 'Собранная сумма');
      integer('donation.backers', donation.backers, 0, 99999999, 'Число участников');
      if (donation.currency && !['RUB', 'USD', 'UAH', 'BYR', 'EUR', 'MDL', 'AZN', 'GEL', 'AMD', 'ILS', 'GBP', 'TMT', 'BYN', 'KZS', 'KZT'].includes(donation.currency)) add('donation.currency', 'Выберите валюту из списка.');
      const hasStart = donation.start !== '' && donation.start != null;
      const hasEnd = donation.end !== '' && donation.end != null;
      if (publication && hasStart !== hasEnd) add('donation.end', 'Для периода сбора укажите обе даты или очистите обе.');
      integer('donation.start', donation.start, 1, 21474836470, 'Дата начала'); integer('donation.end', donation.end, 1, 21474836470, 'Дата окончания');
      if (publication && hasStart && hasEnd) {
        const now = Date.now() / 1000;
        if (Number(donation.start) >= Number(donation.end)) add('donation.end', 'Окончание сбора должно быть позже начала.');
        const earliest = new Date(now * 1000); earliest.setUTCFullYear(earliest.getUTCFullYear() - 1);
        const latest = new Date(now * 1000); latest.setUTCFullYear(latest.getUTCFullYear() + 10);
        if (Number(donation.start) < earliest.getTime() / 1000) add('donation.start', 'Начало сбора не может быть раньше, чем год назад.');
        if (Number(donation.end) > latest.getTime() / 1000) add('donation.end', 'Окончание сбора не может быть позже, чем через 10 лет.');
      }
    }
    return issues;
  }
  const linked = rows.some(row => has(row?.url));
  const described = tile && rows.some(row => has(row?.description));
  rows.forEach((entry, index) => {
    const row = entry || {};
    const prefix = `Элемент ${index + 1}`;
    const key = field => `rows.${index}.${field}`;
    if (publication && !has(row.title)) add(key('title'), `${prefix}: заполните ${widget.type === 'reviews' ? 'имя автора' : 'название'}.`);
    if (publication && (widget.type === 'reviews' || described) && !has(row.description)) add(key('description'), `${prefix}: заполните ${widget.type === 'reviews' ? 'текст отзыва' : 'описание (у плиток оно заполняется у всех элементов или ни у одного)'}.`);
    url(key('url'), row.url, `${prefix}, ссылка элемента`);
    url(key('buttonUrl'), row.buttonUrl, `${prefix}, ${tile ? 'адрес ссылки под плиткой' : 'ссылка кнопки'}`);
    if (publication && linked && !has(row.url)) add(key('url'), `${prefix}: заполните ссылку элемента. Если один элемент содержит ссылку, заполните ссылки всех элементов или очистите их.`);
    if (publication && widget.showButtons && !['reviews', 'clients'].includes(widget.type)) {
      if (has(row.button) && !has(row.buttonUrl) && !(tile && has(row.url))) add(key('buttonUrl'), `${prefix}: Каждая кнопка или ссылка под плиткой должна иметь адрес. Заполните ${tile ? '«Адрес ссылки под плиткой» (или «Адрес плитки»)' : '«Ссылка кнопки»'} либо удалите текст действия.`);
      if (has(row.buttonUrl) && !has(row.button)) add(key('button'), `${prefix}: укажите ${tile ? 'текст ссылки под плиткой' : 'текст кнопки'} либо очистите адрес действия.`);
    }
    if (publication && ['tiles_wide', 'tiles_square', 'covers'].includes(widget.type) && !has(row.imageId)) add(key('imageId'), `${prefix}: загрузите изображение в VK.`);
    if (publication && widget.type === 'clients') {
      if (!has(row.url)) add(key('url'), `${prefix}: укажите ссылку на сообщество клиента.`);
      if (!/^club\d+$/.test(row.imageId || '')) add(key('imageId'), `${prefix}: нажмите «Загрузить сообщество клиента», чтобы получить его изображение.`);
    }
  });
  return issues;
}

function widgetValidationError(issues, publication = true) {
  const error = new Error(`${publication ? 'Для публикации' : 'Для сохранения черновика'} исправьте поля:\n${issues.map(issue => issue.message).join('\n')}`);
  error.code = 'invalid_widget';
  error.validationIssues = issues;
  return error;
}

export { collectWidgetIssues, widgetValidationError };
