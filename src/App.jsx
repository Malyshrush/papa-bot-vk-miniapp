import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createLoginAutoStart } from './handoff-login.js';
import { flushSync } from 'react-dom';
import { completeVkHandoff, createAdminGroup, createCabinetLogin, failVkHandoff, loadAdminGroups, loadGroup, loadGroups, saveAdminDisplay, subscribeGroup, unsubscribeGroup } from './api.js';
import { addMiniAppToCommunity, allowMessagesFromGroup, navigateMiniAppRedirect, openExternalServiceLink, parseLaunchParams, parseRouteHash, requestPapaBotUserToken, setGroupHash } from './vk.js';

const DEFAULT_COMMUNITY_ID = import.meta.env.VITE_DEFAULT_COMMUNITY_ID || '229445618';
const PAPA_BOT_SERVICE_URL = import.meta.env.VITE_PAPA_BOT_SERVICE_URL || 'https://functions.yandexcloud.net/d4eg37ikm3vl5tm1mjld';
const DEFAULT_ACTION_COLOR = '#2f6fed';
const ONBOARDING_VERSION = '2026-07-28-v1';
const ONBOARDING_STORAGE_KEY = 'papa-bot-miniapp-onboarding';
const THEME_STORAGE_PREFIX = 'papa-bot-miniapp-theme';
const NOTICE_DURATION_MS = 5000;

const EMPTY_STATE = {
  loading: true,
  error: '',
  errorCode: '',
  communityId: '',
  slug: '',
  groups: [],
  group: null,
  featuredGroup: null,
  display: { mode: 'list-icons', featuredSlug: '' },
  intro: false,
  admin: false,
  connectUserToken: false,
  handoff: '',
  handoffTicket: ''
};

const COPY = {
  appTitle: 'PAPA BOT',
  appLead: 'PAPA BOT помогает администраторам VK-сообществ собирать подписчиков в группы по интересам, запускать рассылки и автоматические сценарии.',
  subscriberTitle: 'Для подписчика',
  subscriberText: 'Пользователь открывает Mini App, выбирает нужную группу, разрешает сообщения от сообщества и подписывается на подходящее направление.',
  adminTitle: 'Для администратора',
  adminText: 'Администратор настраивает группы, заголовки, описания, изображения и тексты кнопок в панели PAPA BOT, а затем использует эти группы для сегментации и коммуникаций.',
  demoText: 'Ниже показаны группы сообщества, доступные для подписки через Mini App.',
  subscribed: '\u0412\u044b \u0432 \u0433\u0440\u0443\u043f\u043f\u0435',
  back: '\u041d\u0430\u0437\u0430\u0434',
  saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c...',
  openByCommunity: '\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 Mini App \u043f\u043e \u0441\u0441\u044b\u043b\u043a\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0430',
  loadFailed: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0434\u0430\u043d\u043d\u044b\u0435',
  unsubscribeFailed: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0442\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f',
  allowMessages: '\u0414\u043b\u044f \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f',
  openInVkForSubscribe: '\u0414\u043b\u044f \u0440\u0435\u0430\u043b\u044c\u043d\u043e\u0439 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438 \u043e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 Mini App \u0432\u043d\u0443\u0442\u0440\u0438 VK: \u0442\u0430\u043a VK \u043f\u0435\u0440\u0435\u0434\u0430\u0451\u0442 \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f.',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430',
  loadingGroups: '\u041f\u043e\u043b\u0443\u0447\u0430\u0435\u043c \u0433\u0440\u0443\u043f\u043f\u044b \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0430',
  groupsTitle: 'Подписные сообщества',
  noGroups: '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0445 \u0433\u0440\u0443\u043f\u043f \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.'
};

const ONBOARDING_STEPS = [
  {
    icon: '🎯',
    eyebrow: 'Шаг 1 из 3',
    title: 'Выбирайте только интересное',
    text: 'PAPA BOT показывает направления конкретного сообщества. Вы выбираете темы, новости или предложения, которые хотите получать.',
    points: ['Никаких случайных подписок', 'Понятное описание каждого направления']
  },
  {
    icon: '💬',
    eyebrow: 'Шаг 2 из 3',
    title: 'Подписка в два действия',
    text: 'Откройте карточку направления, нажмите «Подписаться» и разрешите сообщения от сообщества. Выбор сохранится в PAPA BOT.',
    points: ['Разрешение запрашивается только при подписке', 'Сообщения отправляет выбранное VK-сообщество']
  },
  {
    icon: '✓',
    eyebrow: 'Шаг 3 из 3',
    title: 'Вы управляете подписками',
    text: 'Подключённые направления отмечены в списке. В любой момент откройте карточку и нажмите «Отписаться».',
    points: ['Статус виден прямо в приложении', 'Вернуться к обучению можно через меню «Главная страница»']
  }
];

function hasCompletedOnboarding() {
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_VERSION;
  } catch (error) {
    return false;
  }
}

