/**
 * Bottom dashboard showing real-time simulation stats.
 */

import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';

export default function Dashboard() {
  const state = usePhysicsStore((s) => s.state);
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  if (!state) return null;

  const stats = [
    {
      label: isZh ? '\u5e74\u4efd' : 'Year',
      value: Math.round(state.year).toString(),
      unit: '',
    },
    {
      label: isZh ? '\u51b0\u91cf' : 'Volume',
      value: state.volume.toFixed(1),
      unit: ' km³',
    },
    {
      label: isZh ? '\u6d77\u5e73\u9762' : 'Sea Level',
      value: state.sea_level > 0 ? `+${state.sea_level.toFixed(2)}` : '0.00',
      unit: ' m',
      color: state.sea_level > 0.5 ? 'var(--accent-danger)' : state.sea_level > 0 ? 'var(--accent-warm)' : 'var(--accent-light)',
    },
    {
      label: isZh ? '\u63a5\u5730\u7ebf' : 'GL Position',
      value: state.gl_position.toFixed(0),
      unit: ' km',
    },
    {
      label: isZh ? 'GL\u901f\u5ea6' : 'GL Velocity',
      value: state.gl_velocity.toFixed(0),
      unit: ' m/yr',
    },
  ];

  return (
    <div className="relative glass-panel border-t px-3 py-1.5 grid grid-cols-5 gap-1 text-center min-h-[40px]">
      {stats.map(({ label, value, unit, color }, i) => (
        <div
          key={label}
          className={i < stats.length - 1 ? 'border-r' : ''}
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="font-data text-[9px] uppercase tracking-wider leading-tight" style={{ color: 'var(--text-muted)' }}>
            {label}
          </div>
          <div
            className="font-data text-xs font-medium leading-tight"
            style={{ color: color || 'var(--text-primary)' }}
          >
            {value}
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{unit}</span>
          </div>
        </div>
      ))}

      {/* MISI indicator */}
      {state.is_misi_active && (
        <div
          className="absolute right-2 bottom-1 flex items-center gap-1 px-2 py-0.5 rounded-full animate-pulse"
          style={{
            background: 'var(--severity-critical-bg)',
            border: '1px solid var(--severity-critical-border)',
          }}
        >
          <span className="font-data text-[10px] font-medium" style={{ color: 'var(--accent-danger)' }}>MISI</span>
        </div>
      )}
    </div>
  );
}
