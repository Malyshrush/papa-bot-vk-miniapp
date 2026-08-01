import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadGroup, loadGroups, subscribeGroup, unsubscribeGroup } from './api.js';
import { allowMessagesFromGroup, initVkBridge, parseLaunchParams, parseRouteHash, setGroupHash } from './vk.js';

const DEFAULT_COMMUNITY_ID = import.meta.env.VITE_DEFAULT_COMMUNITY_ID || '';
const ONBOARDING_VERSION = '2026-07-28-v1';
const ONBOARDING_STORAGE_KEY = 'papa-bot-miniapp-onboarding';

const EMPTY_STATE = {
  loading: true,
  error: '',
  communityId: '',
  slug: '',
  groups: [],
  group: null,
  intro: false
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
  groupsTitle: '\u0413\u0440\u0443\u043f\u043f\u044b \u0441\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0430',
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

function ServiceIntro({ onShowOnboarding }) {
  return (
    <section className="intro" aria-labelledby="service-title">
      <div className="intro-hero">
        <div className="intro-heading">
          <span className="intro-badge">VK Mini App</span>
          <button className="help-button" type="button" onClick={onShowOnboarding}>Как это работает</button>
        </div>
        <h1 id="service-title">{COPY.appTitle}</h1>
        <p>{COPY.appLead}</p>
      </div>
    </section>
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
  return (
    <article className="detail">
      <button className="back-button" type="button" onClick={onBack}>{COPY.back}</button>
      <GroupImage src={group.bannerUrl} alt={group.title} type="banner" />
      <div className="detail-copy">
        <h1>{group.title}</h1>
        {group.description ? <p>{group.description}</p> : null}
      </div>
      <button className="primary-button" type="button" disabled={busy} onClick={onToggle}>
        {busy ? COPY.saving : buttonText}
      </button>
    </article>
  );
}

export default function App() {
  const launchParams = useMemo(() => parseLaunchParams(), []);
  const [state, setState] = useState(EMPTY_STATE);
  const [busy, setBusy] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasCompletedOnboarding());

  const loadCurrentRoute = useCallback(async () => {
    const route = parseRouteHash();
    const communityId = route.communityId || launchParams.vk_group_id || DEFAULT_COMMUNITY_ID;
    const intro = !route.communityId && !launchParams.vk_group_id;
    if (!communityId) {
      setState({ ...EMPTY_STATE, loading: false, error: COPY.openByCommunity });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: '', communityId, slug: route.slug, intro }));
    try {
      if (route.slug) {
        const data = await loadGroup(communityId, route.slug, launchParams);
        setState({ loading: false, error: '', communityId, slug: route.slug, groups: [], group: data.group, intro: false });
      } else {
        const data = await loadGroups(communityId, launchParams);
        setState({ loading: false, error: '', communityId, slug: '', groups: data.groups || [], group: null, intro });
      }
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error.message || COPY.loadFailed, intro }));
    }
  }, [launchParams]);

  useEffect(() => {
    initVkBridge();
    loadCurrentRoute();
    window.addEventListener('hashchange', loadCurrentRoute);
    return () => window.removeEventListener('hashchange', loadCurrentRoute);
  }, [loadCurrentRoute]);

  const openGroup = (slug) => setGroupHash(state.communityId, slug);
  const backToList = () => setGroupHash(state.communityId);
  const completeOnboarding = () => {
    rememberCompletedOnboarding();
    setShowOnboarding(false);
  };

  const toggleSubscription = async () => {
    if (!state.group || !state.communityId) return;
    setBusy(true);
    try {
      if (!launchParams.sign || !launchParams.vk_user_id) {
        throw new Error(COPY.openInVkForSubscribe);
      }
      if (!state.group.subscribed) {
        await allowMessagesFromGroup(state.communityId);
        const data = await subscribeGroup(state.communityId, state.group.slug, launchParams);
        setState((prev) => ({ ...prev, group: data.group || { ...prev.group, subscribed: true } }));
      } else {
        const data = await unsubscribeGroup(state.communityId, state.group.slug, launchParams);
        setState((prev) => ({ ...prev, group: data.group || { ...prev.group, subscribed: false } }));
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

  if (showOnboarding) {
    return <Onboarding onComplete={completeOnboarding} />;
  }

  if (state.loading) {
    return <StatusView title={COPY.loading} text={COPY.loadingGroups} />;
  }

  if (state.error && !state.group && state.groups.length === 0) {
    if (state.intro) {
      return (
        <main className="app-shell">
          <ServiceIntro onShowOnboarding={() => setShowOnboarding(true)} />
          <div className="inline-error">{state.error}</div>
          <LegalFooter />
        </main>
      );
    }
    return <StatusView title="Mini App" text={state.error} />;
  }

  return (
    <main className="app-shell">
      {state.group ? (
        <>
          <div className="detail-toolbar">
            <button className="help-button" type="button" onClick={() => setShowOnboarding(true)}>Как это работает</button>
          </div>
          {state.error ? <div className="inline-error">{state.error}</div> : null}
          <GroupDetail group={state.group} busy={busy} onBack={backToList} onToggle={toggleSubscription} />
        </>
      ) : (
        <>
          {state.intro ? <ServiceIntro onShowOnboarding={() => setShowOnboarding(true)} /> : null}
          <header className="list-header">
            <h1>{COPY.groupsTitle}</h1>
            {!state.intro ? <button className="help-button" type="button" onClick={() => setShowOnboarding(true)}>Как это работает</button> : null}
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