function rememberCompletedOnboarding() {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_VERSION);
  } catch (error) {
    // VK WebView can restrict storage; onboarding still closes for the current session.
  }
}

function getThemeStorageKey(userId) {
  return `${THEME_STORAGE_PREFIX}:${String(userId || 'browser')}`;
}

function getInitialTheme(storageKey) {
  try {
    const savedTheme = window.localStorage.getItem(storageKey);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (error) {
    return 'light';
  }
}

function rememberTheme(storageKey, theme) {
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch (error) {
    // VK WebView can restrict storage; the selected theme still works for this session.
  }
}

function subscriptionStorageKey(userId, communityId, slug) {
  return `papa-bot-miniapp-subscription:${String(userId || 'browser')}:${String(communityId || '')}:${String(slug || '')}`;
}

function rememberSubscription(userId, communityId, slug, subscribed) {
  try {
    const key = subscriptionStorageKey(userId, communityId, slug);
    if (subscribed) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch (error) {}
}

function readRememberedSubscription(userId, communityId, slug) {
  try {
    return window.localStorage.getItem(subscriptionStorageKey(userId, communityId, slug)) === '1';
  } catch (error) {
    return false;
  }
}

function Onboarding({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex];
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  return (
    <main className="onboarding-shell">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-brand">
          <span className="brand-mark">PB</span>
          <span>PAPA BOT</span>
        </div>
        <div className="onboarding-progress" aria-label={`Шаг ${stepIndex + 1} из ${ONBOARDING_STEPS.length}`}>
          {ONBOARDING_STEPS.map((item, index) => (
            <span className={index <= stepIndex ? 'is-active' : ''} key={item.title} />
          ))}
        </div>
        <div className="onboarding-visual" aria-hidden="true">{step.icon}</div>
        <p className="onboarding-eyebrow">{step.eyebrow}</p>
        <h1 id="onboarding-title">{step.title}</h1>
        <p className="onboarding-text">{step.text}</p>
        <ul className="onboarding-points">
          {step.points.map((point) => <li key={point}>{point}</li>)}
        </ul>
        <div className="onboarding-actions">
          {stepIndex > 0 ? (
            <button className="secondary-button" type="button" onClick={() => setStepIndex((index) => index - 1)}>
              Назад
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={onComplete}>
              Перейти к группам
            </button>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              if (isLast) {
                onComplete();
              } else {
                setStepIndex((index) => index + 1);
              }
            }}
          >
            {isLast ? 'Начать' : 'Далее'}
          </button>
        </div>
        <p className="onboarding-legal">
          Продолжая, вы принимаете <a href="./legal/terms.html" target="_blank" rel="noreferrer">условия использования</a>
          {' '}и <a href="./legal/privacy.html" target="_blank" rel="noreferrer">политику конфиденциальности</a>.
        </p>
      </section>
    </main>
  );
}

function PlaceholderImage({ type }) {
  return <div className={`placeholder placeholder-${type}`}>{type === 'banner' ? 'PAPA BOT' : 'PB'}</div>;
}

function GroupImage({ src, alt, type }) {
  if (!src) return <PlaceholderImage type={type} />;
  return <img className={`group-${type}`} src={src} alt={alt} loading="lazy" />;
}

function StatusView({ title, text, onOpenCabinet, onRetry, cabinetBusy, cabinetNotice }) {
  return (
    <main className="app-shell app-shell-center">
      <section className={`notice${onOpenCabinet || onRetry ? ' notice-with-action' : ''}`}>
        <h1>{title}</h1>
        <p>{text}</p>
        {onRetry ? <button className="primary-button" type="button" onClick={onRetry}>Повторить загрузку</button> : null}
        {onOpenCabinet ? <>
          <p>Войдите или зарегистрируйтесь в личном кабинете, затем откройте «НАСТРОЙКА» и добавьте своё сообщество.</p>
          <button className="primary-button" type="button" disabled={cabinetBusy} onClick={onOpenCabinet}>
            {cabinetBusy ? 'Открываем кабинет...' : 'Открыть личный кабинет PAPA BOT'}
          </button>
          {cabinetNotice ? <p role="alert">{cabinetNotice}</p> : null}
        </> : null}
      </section>
    </main>
  );
}

function LoadingTitle() {
  const [loadingDots, setLoadingDots] = useState(1);
  useEffect(() => {
    const timer = window.setInterval(() => setLoadingDots(value => value === 5 ? 1 : value + 1), 350);
    return () => window.clearInterval(timer);
  }, []);
  return <span aria-label={COPY.loading}>{COPY.loading}<span className="loading-title-dots" aria-hidden="true">{'.'.repeat(loadingDots)}</span></span>;
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';
  return (
    <button
      className={`theme-toggle ${isDark ? 'is-dark' : 'is-light'}`}
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Включена тёмная тема. Переключить на светлую' : 'Включена светлая тема. Переключить на тёмную'}
      onClick={onToggle}
    >
      <span className="theme-toggle-icon" aria-hidden="true">☀</span>
      <span className="theme-toggle-icon" aria-hidden="true">☾</span>
      <span className="theme-toggle-thumb" aria-hidden="true" />
    </button>
  );
}

function HeaderActions({ theme, onToggleTheme }) {
  return (
    <div className="view-actions">
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </div>
  );
}

function ServiceIntro({ theme, onToggleTheme, installBusy, installNotice, cabinetBusy, onAddToCommunity, onOpenService }) {
  return (
    <section className="intro" aria-labelledby="service-title">
      <div className="intro-hero">
        <div className="intro-heading">
          <span className="intro-badge">VK Mini App</span>
          <HeaderActions theme={theme} onToggleTheme={onToggleTheme} />
        </div>
        <h1 id="service-title">{COPY.appTitle}</h1>
        <p>{COPY.appLead}</p>
        <div className="community-install-action">
          <div className="service-entry-actions">
            <button className="primary-button" type="button" disabled={installBusy} onClick={onAddToCommunity}>
              {installBusy ? 'Открываем список сообществ...' : 'Добавить в сообщество'}
            </button>
            <button className="secondary-button" type="button" disabled={cabinetBusy} onClick={onOpenService}>{cabinetBusy ? 'Открываем кабинет...' : 'Кабинет в PAPA BOT'}</button>
          </div>
          <span>Администратор сможет выбрать своё сообщество VK и добавить в него приложение.</span>
          {installNotice ? <strong role="status">{installNotice}</strong> : null}
        </div>
      </div>
    </section>
  );
}

function VkHandoffConnect({ purpose, busy, error, notice, onConnect }) {
  const content = purpose === 'link_vk'
    ? { title: 'Привязка VK к профилю', text: 'Привяжите текущий аккаунт VK и сразу предоставьте доступ к функциям выбранного сообщества.', security: 'VK ID и доступ подключаются за один проход. Ключ передаётся только серверу PAPA BOT и не сохраняется в браузере.', action: 'Привязать VK', busy: 'Привязываем VK...' }
    : purpose === 'login'
      ? { title: 'Вход в PAPA BOT', text: 'Проверяем текущий аккаунт VK…', security: 'Если другой активной сессии нет, кабинет завершит вход автоматически. Если сессия уже открыта, для её безопасной замены понадобится только код из email — логин и пароль повторно вводить не нужно.', action: 'Повторить вход', busy: 'Подтверждаем вход...' }
      : { title: 'Доступ к функциям сообщества', text: 'Подтвердите разрешения аккаунтом, который является администратором выбранного сообщества.', security: 'Ключ доступа передаётся напрямую серверу PAPA BOT, не показывается в кабинете и не сохраняется в браузере.', action: 'Предоставить доступ', busy: 'Подключаем VK...' };
  return (
    <main className="vk-login-shell">
      <section className="vk-login-card" aria-labelledby="vk-login-title">
        <span className="intro-badge">PAPA BOT · VK</span>
        <h1 id="vk-login-title">{content.title}</h1>
        <p>{content.text}</p>
        <p className="vk-login-security">{content.security}</p>
        {purpose !== 'login' || error ? <button className="primary-button vk-login-button" type="button" disabled={busy || !!notice} onClick={onConnect}>
          {busy ? content.busy : content.action}
        </button> : null}
        {notice ? <strong className="vk-login-success" role="status">{notice}</strong> : null}
        {error ? <div className="inline-error" role="alert">{error}</div> : null}
      </section>
      <LegalFooter />
    </main>
  );
}

function EmptyGroups({ onShowOnboarding }) {
  return (
    <section className="empty-groups">
      <div className="empty-groups-icon" aria-hidden="true">☰</div>
      <h2>Направления пока не опубликованы</h2>
      <p>Администратор сообщества ещё не добавил доступные подписки. Когда они появятся, здесь будут карточки с описанием и кнопкой подключения.</p>
      <button className="secondary-button" type="button" onClick={onShowOnboarding}>Посмотреть, как это работает</button>
    </section>
  );
}

function LegalFooter() {
  return (
    <footer className="legal-footer">
      <a href="./legal/terms.html" target="_blank" rel="noreferrer">Соглашение</a>
      <span>·</span>
      <a href="./legal/privacy.html" target="_blank" rel="noreferrer">Конфиденциальность</a>
      <span>·</span>
      <a href="./legal/consent.html" target="_blank" rel="noreferrer">Согласие на ОПД</a>
    </footer>
  );
}

function normalizeButtonColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim())
    ? String(value).trim().toLowerCase()
    : DEFAULT_ACTION_COLOR;
}

