/**
 * Sidebar control panel with collapsible parameter sections.
 */

import { useGameStore } from '../../store/game-store';
import { usePhysicsStore } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';
import ParameterSlider from '../controls/ParameterSlider';
import ToggleSwitch from '../controls/ToggleSwitch';
import SidebarSection from './SidebarSection';

/* ─── Inline SVG Section Icons ──────────────────────────── */
const IconThermometer = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0Z" />
  </svg>
);

const IconMountain = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 3 4 8 5-5 2 15H2L8 3z" />
  </svg>
);

const IconGear = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

/* ─── Tooltip descriptions per parameter ────────────────── */
const tooltips: Record<string, { en: string; zh: string }> = {
  T_atm_delta: {
    en: 'Global atmospheric temperature anomaly. A polar-amplification factor (~1.8×) is applied automatically, and snowfall responds via Clausius–Clapeyron scaling (~7%/K).',
    zh: '全球大气温度偏差。自动应用极地放大（~1.8×），降雪通过 Clausius–Clapeyron 关系（~7%/K）自动响应。',
  },
  T_ocean_delta: {
    en: 'Ambient ocean warming reaching the ice-shelf cavity. Drives a PICO 2-box model (Reese et al. 2018): Box 1 near the grounding line sees raw warming, Box 2 near the calving front receives cooler, freshened water after Box 1 has extracted heat — so melt peaks at the GL and decays toward the front.',
    zh: '到达冰架空腔的环境海水增暖。驱动 PICO 两盒模型（Reese 等 2018）：接地线侧 Box 1 获得原始增暖，前缘侧 Box 2 接收经 Box 1 提取热量后的冷却/淡化水——因此融化在接地线最强、向前缘递减。',
  },
  precip_scale: {
    en: 'Orographic / residual snowfall multiplier. The Clausius–Clapeyron response to ΔT is applied automatically on top of this factor, so 1.0× does NOT mean "no climate response".',
    zh: '地形 / 残差降雪乘数。对 ΔT 的 Clausius–Clapeyron 响应会在此因子之上自动叠加，因此 1.0× 并不代表「无气候响应」。',
  },
  drain_efficiency: {
    en: 'Subglacial drainage rate (1/yr). Higher → water flushes quickly → high effective pressure → slow sliding. Lower → water accumulates → low effective pressure → fast sliding. Zwally feedback (surface melt → bed) also active when hydrology is enabled.',
    zh: '冰下排水速率（1/yr）。越高 → 水排得越快 → 有效压力高 → 滑动慢；越低 → 水累积 → 有效压力低 → 滑动快。启用冰下水文时同时激活 Zwally 反馈（表面融水→基底）。',
  },
  mici_sensitivity: {
    en: 'Scaling on Schlemm & Levermann (2019) cliff-collapse rate. NOTE: MICI is contested — Bassis et al. (2021) and Edwards et al. (2019) argue the critical cliff height is higher and onset slower than this parameterization implies. Use as a "high-end storyline" knob.',
    zh: 'Schlemm & Levermann (2019) 冰崖崩解速率的标度。注意：MICI 存在学术争议——Bassis 等 (2021) 与 Edwards 等 (2019) 认为真实临界崖高更高、启动更慢。请作为「高端情景」旋钮使用。',
  },
};

