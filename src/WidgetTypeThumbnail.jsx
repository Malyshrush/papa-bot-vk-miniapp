// Small layout examples, drawn locally so the catalogue never needs remote images.
export default function WidgetTypeThumbnail({ type }) {
  const text = (x, y, width, key) => <rect key={key} className="widget-mini-text" x={x} y={y} width={width} height="3" rx="1.5" />;
  const action = (x, y, width, key) => <g key={key}><rect className="widget-mini-action" x={x} y={y} width={width} height="12" rx="3" /><rect x={x + 6} y={y + 5} width={width - 12} height="2" rx="1" fill="white" /></g>;
  const image = (x, y, width, height, index) => <svg key={`image${index}`} data-role="image" x={x} y={y} width={width} height={height} viewBox="0 0 60 90" preserveAspectRatio="none" overflow="hidden">
    <rect width="60" height="90" rx="4" fill={['#a7d9dd', '#f4c9a9', '#bdc8ef'][index % 3]} />
    <circle cx="44" cy="20" r="8" fill="#fff5d3" />
    <path d="M0 75 24 34 60 80V90H0Z" fill={['#438e9a', '#c67d60', '#7487bb'][index % 3]} />
    <path d="M0 88 43 55 60 76V90H0Z" fill={['#226a7a', '#995e48', '#4c6195'][index % 3]} />
  </svg>;
  let content;
  if (type.startsWith('tiles_')) {
    const height = type === 'tiles_wide' ? 78 : 52;
    content = [0, 1, 2].map(i => <g key={i}>
      {image(20 + i * 74, 28, 52, height, i)}
      {text(20 + i * 74, 32 + height, 45, 'title')}
      {text(20 + i * 74, 40 + height, 52, 'descr')}
      <rect className="widget-mini-link" x={20 + i * 74} y={48 + height} width="30" height="3" rx="1.5" />
    </g>);
  } else if (type === 'covers') {
    content = <>{image(13, 28, 214, 54, 0)}<rect x="13" y="28" width="214" height="54" fill="#102a44" opacity=".3" />
      <rect x="23" y="39" width="85" height="4" rx="2" fill="white" />{action(151, 60, 64, 'cover-action')}
      {text(13, 96, 128, 'cover-title')}{text(13, 105, 190, 'cover-descr')}</>;
  } else if (type === 'reviews') {
    content = [0, 1].map(i => <g key={i}><circle cx="25" cy={42 + i * 44} r="11" className="widget-mini-avatar" />
      {text(44, 33 + i * 44, 70, 'author')}{text(44, 43 + i * 44, 170, 'review1')}{text(44, 51 + i * 44, 143, 'review2')}
      <text x="16" y={47 + i * 44} className="widget-mini-quote">“</text></g>);
  } else {
    content = [0, 1, 2].map(i => <g key={i}>
      <rect x="13" y={29 + i * 32} width="21" height="21" rx={type === 'clients' ? 11 : 4} className="widget-mini-avatar" />
      {text(43, 31 + i * 32, type === 'compact_list' ? 77 : 105, 'name')}
      {text(43, 40 + i * 32, type === 'compact_list' ? 64 : 147, 'details')}
      {type === 'clients' ? null : action(type === 'compact_list' ? 160 : 43, type === 'compact_list' ? 32 + i * 32 : 46 + i * 32, 64, 'row-action')}
    </g>);
  }
  return <svg className={`widget-type-thumbnail widget-type-thumbnail--${type}`} data-format={type} aria-hidden="true" viewBox="0 0 240 150" focusable="false">
    <rect className="widget-mini-surface" x="1" y="1" width="238" height="148" rx="9" />
    {text(13, 13, 87, 'heading')}{content}
    <path d="M13 140H227" className="widget-mini-divider" /><rect className="widget-mini-link" x="95" y="143" width="50" height="2" rx="1" />
  </svg>;
}