function getReadableButtonTextColor(backgroundColor) {
  const hex = normalizeButtonColor(backgroundColor).slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return ((red * 299 + green * 587 + blue * 114) / 1000) >= 165 ? '#10203a' : '#ffffff';
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function GroupList({ groups, onOpen, mode = 'list-icons' }) {
  return (
    <div className={`group-list group-list--${mode}`}>
      {groups.map((group) => (
        <button className="group-card" type="button" key={group.slug} onClick={() => onOpen(group.slug)}>
          {mode !== 'list' ? <GroupImage src={group.iconUrl} alt={group.title} type="icon" /> : null}
          <span className="group-card-copy">
            <strong>{group.title}</strong>
            {group.description ? <span>{group.description}</span> : null}
          </span>
          {group.subscribed ? <span className="subscribed-mark">{COPY.subscribed}</span> : null}
        </button>
      ))}
    </div>
  );
}

function GroupDetail({ group, busy, busyDots, onBack, onToggle, redirectLink, featured = false }) {
  const buttonText = group.subscribed ? group.unsubscribeText : group.subscribeText;
  const buttonColor = normalizeButtonColor(group.subscribed ? group.unsubscribeColor : group.subscribeColor);
  const buttonStyle = { backgroundColor: buttonColor, color: getReadableButtonTextColor(buttonColor) };
  return (
    <article className="detail">
      {!featured ? <button className="back-button" type="button" onClick={onBack}>{COPY.back}</button> : null}
      <GroupImage src={group.bannerUrl} alt={group.title} type="banner" />
      <div className="detail-copy">
        <h1>{group.title}</h1>
        {group.description ? <p>{group.description}</p> : null}
      </div>
      <button className="primary-button subscription-button" type="button" style={buttonStyle} disabled={busy} aria-busy={busy} onClick={onToggle}>
        {busy ? `В процессе${'.'.repeat(busyDots)}` : buttonText}
      </button>
      {redirectLink ? (
        <div className="post-action-redirect" role="status">
          <span>Переход не открылся автоматически. Нажмите:</span>
          <a className="secondary-button post-action-redirect-link" href={redirectLink.url} target="_top" rel="noopener noreferrer">
            {redirectLink.mode === 'community' ? 'Открыть сообщество' : redirectLink.mode === 'messages' ? 'Открыть сообщения' : 'Открыть ссылку'}
          </a>
        </div>
      ) : null}
    </article>
  );
}

function DisplaySettings({ groups, value, busy, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value.mode, value.featuredSlug]);
  const visibleGroups = groups.filter(group => group.enabled && !group.hidden);
  return (
    <form className="display-settings" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <h2>Вид главной страницы</h2>
      <p>Выберите, как подписные группы выглядят у посетителей сообщества.</p>
      <div className="display-options" role="radiogroup" aria-label="Вид главной страницы">
        {[
          ['list', 'Список'], ['list-icons', 'Список с иконками'],
          ['tiles', 'Плитка'], ['single', 'Определённая подписная страница']
        ].map(([mode, label]) => <label key={mode}><input type="radio" name="miniapp-display" checked={draft.mode === mode} onChange={() => setDraft(current => ({ ...current, mode }))} />{label}</label>)}
      </div>
      {draft.mode === 'single' ? <label className="display-featured-label">Выберите группу подписчиков
        <select value={draft.featuredSlug} required onChange={(event) => setDraft(current => ({ ...current, featuredSlug: event.target.value }))}>
          <option value="">Выберите группу</option>
          {visibleGroups.map(group => <option key={group.slug} value={group.slug}>{group.title}</option>)}
        </select>
      </label> : null}
      <button className="primary-button" type="submit" disabled={busy}>{busy ? COPY.saving : 'Сохранить вид'}</button>
    </form>
  );
}

