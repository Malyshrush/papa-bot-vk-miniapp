// Keep the server copy in src/modules/widget-validation.js in sync (contract tested).
function collectWidgetIssues(widget = {}, publication = true) {
  const issues = [];
  const rows = Array.isArray(widget.rows) ? widget.rows : [];
  const has = value => typeof value === 'string' && Boolean(value.trim());
  const add = (field, message) => issues.push({ field, message });
  const tile = ['tiles_wide', 'tiles_square'].includes(widget.type);
  const limits = { tiles_wide: [3, 10], tiles_square: [3, 10], covers: [1, 3], list: [1, widget.detailed ? 3 : 6], compact_list: [1, 6], reviews: [1, 6], clients: [1, 6] }[widget.type];
  if (!limits) { add('type', 'Выберите формат виджета.'); return issues; }
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
