import { useEffect, useRef, useState } from 'react';

const SIZES = { tiles_wide: [160, 240], tiles_square: [160, 160], covers: [510, 128],
  list: [50, 50], compact_list: [50, 50], reviews: [50, 50], clients: [50, 50] };

export default function WidgetImageAdjuster({ file, type, onCancel, onApply }) {
  const canvas = useRef(null);
  const source = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [angle, setAngle] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [width, height] = SIZES[type] || [50, 50];

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { source.current = image; setReady(true); };
    image.onerror = () => setError('Изображение не открылось. Выберите другой файл.');
    image.src = url;
    return () => { source.current = null; URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => {
    if (!ready || !canvas.current || !source.current) return;
    const context = canvas.current.getContext('2d');
    const image = source.current;
    const quarterTurn = angle % 180 !== 0;
    const sourceWidth = quarterTurn ? image.height : image.width;
    const sourceHeight = quarterTurn ? image.width : image.height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight) * zoom;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2 + offsetX * width / 100, height / 2 + offsetY * height / 100);
    context.rotate(angle * Math.PI / 180);
    context.scale(flipped ? -scale : scale, scale);
    context.drawImage(image, -image.width / 2, -image.height / 2);
    context.restore();
  }, [ready, width, height, zoom, offsetX, offsetY, angle, flipped]);

  const apply = () => {
    if (!ready || !canvas.current) return;
    canvas.current.toBlob(blob => {
      if (!blob) { setError('Не удалось подготовить кадр.'); return; }
      onApply(new File([blob], 'widget-image.png', { type: 'image/png' }));
    }, 'image/png');
  };

  return <div className="widget-image-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="widget-image-modal" role="dialog" aria-modal="true" aria-label="Настроить изображение">
      <h2>Настроить изображение</h2>
      <p>Подгоните кадр под формат VK {width}×{height}. Исходный файл остаётся у вас.</p>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      <div className="widget-image-canvas-wrap"><canvas ref={canvas} width={width} height={height} aria-label="Предпросмотр кадра" /></div>
      <label>Масштаб<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <label>По горизонтали<input type="range" min="-50" max="50" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))} /></label>
      <label>По вертикали<input type="range" min="-50" max="50" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))} /></label>
      <div className="widget-image-controls">
        <button type="button" className="widget-secondary" onClick={() => setAngle(value => (value + 90) % 360)}>Повернуть</button>
        <button type="button" className="widget-secondary" onClick={() => setFlipped(value => !value)}>Отразить</button>
      </div>
      <div className="widget-image-controls">
        <button type="button" className="widget-secondary" onClick={onCancel}>Отменить</button>
        <button type="button" className="primary-button" disabled={!ready} onClick={apply}>Загрузить в VK</button>
      </div>
    </section>
  </div>;
}
