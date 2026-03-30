/**
 * Bottom dashboard showing real-time simulation stats.
 */

import TrendChart from './TrendChart';
import { usePhysicsStore, type PhysicsHistoryPoint } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';

export default function Dashboard() {
  const state = usePhysicsStore((s) => s.state);
  const history = usePhysicsStore((s) => s.history);
  const language = useUIStore((s) => s.language);
  const isZh = language === 'zh';

  if (!state) return null;

  const chartHistory: PhysicsHistoryPoint[] = history.length > 0
    ? history
    : [{
      year: state.year,
      glFluxKm3Yr: state.gl_flux_km3_yr,
      massChangeGt: state.mass_change_gt,
    }];

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
    <div className="relative glass-panel border-t px-3 py-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TrendChart
          id="gl-flux-chart"
          title={isZh ? '\u63a5\u5730\u7ebf\u51b0\u901a\u91cf' : 'Grounding Line Ice Flux'}
          unit="km\u00b3/yr"
          accent="var(--accent-teal)"
          history={chartHistory}
          valueKey="glFluxKm3Yr"
          format="flux"
        />
        <TrendChart
          id="mass-change-chart"
          title={isZh ? '\u603b\u51b0\u8d28\u91cf\u53d8\u5316' : 'Total Ice Mass Change'}
          unit="Gt"
          accent="var(--accent-warm)"
          history={chartHistory}
          valueKey="massChangeGt"
          format="mass"
          includeZeroBaseline
        />
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1 text-center min-h-[44px]">
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
      </div>

      {state.is_misi_active && (
        <div
          className="absolute right-3 bottom-2 flex items-center gap-1 px-2 py-0.5 rounded-full animate-pulse"
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
