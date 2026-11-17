import { useEffect, useState } from 'react';
import { loadWidgetDonation } from './api.js';
import { openExternalServiceLink } from './vk.js';
export default function WidgetDonation({ communityId, widgetId, onBack, launchParams }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true; setData(null); setError('');
    loadWidgetDonation(communityId, widgetId, launchParams).then(result => {
      const url = new URL(result.donationUrl);
      if (url.origin !== 'https://www.donationalerts.com' || !/^\/r\/[A-Za-z0-9_-]{1,100}$/.test(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error('Не удалось подтвердить страницу сбора.');
      if (live) setData(result);
    }).catch(failure => { if (live) setError(failure.message || 'Сбор сейчас недоступен.'); });
    return () => { live = false; };
  }, [communityId, widgetId, retry, launchParams]);
  return <section className="widget-donation-page"><button type="button" className="back-button" onClick={onBack}>Назад</button>
    {error ? <><p className="inline-error" role="alert">{error}</p><button type="button" className="widget-secondary" onClick={() => setRetry(value => value + 1)}>Повторить загрузку</button></> : data ? <>
      <h1>{data.title}</h1><p>{data.text}</p><p>Собрано {new Intl.NumberFormat('ru-RU').format(Number(data.funded))} из {new Intl.NumberFormat('ru-RU').format(Number(data.goal))} {data.currency}</p>
      <p>Оплата откроется на странице получателя в DonationAlerts.</p>
      <button type="button" className="primary-button" disabled={busy} onClick={async () => { setBusy(true); try { await openExternalServiceLink(data.donationUrl); } finally { setBusy(false); } }}>{busy ? 'Открываем…' : 'Поддержать через DonationAlerts'}</button>
      <p><a href={data.donationUrl} target="_blank" rel="noopener noreferrer">Открыть страницу сбора</a></p>
    </> : <p role="status">Загружаем сбор…</p>}
  </section>;
}