function AppMenu({ title, canManage, onHome, onSubscriptions, onSettings, onCabinet, onShowOnboarding }) {
  const [open, setOpen] = useState(false);
  const choose = (action) => { setOpen(false); action(); };
  return <div className="app-menu-wrap">
    <button className="app-menu-toggle" type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{title} <span aria-hidden="true">⌄</span></button>
    {open ? <div className="app-menu-backdrop" onClick={() => setOpen(false)}><nav className="app-menu" aria-label="Разделы приложения" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={() => choose(onHome)}>⌂ <span>Главная страница</span></button>
      <button type="button" onClick={() => choose(onSubscriptions)}>✓ <span>Мои подписки</span></button>
      <button type="button" onClick={() => choose(onShowOnboarding)}>ⓘ <span>Как это работает</span></button>
      {canManage ? <button type="button" onClick={() => choose(onSettings)}>⚙ <span>Настройки</span></button> : null}
      {canManage ? <button type="button" onClick={() => choose(onCabinet)}>↗ <span>Личный кабинет</span></button> : null}
    </nav></div> : null}
  </div>;
}

function AdminWorkspace({ groups, display, busy, onBack, onCreate, onSaveDisplay }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    await onCreate({ title, description });
    setTitle('');
    setDescription('');
  };
  return (
    <section className="admin-workspace" aria-labelledby="admin-workspace-title">
      <button className="back-button" type="button" onClick={onBack}>{COPY.back}</button>
      <p className="admin-workspace-kicker">PAPA BOT · Администратору</p>
      <h1 id="admin-workspace-title">Направления подписок</h1>
      <p>Добавьте направление — оно сразу появится у пользователей этого сообщества.</p>
      <DisplaySettings groups={groups} value={display} busy={busy} onSave={onSaveDisplay} />
      <form className="admin-group-form" onSubmit={submit}>
        <label>Название<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength="80" placeholder="Например, Новости" required /></label>
        <label>Описание<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength="500" placeholder="Что получит подписчик" /></label>
        <button className="primary-button" type="submit" disabled={busy}>{busy ? COPY.saving : 'Добавить направление'}</button>
      </form>
      <h2>Опубликовано</h2>
      {groups.length ? <ul className="admin-group-list">{groups.map((group) => <li key={group.slug}><strong>{group.title}</strong><span>{group.description || 'Без описания'}</span></li>)}</ul> : <p className="admin-workspace-empty">Пока нет ни одного направления.</p>}
    </section>
  );
}