export default function Sidebar() {
  const { params, setParam } = useGameStore();
  const updateParams = usePhysicsStore((s) => s.updateParams);
  const { sidebarOpen, language } = useUIStore();

  const handleChange = (key: keyof typeof params, value: number | boolean) => {
    setParam(key, value as never);
    updateParams({ [key]: value });
  };

  const isZh = language === 'zh';

  const getTooltip = (key: string) => {
    const t = tooltips[key];
    return t ? (isZh ? t.zh : t.en) : undefined;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden transition-opacity"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={() => useUIStore.getState().toggleSidebar()}
        />
      )}
      <aside
        className={`fixed right-0 top-0 bottom-0 w-64 z-50 md:static md:z-auto glass-panel border-l p-4 overflow-y-auto flex-shrink-0 transition-transform duration-300 ease-out md:!translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="complementary"
        aria-label="Parameter controls"
      >
        {/* ─── Climate Section ─────────────────────────── */}
        <SidebarSection
          title={isZh ? '气候参数' : 'Climate'}
          icon={<IconThermometer />}
          defaultOpen
        >
          <ParameterSlider
            label={isZh ? '大气温度 ΔT' : 'Atmosphere ΔT'}
            value={params.T_atm_delta}
            min={-5}
            max={10}
            step={0.1}
            unit="°C"
            defaultValue={0}
            onChange={(v) => handleChange('T_atm_delta', v)}
            formatValue={(v) => (v >= 0 ? '+' : '') + v.toFixed(1)}
            color={params.T_atm_delta > 0 ? 'var(--accent-warm)' : 'var(--accent-light)'}
            tooltip={getTooltip('T_atm_delta')}
          />

          <ParameterSlider
            label={isZh ? '海洋温度 ΔT' : 'Ocean ΔT'}
            value={params.T_ocean_delta}
            min={-2}
            max={5}
            step={0.1}
            unit="°C"
            defaultValue={0}
            onChange={(v) => handleChange('T_ocean_delta', v)}
            formatValue={(v) => (v >= 0 ? '+' : '') + v.toFixed(1)}
            color={params.T_ocean_delta > 0 ? 'var(--accent-danger)' : 'var(--accent-light)'}
            tooltip={getTooltip('T_ocean_delta')}
          />

          <ParameterSlider
            label={isZh ? '降雪倍率' : 'Snowfall'}
            value={params.precip_scale}
            min={0.5}
            max={2.0}
            step={0.05}
            unit="x"
            defaultValue={1.0}
            onChange={(v) => handleChange('precip_scale', v)}
            color="var(--text-secondary)"
            tooltip={getTooltip('precip_scale')}
          />
        </SidebarSection>

        {/* ─── Ice Dynamics Section ────────────────────── */}
        <SidebarSection
          title={isZh ? '冰动力学' : 'Ice Dynamics'}
          icon={<IconMountain />}
          defaultOpen
        >
          <ParameterSlider
            label={isZh ? '排水效率' : 'Drainage'}
            value={params.drain_efficiency}
            min={0.1}
            max={5.0}
            step={0.1}
            unit="/yr"
            defaultValue={1.0}
            onChange={(v) => handleChange('drain_efficiency', v)}
            color="var(--accent-teal)"
            tooltip={getTooltip('drain_efficiency')}
          />
        </SidebarSection>

        {/* ─── Advanced Section ────────────────────────── */}
        <SidebarSection
          title={isZh ? '高级选项' : 'Advanced'}
          icon={<IconGear />}
          defaultOpen={false}
        >
          {/* Hydrology toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isZh ? '冰下水文' : 'Subglacial Hydrology'}
            </span>
            <ToggleSwitch
              checked={!!params.enable_hydrology}
              onChange={(v) => handleChange('enable_hydrology', v)}
              label={isZh ? '冰下水文' : 'Subglacial Hydrology'}
            />
          </div>

          {/* MICI toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isZh ? '冰崖不稳定性 (MICI)' : 'Ice Cliff Instability'}
            </span>
            <ToggleSwitch
              checked={!!params.enable_mici}
              onChange={(v) => handleChange('enable_mici', v)}
              label={isZh ? '冰崖不稳定性' : 'Ice Cliff Instability'}
            />
          </div>

          {params.enable_mici && (
            <ParameterSlider
              label={isZh ? 'MICI 敏感度' : 'MICI Sensitivity'}
              value={params.mici_sensitivity ?? 1.0}
              min={0.1}
              max={3.0}
              step={0.1}
              unit="x"
              defaultValue={1.0}
              onChange={(v) => handleChange('mici_sensitivity', v)}
              color="var(--accent-warm)"
              tooltip={getTooltip('mici_sensitivity')}
            />
          )}
        </SidebarSection>

        {/* ─── Geoengineering Section (conditional) ───── */}
        {params.curtain_position != null && (
          <SidebarSection
            title={isZh ? '地球工程' : 'Geoengineering'}
            icon={<IconShield />}
            defaultOpen
          >
            <ParameterSlider
              label={isZh ? '屏障位置' : 'Barrier Position'}
              value={params.curtain_position || 0}
              min={0}
              max={800}
              step={10}
              unit=" km"
              onChange={(v) => handleChange('curtain_position', v)}
              color="var(--accent-warm)"
            />
            <ParameterSlider
              label={isZh ? '屏障效率' : 'Barrier Efficiency'}
              value={params.curtain_efficiency || 0}
              min={0}
              max={1}
              step={0.05}
              unit=""
              onChange={(v) => handleChange('curtain_efficiency', v)}
              formatValue={(v) => (v * 100).toFixed(0) + '%'}
              color="var(--accent-warm)"
            />
          </SidebarSection>
        )}
      </aside>
    </>
  );
}
