import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { completeVkHandoff, createAdminGroup, createCabinetLogin, loadAdminGroups, loadGroup, loadGroups, subscribeGroup, unsubscribeGroup } from './api.js';
import { addMiniAppToCommunity, allowMessagesFromGroup, openExternalServiceLink, openMiniAppRedirect, parseLaunchParams, parseRouteHash, requestPapaBotUserToken, setGroupHash } from './vk.js';

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
  communityId: '',
  slug: '',
  groups: [],
  group: null,
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
    points: ['Статус виден прямо в приложении', 'Вернуться к обучению можно по кнопке «Как это работает»']
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

function StatusView({ title, text }) {
  return (
    <main className="app-shell app-shell-center">
      <section className="notice">
        <h1>{title}</h1>
        <p>{text}</p>
      </section>
    </main>
  );
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

function HeaderActions({ onShowOnboarding, theme, onToggleTheme }) {
  return (
    <div className="view-actions">
      <button className="help-button" type="button" onClick={onShowOnboarding}>Как это работает</button>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </div>
  );
}

function ServiceIntro({ onShowOnboarding, theme, onToggleTheme, installBusy, installNotice, cabinetBusy, onAddToCommunity, onOpenService }) {
  return (
    <section className="intro" aria-labelledby="service-title">
      <div className="intro-hero">
        <div className="intro-heading">
          <span className="intro-badge">VK Mini App</span>
          <HeaderActions onShowOnboarding={onShowOnboarding} theme={theme} onToggleTheme={onToggleTheme} />
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
    ? { title: 'Привязка VK к профилю', text: 'Подтвердите привязку текущего аккаунта VK к открытому профилю PAPA BOT.', security: 'Пароль и отдельная страница VK ID не нужны.', action: 'Подтвердить привязку', busy: 'Привязываем VK...' }
    : purpose === 'login'
      ? { title: 'Вход в PAPA BOT', text: 'Подтвердите вход текущим аккаунтом VK.', security: 'После подтверждения вернитесь во вкладку кабинета — вход завершится автоматически.', action: 'Продолжить вход', busy: 'Подтверждаем вход...' }
      : { title: 'Доступ к функциям сообщества', text: 'Подтвердите разрешения аккаунтом, который является администратором выбранного сообщества.', security: 'Ключ доступа передаётся напрямую серверу PAPA BOT, не показывается в кабинете и не сохраняется в браузере.', action: 'Предоставить доступ', busy: 'Подключаем VK...' };
  return (
    <main className="vk-login-shell">
      <section className="vk-login-card" aria-labelledby="vk-login-title">
        <span className="intro-badge">PAPA BOT · VK</span>
        <h1 id="vk-login-title">{content.title}</h1>
        <p>{content.text}</p>
        <p className="vk-login-security">{content.security}</p>
        <button className="primary-button vk-login-button" type="button" disabled={busy || !!notice} onClick={onConnect}>
          {busy ? content.busy : content.action}
        </button>
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

function GroupList({ groups, onOpen }) {
  return (
    <div className="group-list">
      {groups.map((group) => (
        <button className="group-card" type="button" key={group.slug} onClick={() => onOpen(group.slug)}>
          <GroupImage src={group.iconUrl} alt={group.title} type="icon" />
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

function GroupDetail({ group, busy, onBack, onToggle }) {
  const buttonText = group.subscribed ? group.unsubscribeText : group.subscribeText;
  const buttonColor = normalizeButtonColor(group.subscribed ? group.unsubscribeColor : group.subscribeColor);
  const buttonStyle = { backgroundColor: buttonColor, color: getReadableButtonTextColor(buttonColor) };
  return (
    <article className="detail">
      <button className="back-button" type="button" onClick={onBack}>{COPY.back}</button>
      <GroupImage src={group.bannerUrl} alt={group.title} type="banner" />
      <div className="detail-copy">
        <h1>{group.title}</h1>
        {group.description ? <p>{group.description}</p> : null}
      </div>
      <button className="primary-button subscription-button" type="button" style={buttonStyle} disabled={busy} onClick={onToggle}>
        {busy ? COPY.saving : buttonText}
      </button>
    </article>
  );
}

function AdminWorkspace({ groups, busy, onBack, onCreate }) {
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
  const launchParams = useMemo(() => parseLaunchParams(), []);
  const initialRoute = useMemo(() => parseRouteHash(), []);
  const themeStorageKey = useMemo(() => getThemeStorageKey(launchParams.vk_user_id), [launchParams.vk_user_id]);
  const [theme, setTheme] = useState(() => getInitialTheme(themeStorageKey));
  const [state, setState] = useState(EMPTY_STATE);
  const [adminGroups, setAdminGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [cabinetBusy, setCabinetBusy] = useState(false);
  const [installNotice, setInstallNotice] = useState('');
  const [connectNotice, setConnectNotice] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => !initialRoute.handoff && !hasCompletedOnboarding());

  const loadCurrentRoute = useCallback(async () => {
    const route = parseRouteHash();
    const communityId = route.communityId || launchParams.vk_group_id || DEFAULT_COMMUNITY_ID;
    const intro = !route.communityId && !launchParams.vk_group_id;
    if (!communityId) {
      setState({ ...EMPTY_STATE, loading: false, error: COPY.openByCommunity });
      return;
    }

    if (route.handoff && route.handoffTicket) {
      setShowOnboarding(false);
      setState({ ...EMPTY_STATE, loading: false, communityId, intro: false, connectUserToken: route.connectUserToken, handoff: route.handoff, handoffTicket: route.handoffTicket });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: '', communityId, slug: route.slug, intro, admin: route.admin, connectUserToken: false, handoff: '', handoffTicket: '' }));
    try {
      if (route.admin) {
        const data = await loadAdminGroups(communityId, launchParams);
        setAdminGroups(data.groups || []);
        setState({ loading: false, error: '', communityId, slug: '', groups: [], group: null, intro: false, admin: true });
      } else if (route.slug) {
        const data = await loadGroup(communityId, route.slug, launchParams);
        const rememberedSubscribed = readRememberedSubscription(launchParams.vk_user_id, communityId, route.slug);
        const group = data.group && rememberedSubscribed ? { ...data.group, subscribed: true } : data.group;
        setState({ loading: false, error: '', communityId, slug: route.slug, groups: [], group, intro: false });
      } else {
        const data = await loadGroups(communityId, launchParams);
        setState({ loading: false, error: '', communityId, slug: '', groups: data.groups || [], group: null, intro });
      }
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || COPY.loadFailed, intro }));
    }
  }, [launchParams]);

  useEffect(() => {
    loadCurrentRoute();
    window.addEventListener('hashchange', loadCurrentRoute);
    return () => window.removeEventListener('hashchange', loadCurrentRoute);
  }, [loadCurrentRoute]);

  useEffect(() => {
    const refreshAfterExternalNavigation = () => {
      if (document.visibilityState === 'visible') {
        loadCurrentRoute();
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
    if (!state.error) return undefined;
    const currentNotice = state.error;
    const noticeTimeoutId = window.setTimeout(() => {
      setState((currentState) => currentState.error === currentNotice
        ? { ...currentState, error: '' }
        : currentState);
    }, NOTICE_DURATION_MS);
    return () => window.clearTimeout(noticeTimeoutId);
  }, [state.error]);

  const openGroup = (slug) => setGroupHash(state.communityId, slug);
  const backToList = () => setGroupHash(state.communityId);
  const openAdmin = () => { window.location.hash = new URLSearchParams({ c: state.communityId, admin: '1' }).toString(); };
  const canManageCommunity = ['admin', 'editor'].includes(String(launchParams.vk_viewer_group_role || '').toLowerCase()) && String(launchParams.vk_group_id || '') === String(state.communityId || '');
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
    if (!state.handoff || !state.handoffTicket) return;
    setBusy(true);
    setConnectNotice('');
    setState((prev) => ({ ...prev, error: '' }));
    try {
      if (!launchParams.sign || !launchParams.vk_user_id) {
        throw new Error('Откройте приложение PAPA BOT внутри VK и повторите вход.');
      }
      const payload = {};
      if (state.handoff === 'user_token') {
        const tokenGrant = await requestPapaBotUserToken();
        payload.accessToken = tokenGrant.accessToken;
        payload.scope = tokenGrant.scope;
      }
      const result = await completeVkHandoff(state.handoffTicket, payload, launchParams);
      setConnectNotice(result.message || (state.handoff === 'link_vk' ? 'VK успешно привязан. Вернитесь в кабинет PAPA BOT.' : state.handoff === 'login' ? 'Вход подтверждён. Вернитесь во вкладку кабинета.' : 'VK успешно подключён. Вернитесь в кабинет PAPA BOT.'));
    } catch (error) {
      setState((prev) => ({ ...prev, error: error?.message || 'Не удалось подключить VK. Повторите попытку.' }));
    } finally {
      setBusy(false);
    }
  };

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

  const toggleSubscription = async () => {
    if (!state.group || !state.communityId) return;
    setBusy(true);
    try {
      if (!launchParams.sign || !launchParams.vk_user_id) {
        throw new Error(COPY.openInVkForSubscribe);
      }
      if (!state.group.subscribed) {
        const data = await subscribeGroup(state.communityId, state.group.slug, launchParams);
        const updatedGroup = data.group || { ...state.group, subscribed: true };
        flushSync(() => {
          setState((prev) => ({ ...prev, group: updatedGroup }));
          setBusy(false);
        });
        rememberSubscription(launchParams.vk_user_id, state.communityId, state.group.slug, true);
        await waitForNextPaint();
        try {
          await allowMessagesFromGroup(state.communityId);
        } catch {
          // Subscription is already saved. VK message permission is optional and must not roll it back.
        }
        openMiniAppRedirect(updatedGroup.subscribeRedirectMode, updatedGroup.subscribeRedirectUrl, state.communityId);
      } else {
        const data = await unsubscribeGroup(state.communityId, state.group.slug, launchParams);
        const updatedGroup = data.group || { ...state.group, subscribed: false };
        flushSync(() => {
          setState((prev) => ({ ...prev, group: updatedGroup }));
          setBusy(false);
        });
        rememberSubscription(launchParams.vk_user_id, state.communityId, state.group.slug, false);
        await waitForNextPaint();
        openMiniAppRedirect(updatedGroup.unsubscribeRedirectMode, updatedGroup.unsubscribeRedirectUrl, state.communityId);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: state.group.subscribed
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
      setState((prev) => ({ ...prev, error: error.message || COPY.loadFailed }));
    } finally {
      setBusy(false);
    }
  };

  if (showOnboarding) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  if (state.loading) {
    return <StatusView title={COPY.loading} text={COPY.loadingGroups} />;
  }

  if (state.handoff && state.handoffTicket) {
    return <VkHandoffConnect purpose={state.handoff} busy={busy} error={state.error} notice={connectNotice} onConnect={completeHandoff} />;
  }

  if (state.error && !state.group && state.groups.length === 0) {
    if (state.intro) {
      return (
        <main className="app-shell">
              <ServiceIntro onShowOnboarding={() => setShowOnboarding(true)} theme={theme} onToggleTheme={toggleTheme} installBusy={installBusy} installNotice={installNotice} cabinetBusy={cabinetBusy} onAddToCommunity={addToCommunity} onOpenService={openService} />
          <div className="inline-error">{state.error}</div>
          <LegalFooter />
        </main>
      );
    }
    return <StatusView title="Mini App" text={state.error} />;
  }

  return (
    <main className="app-shell">
      {state.admin ? (
        <>
          {state.error ? <div className="inline-error">{state.error}</div> : null}
          <AdminWorkspace groups={adminGroups} busy={busy} onBack={backToList} onCreate={addAdminGroup} />
        </>
      ) : state.group ? (
        <>
          <div className="detail-toolbar">
            <HeaderActions onShowOnboarding={() => setShowOnboarding(true)} theme={theme} onToggleTheme={toggleTheme} />
          </div>
          {state.error ? <div className="inline-error">{state.error}</div> : null}
          <GroupDetail group={state.group} busy={busy} onBack={backToList} onToggle={toggleSubscription} />
        </>
      ) : (
        <>
          {state.intro ? <ServiceIntro onShowOnboarding={() => setShowOnboarding(true)} theme={theme} onToggleTheme={toggleTheme} installBusy={installBusy} installNotice={installNotice} cabinetBusy={cabinetBusy} onAddToCommunity={addToCommunity} onOpenService={openService} /> : null}
          <header className="list-header">
            <h1>{COPY.groupsTitle}</h1>
            <div className="view-actions">{canManageCommunity ? <button className="help-button" type="button" onClick={openAdmin}>Настроить</button> : null}{!state.intro ? <HeaderActions onShowOnboarding={() => setShowOnboarding(true)} theme={theme} onToggleTheme={toggleTheme} /> : null}</div>
          </header>
          {state.error && !state.intro ? <div className="inline-error">{state.error}</div> : null}
          {state.groups.length ? (
            <GroupList groups={state.groups} onOpen={openGroup} />
          ) : (
            <EmptyGroups onShowOnboarding={() => setShowOnboarding(true)} />
          )}
        </>
      )}
      <LegalFooter />
    </main>
  );
}