export default function App() {
  const autoStartLogin = useMemo(() => createLoginAutoStart(), []);
  const completingHandoff = useRef(false);
  const launchParams = useMemo(() => parseLaunchParams(), []);
  const initialRoute = useMemo(() => parseRouteHash(), []);
  const themeStorageKey = useMemo(() => getThemeStorageKey(launchParams.vk_user_id), [launchParams.vk_user_id]);
  const [theme, setTheme] = useState(() => getInitialTheme(themeStorageKey));
  const [state, setState] = useState(EMPTY_STATE);
  const [adminGroups, setAdminGroups] = useState([]);
  const [adminDisplay, setAdminDisplay] = useState({ mode: 'list-icons', featuredSlug: '' });
  const [section, setSection] = useState('home');
  const [busy, setBusy] = useState(false);
  const [busyDots, setBusyDots] = useState(1);
  const redirectGeneration = useRef(0);
  const [installBusy, setInstallBusy] = useState(false);
  const [cabinetBusy, setCabinetBusy] = useState(false);
  const [installNotice, setInstallNotice] = useState('');
  const [connectNotice, setConnectNotice] = useState('');
  const [redirectLink, setRedirectLink] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !initialRoute.handoff && !hasCompletedOnboarding());
  const canManageCommunity = ['admin', 'editor'].includes(String(launchParams.vk_viewer_group_role || '').toLowerCase()) && String(launchParams.vk_group_id || '') === String(state.communityId || '');
  const needsCabinet = (state.errorCode === 'community_not_connected' && state.admin)
    || (state.errorCode === 'community_not_found' && canManageCommunity);

  const loadCurrentRoute = useCallback(async (preserveRedirect = false) => {
    if (!preserveRedirect) {
      redirectGeneration.current += 1;
      setRedirectLink(null);
    }
    const route = parseRouteHash();
    const handoffCommunityId = route.communityId || launchParams.vk_group_id || '';
    const communityId = route.communityId || launchParams.vk_group_id || DEFAULT_COMMUNITY_ID;
    const intro = !route.communityId && !launchParams.vk_group_id;
    if (!communityId) {
      setState({ ...EMPTY_STATE, loading: false, error: COPY.openByCommunity });
      return;
    }

    if (route.handoff && route.handoffTicket) {
      setShowOnboarding(false);
      setState({ ...EMPTY_STATE, loading: false, communityId: handoffCommunityId, intro: false, connectUserToken: route.connectUserToken, handoff: route.handoff, handoffTicket: route.handoffTicket, error: !launchParams.sign || !launchParams.vk_user_id ? 'Откройте вход кнопкой «Войти через VK» в кабинете PAPA BOT: для проверки аккаунта нужен запуск внутри VK.' : '' });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: '', errorCode: '', communityId, slug: route.slug, intro, admin: route.admin, connectUserToken: false, handoff: '', handoffTicket: '' }));
    try {
      if (route.admin) {
        const data = await loadAdminGroups(communityId, launchParams);
        setAdminGroups(data.groups || []);
        setAdminDisplay(data.display || { mode: 'list-icons', featuredSlug: '' });
        setState({ loading: false, error: '', communityId, slug: '', groups: [], group: null, intro: false, admin: true });
      } else if (route.slug) {
        const data = await loadGroup(communityId, route.slug, launchParams);
        const rememberedSubscribed = readRememberedSubscription(launchParams.vk_user_id, communityId, route.slug);
        const group = data.group && rememberedSubscribed ? { ...data.group, subscribed: true } : data.group;
        setState({ loading: false, error: '', communityId, slug: route.slug, groups: [], group, intro: false });
      } else {
        const data = await loadGroups(communityId, launchParams);
        setState({ loading: false, error: '', communityId, slug: '', groups: data.groups || [], group: null, featuredGroup: data.featuredGroup || null, display: data.display || { mode: 'list-icons', featuredSlug: '' }, intro });
      }
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || COPY.loadFailed, errorCode: error.code || '', intro }));
    }
  }, [launchParams]);

  useEffect(() => {
    loadCurrentRoute();
    const loadChangedRoute = () => loadCurrentRoute();
    window.addEventListener('hashchange', loadChangedRoute);
    return () => window.removeEventListener('hashchange', loadChangedRoute);
  }, [loadCurrentRoute]);

  useEffect(() => {
    if (!busy) {
      setBusyDots(1);
      return undefined;
    }
    const timer = window.setInterval(() => setBusyDots(value => value === 5 ? 1 : value + 1), 350);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const refreshAfterExternalNavigation = () => {
      if (document.visibilityState === 'visible') {
        loadCurrentRoute(true);
      }
    };
    document.addEventListener('visibilitychange', refreshAfterExternalNavigation);
    return () => document.removeEventListener('visibilitychange', refreshAfterExternalNavigation);
  }, [loadCurrentRoute]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    rememberTheme(themeStorageKey, theme);
  }, [theme, themeStorageKey]);

  useEffect(() => {
    if (!state.error || state.handoff || needsCabinet) return undefined;
    if (!state.group && state.groups.length === 0) return undefined;
    const currentNotice = state.error;
    const noticeTimeoutId = window.setTimeout(() => {
      setState((currentState) => currentState.error === currentNotice
        ? { ...currentState, error: '' }
        : currentState);
    }, NOTICE_DURATION_MS);
    return () => window.clearTimeout(noticeTimeoutId);
  }, [state.error, state.handoff, needsCabinet]);

  const openGroup = (slug) => setGroupHash(state.communityId, slug);
  const backToList = () => setGroupHash(state.communityId);
  const openHome = () => { setSection('home'); backToList(); };
  const openSubscriptions = () => { setSection('subscriptions'); backToList(); };
  const openAdmin = () => { window.location.hash = new URLSearchParams({ c: state.communityId, admin: '1' }).toString(); };
  const completeOnboarding = () => {
    rememberCompletedOnboarding();
    setShowOnboarding(false);
  };
  const toggleTheme = () => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  const openService = async () => {
    setCabinetBusy(true);
    setInstallNotice('');
    try {
      if (!launchParams.sign || !launchParams.vk_user_id) {
        await openExternalServiceLink(PAPA_BOT_SERVICE_URL);
        return;
      }
      const handoff = await createCabinetLogin(launchParams);
      if (!handoff.ticket) throw new Error('Сервер не создал запрос входа.');
      await openExternalServiceLink(`${PAPA_BOT_SERVICE_URL}?vkMiniAppCabinet=${encodeURIComponent(handoff.ticket)}`);
    } catch (error) {
      if (error?.code === 'vk_profile_not_linked') {
        setInstallNotice('Сначала войдите в кабинет обычным способом. После входа сразу откроется раздел ПРОФИЛЬ для привязки VK.');
        await openExternalServiceLink(`${PAPA_BOT_SERVICE_URL}?linkVkAfterLogin=1`);
        return;
      }
      setInstallNotice(error?.message || 'Не удалось открыть кабинет PAPA BOT.');
    } finally {
      setCabinetBusy(false);
    }
  };

  const completeHandoff = async () => {
    if (!state.handoff || !state.handoffTicket || completingHandoff.current) return;
    completingHandoff.current = true;
    setBusy(true);
    setConnectNotice('');
    setState((prev) => ({ ...prev, error: '' }));
    try {
      if (!launchParams.sign || !launchParams.vk_user_id) {
        throw new Error('Откройте приложение PAPA BOT внутри VK и повторите вход.');
      }
      const payload = {};
      if (state.handoff === 'user_token' || (state.handoff === 'link_vk' && state.communityId)) {
        const tokenGrant = await requestPapaBotUserToken();
        payload.accessToken = tokenGrant.accessToken;
        payload.scope = tokenGrant.scope;
      }
      const result = await completeVkHandoff(state.handoffTicket, payload, launchParams);
      if (result.linked && result.connected === false && result.connectionError) {
        setState((prev) => ({ ...prev, error: result.message || 'VK ID привязан, но доступ к сообществу не получен. Повторите попытку.' }));
      } else {
        setConnectNotice(state.handoff === 'login' ? 'Аккаунт VK подтверждён. Кабинет завершит вход автоматически или запросит только код из email, если нужно заменить другую активную сессию.' : (result.message || 'VK подключён. Кабинет обновится автоматически.'));
      }
    } catch (error) {
      let failure = null;
      if (state.handoff === 'link_vk' || state.handoff === 'user_token') {
        failure = await failVkHandoff(state.handoffTicket, error?.handoffReason || 'vk_bridge_failed', launchParams).catch(() => null);
      }
      setState((prev) => ({ ...prev, error: failure?.message || error?.message || 'Не удалось подключить VK. Повторите попытку.' }));
    } finally {
      completingHandoff.current = false;
      setBusy(false);
    }
  };

  const openCabinetRegistration = async () => {
    setCabinetBusy(true);
    setInstallNotice('');
    try {
      if (!await openExternalServiceLink(PAPA_BOT_SERVICE_URL)) {
        throw new Error('Не удалось открыть личный кабинет PAPA BOT. Повторите попытку.');
      }
    } catch (error) {
      setInstallNotice(error?.message || 'Не удалось открыть личный кабинет PAPA BOT.');
    } finally {
      setCabinetBusy(false);
    }
  };

  useEffect(() => {
    autoStartLogin(state, launchParams, completeHandoff);
  }, [state.handoff, state.handoffTicket, launchParams, autoStartLogin]);

  const addToCommunity = async () => {
    setInstallBusy(true);
    setInstallNotice('');
    try {
      const result = await addMiniAppToCommunity();
      const groupId = String(result?.group_id || '').trim();
      setInstallNotice(groupId
        ? `Приложение добавлено в сообщество ${groupId}. Откройте приложение из меню сообщества.`
        : 'Приложение добавлено. Откройте приложение из меню сообщества.');
    } catch (error) {
      setInstallNotice(error?.message || 'Не удалось добавить приложение. Откройте Mini App внутри VK и повторите попытку.');
    } finally {
      setInstallBusy(false);
    }
  };

  const navigateAfterAction = async (mode, url, communityId, generation) => {
    flushSync(() => setBusy(false));
    await waitForNextPaint();
    const currentHref = window.location.href;
    const navigation = navigateMiniAppRedirect(mode, url, communityId);
    if (!navigation.url) return;
    const fallback = () => {
      if (redirectGeneration.current === generation && window.location.href === currentHref && document.visibilityState === 'visible') {
        setRedirectLink({ url: navigation.url, mode });
      }
    };
    if (navigation.attempted) window.setTimeout(fallback, 1500);
    else fallback();
  };

  const toggleSubscription = async () => {
    const activeGroup = state.group || state.featuredGroup;
    if (!activeGroup || !state.communityId) return;
    const generation = ++redirectGeneration.current;
    setRedirectLink(null);
    setBusy(true);
    try {
      if (!launchParams.sign || !launchParams.vk_user_id) {
        throw new Error(COPY.openInVkForSubscribe);
      }
      if (!activeGroup.subscribed) {
        const data = await subscribeGroup(state.communityId, activeGroup.slug, launchParams);
        const updatedGroup = data.group || { ...activeGroup, subscribed: true };
        flushSync(() => {
          setState((prev) => ({ ...prev, [prev.group ? 'group' : 'featuredGroup']: updatedGroup, groups: prev.groups.map(group => group.slug === activeGroup.slug ? { ...group, subscribed: true } : group) }));
        });
        rememberSubscription(launchParams.vk_user_id, state.communityId, activeGroup.slug, true);
        try {
          await allowMessagesFromGroup(state.communityId);
        } catch {
          // Subscription is already saved. VK message permission is optional and must not roll it back.
        }
        await navigateAfterAction(updatedGroup.subscribeRedirectMode, updatedGroup.subscribeRedirectUrl, state.communityId, generation);
      } else {
        const data = await unsubscribeGroup(state.communityId, activeGroup.slug, launchParams);
        const updatedGroup = data.group || { ...activeGroup, subscribed: false };
        flushSync(() => {
          setState((prev) => ({ ...prev, [prev.group ? 'group' : 'featuredGroup']: updatedGroup, groups: prev.groups.map(group => group.slug === activeGroup.slug ? { ...group, subscribed: false } : group) }));
        });
        rememberSubscription(launchParams.vk_user_id, state.communityId, activeGroup.slug, false);
        await navigateAfterAction(updatedGroup.unsubscribeRedirectMode, updatedGroup.unsubscribeRedirectUrl, state.communityId, generation);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: activeGroup.subscribed
          ? (error.message || COPY.unsubscribeFailed)
          : (error.message || COPY.allowMessages)
      }));
    } finally {
      setBusy(false);
    }
  };

  const addAdminGroup = async (group) => {
    if (!state.communityId) return;
    setBusy(true);
    try {
      const data = await createAdminGroup(state.communityId, group, launchParams);
      setAdminGroups((current) => [...current, data.group]);
    } catch (error) {
      setState((prev) => ({ ...prev, error: error.message || COPY.loadFailed, errorCode: error.code || '' }));
    } finally {
      setBusy(false);
    }
  };

  const updateAdminDisplay = async (display) => {
    setBusy(true);
    try {
      const data = await saveAdminDisplay(state.communityId, display, launchParams);
      setAdminDisplay(data.display);
      setState(prev => ({ ...prev, error: '' }));
    } catch (error) {
      setState(prev => ({ ...prev, error: error.message || 'Не удалось сохранить вид главной страницы.' }));
    } finally {
      setBusy(false);
    }
  };

  if (showOnboarding) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  if (state.loading) {
    return <StatusView title={<LoadingTitle />} text={COPY.loadingGroups} />;
  }

  if (state.handoff && state.handoffTicket) {
    return <VkHandoffConnect purpose={state.handoff} busy={busy} error={state.error} notice={connectNotice} onConnect={completeHandoff} />;
  }

  if (state.error && !state.group && state.groups.length === 0) {
    if (needsCabinet) {
      return <StatusView title="Подключите сообщество" text={state.error} onOpenCabinet={openCabinetRegistration} cabinetBusy={cabinetBusy} cabinetNotice={installNotice} />;
    }
    if (state.intro) {
      return (
        <main className="app-shell">
          <AppMenu title="Главная страница" canManage={false} onHome={openHome} onSubscriptions={openSubscriptions} onShowOnboarding={() => setShowOnboarding(true)} />
          <ServiceIntro theme={theme} onToggleTheme={toggleTheme} installBusy={installBusy} installNotice={installNotice} cabinetBusy={cabinetBusy} onAddToCommunity={addToCommunity} onOpenService={openService} />
          <div className="inline-error">{state.error}</div>
          <button className="primary-button" type="button" onClick={() => loadCurrentRoute()}>Повторить загрузку</button>
          <LegalFooter />
        </main>
      );
    }
    return <StatusView title="Mini App" text={state.error} onRetry={() => loadCurrentRoute()} />;
  }

  return (
    <main className="app-shell">
      <AppMenu
        title={state.admin ? 'Настройки' : section === 'subscriptions' ? 'Мои подписки' : state.group ? state.group.title : 'Главная страница'}
        canManage={canManageCommunity}
        onHome={openHome}
        onSubscriptions={openSubscriptions}
        onSettings={openAdmin}
        onCabinet={openCabinetRegistration}
        onShowOnboarding={() => setShowOnboarding(true)}
      />
      {state.admin ? (
        <>
          {state.error ? <div className="inline-error">{state.error}</div> : null}
          <AdminWorkspace groups={adminGroups} display={adminDisplay} busy={busy} onBack={backToList} onCreate={addAdminGroup} onSaveDisplay={updateAdminDisplay} />
        </>
      ) : state.group ? (
        <>
          <div className="detail-toolbar">
            <HeaderActions theme={theme} onToggleTheme={toggleTheme} />
          </div>
          {state.error ? <div className="inline-error">{state.error}</div> : null}
          <GroupDetail group={state.group} busy={busy} busyDots={busyDots} onBack={backToList} onToggle={toggleSubscription} redirectLink={redirectLink} />
        </>
      ) : (
        <>
          {state.intro ? <ServiceIntro theme={theme} onToggleTheme={toggleTheme} installBusy={installBusy} installNotice={installNotice} cabinetBusy={cabinetBusy} onAddToCommunity={addToCommunity} onOpenService={openService} /> : null}
          <header className="list-header">
            <h1>{section === 'subscriptions' ? 'Мои подписки' : COPY.groupsTitle}</h1>
            <div className="view-actions">{canManageCommunity ? <div className="admin-entry-actions"><button className="help-button" type="button" onClick={openAdmin}>Настроить</button><button className="help-button" type="button" disabled={cabinetBusy} onClick={openCabinetRegistration}>{cabinetBusy ? 'Открываем...' : 'Личный кабинет'}</button></div> : null}{!state.intro ? <HeaderActions theme={theme} onToggleTheme={toggleTheme} /> : null}</div>
          </header>
          {installNotice ? <div className="inline-error" role="alert">{installNotice}</div> : null}
          {state.error && !state.intro ? <div className="inline-error">{state.error}</div> : null}
          {section === 'home' && state.display?.mode === 'single' && state.featuredGroup ? (
            <GroupDetail group={state.featuredGroup} featured busy={busy} busyDots={busyDots} onToggle={toggleSubscription} redirectLink={redirectLink} />
          ) : (section === 'subscriptions' ? state.groups.filter(group => group.subscribed) : state.groups).length ? (
            <GroupList groups={section === 'subscriptions' ? state.groups.filter(group => group.subscribed) : state.groups} mode={section === 'subscriptions' ? 'list-icons' : state.display?.mode || 'list-icons'} onOpen={openGroup} />
          ) : (
            section === 'subscriptions' ? <p className="empty-subscriptions">Пока нет подписок. Откройте главную страницу и выберите интересную группу.</p> : <EmptyGroups onShowOnboarding={() => setShowOnboarding(true)} />
          )}
        </>
      )}
      <LegalFooter />
    </main>
  );
}
