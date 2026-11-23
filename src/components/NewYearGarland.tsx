// Новогодняя хвойная гирлянда (как в приложениях руководителя и кладовщика).
// Показывается под объявлением на главном экране, когда руководитель включил её в «Декорирование приложения».
// Ветки рисуются иглами из псевдослучайных (но всегда одинаковых) штрихов; на них красные шары,
// золотые звёзды, снежинка, шишка и мерцающие золотые блики. Фрагмент шириной TILE_W повторяется,
// лишнее обрезается по ширине экрана.

const TILE_W = 200;
const TILE_H = 52;

const NEEDLES: string[] = (() => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const layers: string[][] = [[], [], [], []];
  for (let x = -8; x <= TILE_W + 8; x += 2.5) {
    // Ось ветки слегка волнистая; период волны = ширине фрагмента, чтобы стыки совпадали
    const cy = 26 + Math.sin((x / TILE_W) * Math.PI * 2) * 3;
    for (let k = 0; k < 5; k++) {
      const angle = rand() * Math.PI * 2;
      const len = 8 + rand() * 9;
      const x1 = x + (rand() - 0.5) * 4;
      const y1 = cy + (rand() - 0.5) * 6;
      const x2 = x1 + Math.cos(angle) * len * 1.3;
      const y2 = Math.min(TILE_H - 3, Math.max(3, y1 + Math.sin(angle) * len));
      layers[Math.floor(rand() * 4)].push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    }
  }
  return layers.map(l => l.join(''));
})();

const NEEDLE_STYLES = [
  { stroke: '#14532d', width: 1.7 },
  { stroke: '#166534', width: 1.5 },
  { stroke: '#15803d', width: 1.3 },
  { stroke: '#22c55e', width: 0.9 },
];

const starPath = (cx: number, cy: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

const glintPath = (cx: number, cy: number, s: number) =>
  `M${cx} ${cy - s}Q${cx} ${cy} ${cx + s} ${cy}Q${cx} ${cy} ${cx} ${cy + s}Q${cx} ${cy} ${cx - s} ${cy}Q${cx} ${cy} ${cx} ${cy - s}Z`;

// Золотые блики: [x, y, размер]
const GLINTS: Array<[number, number, number]> = [[36, 28, 4], [97, 24, 5], [144, 16, 4], [18, 12, 3], [162, 40, 3], [80, 41, 3.5], [192, 14, 4]];

function Tile({ index }: { index: number }) {
  return (
    <svg width={TILE_W} height={TILE_H} viewBox={`0 0 ${TILE_W} ${TILE_H}`} overflow="visible" className="shrink-0">
      {NEEDLES.map((d, i) => (
        <path key={i} d={d} stroke={NEEDLE_STYLES[i].stroke} strokeWidth={NEEDLE_STYLES[i].width} strokeLinecap="round" fill="none" />
      ))}
      {/* Шишка */}
      <g transform="rotate(-25 66 18)">
        <ellipse cx="66" cy="18" rx="5" ry="8" fill="#78350f" />
        <path d="M61.5 14q4.5 2 9 0M61 18q5 2 10 0M61.5 22q4.5 2 9 0" stroke="#b45309" strokeWidth="1" fill="none" />
      </g>
      {/* Красные шары с бликом и золотым колпачком */}
      {[[40, 34, 9], [140, 22, 8], [112, 42, 6]].map(([cx, cy, r]) => (
        <g key={cx}>
          <rect x={cx - 2} y={cy - r - 2.5} width="4" height="3" rx="0.8" fill="url(#garland-gold)" />
          <circle cx={cx} cy={cy} r={r} fill="url(#garland-ball)" />
          <ellipse cx={cx - r * 0.35} cy={cy - r * 0.4} rx={r * 0.28} ry={r * 0.18} fill="#fff" opacity="0.75" transform={`rotate(-30 ${cx - r * 0.35} ${cy - r * 0.4})`} />
        </g>
      ))}
      {/* Золотые звёзды */}
      <path d={starPath(95, 30, 8.5)} fill="url(#garland-gold)" stroke="#a16207" strokeWidth="0.6" />
      <path d={starPath(17, 40, 5.5)} fill="url(#garland-gold)" stroke="#a16207" strokeWidth="0.5" />
      {/* Снежинка */}
      <g stroke="#fff" strokeWidth="1.7" strokeLinecap="round" filter="url(#garland-shadow)">
        {[0, 60, 120].map(a => (
          <g key={a} transform={`rotate(${a} 176 25)`}>
            <path d="M176 17v16M173.5 19.5l2.5 2.5 2.5-2.5M173.5 30.5l2.5-2.5 2.5 2.5" fill="none" />
          </g>
        ))}
      </g>
      {/* Мерцающие золотые блики */}
      {GLINTS.map(([x, y, s], i) => (
        <path key={i} d={glintPath(x, y, s)} className="garland-glint" style={{ animationDelay: `${((index * 3 + i * 5) % 12) * 0.25}s` }} />
      ))}
    </svg>
  );
}

export default function NewYearGarland({ className = '' }: { className?: string }) {
  return (
    <div className={`new-year-garland ${className}`} aria-hidden="true">
      {/* Общие градиенты и тень для всех фрагментов */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <radialGradient id="garland-ball" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="35%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
          <linearGradient id="garland-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>
          <filter id="garland-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#0f172a" floodOpacity="0.5" />
          </filter>
        </defs>
      </svg>
      {Array.from({ length: 6 }, (_, i) => <Tile key={i} index={i} />)}
    </div>
  );
}
