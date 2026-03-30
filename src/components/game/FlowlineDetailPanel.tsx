/**
 * Detail panel shown when a flow line is selected on the Antarctica map.
 * Displays name, stats, bed profile sparkline, key facts, and start button.
 */

import { useUIStore } from '../../store/ui-store';
import type { FlowlineCatalogEntry } from './FlowlineListPanel';

interface FlowlineDetailPanelProps {
  flowline: FlowlineCatalogEntry;
  bedProfile: number[] | null;
  onStart: () => void;
  onClose: () => void;
}

function BedSparkline({ bed }: { bed: number[] }) {
  if (bed.length < 2) return null;
  const width = 240;
  const height = 60;
  const padding = 4;
  const minBed = Math.min(...bed);
  const maxBed = Math.max(...bed);
  const range = maxBed - minBed || 1;

  const points = bed.map((v, i) => {
    const x = padding + (i / (bed.length - 1)) * (width - 2 * padding);
    const y = padding + (1 - (v - minBed) / range) * (height - 2 * padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Sea level line
  const seaY = padding + (1 - (0 - minBed) / range) * (height - 2 * padding);
  const showSeaLevel = minBed < 0 && maxBed > -50;

  return (
    <svg width={width} height={height} className="mt-2 mb-1">
      {/* Fill below bed */}
      <polygon
        points={`${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`}
        fill="var(--accent)"
        opacity={0.1}
      />
      {/* Sea level */}
      {showSeaLevel && (
        <line
          x1={padding} y1={seaY} x2={width - padding} y2={seaY}
          stroke="var(--accent)" strokeWidth={0.5} strokeDasharray="3,3" opacity={0.4}
        />
      )}
      {/* Bed profile */}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Labels */}
      <text x={padding} y={height - 1} fontSize={7} fill="var(--text-muted)">{minBed}m</text>
      <text x={width - padding} y={padding + 6} fontSize={7} fill="var(--text-muted)" textAnchor="end">{maxBed}m</text>
    </svg>
  );
}

export default function FlowlineDetailPanel({ flowline, bedProfile, onStart, onClose }: FlowlineDetailPanelProps) {
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  const regionLabel: Record<string, [string, string]> = {
    west: ['West Antarctica', '西南极'],
    east: ['East Antarctica', '东南极'],
    peninsula: ['Antarctic Peninsula', '南极半岛'],
  };

  const tags: string[] = [];
  if (flowline.has_retrograde) tags.push(isZh ? '逆坡基岩' : 'Retrograde bed');
  if (flowline.has_floating) tags.push(isZh ? '含冰架' : 'Ice shelf');
  if (flowline.enable_hydrology) tags.push(isZh ? '冰下水文' : 'Hydrology');

  return (
    <div
      className="glass-panel animate-in flex flex-col h-full overflow-y-auto"
      style={{ width: 320, padding: 20, borderRadius: 'var(--radius-lg)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isZh ? flowline.name_zh : flowline.name_en}
          </h3>
          <p className="font-data text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {isZh ? (regionLabel[flowline.region]?.[1] ?? flowline.region) : (regionLabel[flowline.region]?.[0] ?? flowline.region)}
            {' \u00b7 '}{flowline.basin}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-sm px-2 py-0.5 rounded"
          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          {'\u2715'}
        </button>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
        {isZh ? flowline.description_zh : flowline.description_en}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map(tag => (
            <span
              key={tag}
              className="font-data text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--badge-bg)', border: '1px solid var(--badge-border)', color: 'var(--badge-text)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <StatBox label={isZh ? '流线长度' : 'Length'} value={`${flowline.domain_length} km`} />
        <StatBox label={isZh ? '最大流速' : 'Max Speed'} value={`${flowline.max_speed} m/yr`} />
        <StatBox label={isZh ? '最低基岩' : 'Min Bed'} value={`${flowline.min_bed} m`} />
        <StatBox label={isZh ? '最大冰厚' : 'Max Ice'} value={`${flowline.max_thickness} m`} />
      </div>

      {/* Sea level potential */}
      <div
        className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg"
        style={{ background: 'var(--severity-warning-bg)', border: '1px solid var(--severity-warning-border)' }}
      >
        <span className="font-data text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {isZh ? '海平面潜力' : 'Sea Level Potential'}
        </span>
        <span className="font-data text-sm font-semibold ml-auto" style={{ color: 'var(--accent-warm)' }}>
          ~{flowline.sea_level_potential} m
        </span>
      </div>

      {/* Bed profile sparkline */}
      {bedProfile && (
        <div className="mb-3">
          <p className="font-data text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            {isZh ? '基岩剖面' : 'Bed Profile'}
          </p>
          <BedSparkline bed={bedProfile} />
        </div>
      )}

      {/* Key facts */}
      <div className="mb-4 flex-1">
        <p className="font-data text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {isZh ? '关键事实' : 'Key Facts'}
        </p>
        <ul className="space-y-1">
          {(isZh ? flowline.key_facts_zh : flowline.key_facts_en).map((fact, i) => (
            <li key={i} className="text-[11px] leading-relaxed flex gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{'\u2022'}</span>
              {fact}
            </li>
          ))}
        </ul>
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        {isZh ? '\u25b6 \u5f00\u59cb\u6a21\u62df' : '\u25b6 Start Simulation'}
      </button>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="font-data text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-data text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
