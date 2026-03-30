/**
 * Sidebar control panel with parameter sliders.
 */

import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';
import ParameterSlider from '../controls/ParameterSlider';

export default function Sidebar() {
  const { params, setParam } = useGameStore();
  const updateParams = usePhysicsStore((s) => s.updateParams);
  const { sidebarOpen, language } = useUIStore();

  const handleChange = (key: keyof typeof params, value: number | boolean) => {
    setParam(key, value as never);
    updateParams({ [key]: value });
  };

  if (!sidebarOpen) return null;

  const isZh = language === 'zh';

  return (
    <div className="w-64 glass-panel border-l p-4 overflow-y-auto flex-shrink-0">
      <h3 className="font-data text-xs font-medium uppercase tracking-widest mb-4" style={{ color: 'var(--accent-light)' }}>
        {isZh ? '\u63a7\u5236\u9762\u677f' : 'Controls'}
      </h3>

      <ParameterSlider
        label={isZh ? '\u5927\u6c14\u6e29\u5ea6 \u0394T' : 'Atmosphere \u0394T'}
        value={params.T_atm_delta}
        min={-5}
        max={10}
        step={0.1}
        unit="°C"
        onChange={(v) => handleChange('T_atm_delta', v)}
        formatValue={(v) => (v >= 0 ? '+' : '') + v.toFixed(1)}
        color={params.T_atm_delta > 0 ? 'var(--accent-warm)' : 'var(--accent-light)'}
      />

      <ParameterSlider
        label={isZh ? '\u6d77\u6d0b\u6e29\u5ea6 \u0394T' : 'Ocean \u0394T'}
        value={params.T_ocean_delta}
        min={-2}
        max={5}
        step={0.1}
        unit="°C"
        onChange={(v) => handleChange('T_ocean_delta', v)}
        formatValue={(v) => (v >= 0 ? '+' : '') + v.toFixed(1)}
        color={params.T_ocean_delta > 0 ? 'var(--accent-danger)' : 'var(--accent-light)'}
      />

      <ParameterSlider
        label={isZh ? '\u964d\u96ea\u500d\u7387' : 'Snowfall'}
        value={params.precip_scale}
        min={0.5}
        max={2.0}
        step={0.05}
        unit="x"
        onChange={(v) => handleChange('precip_scale', v)}
        color="var(--text-secondary)"
      />

      <ParameterSlider
        label={isZh ? '\u6392\u6c34\u6548\u7387' : 'Drainage'}
        value={params.drain_efficiency}
        min={0.1}
        max={5.0}
        step={0.1}
        unit=" yr"
        onChange={(v) => handleChange('drain_efficiency', v)}
        color="var(--accent-teal)"
      />

      {/* Hydrology toggle */}
      <div className="mt-5 flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {isZh ? '\u51b0\u4e0b\u6c34\u6587' : 'Subglacial Hydrology'}
        </span>
        <button
          onClick={() => handleChange('enable_hydrology', !params.enable_hydrology)}
          className={`pill-btn text-[11px] ${params.enable_hydrology ? 'active' : ''}`}
        >
          {params.enable_hydrology ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Curtain controls (for geoengineering challenge) */}
      {params.curtain_position != null && (
        <>
          <div className="mt-5 mb-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <span className="font-data text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--accent-warm)' }}>
              {isZh ? '\u5730\u7403\u5de5\u7a0b' : 'Geoengineering'}
            </span>
          </div>
          <ParameterSlider
            label={isZh ? '\u5c4f\u969c\u4f4d\u7f6e' : 'Barrier Position'}
            value={params.curtain_position || 0}
            min={0}
            max={800}
            step={10}
            unit=" km"
            onChange={(v) => handleChange('curtain_position', v)}
            color="var(--accent-warm)"
          />
          <ParameterSlider
            label={isZh ? '\u5c4f\u969c\u6548\u7387' : 'Barrier Efficiency'}
            value={params.curtain_efficiency || 0}
            min={0}
            max={1}
            step={0.05}
            unit=""
            onChange={(v) => handleChange('curtain_efficiency', v)}
            formatValue={(v) => (v * 100).toFixed(0) + '%'}
            color="var(--accent-warm)"
          />
        </>
      )}
    </div>
  );
}
