/**
 * Floating trend dashboard shown over the simulation viewport.
 */

import { useEffect, useRef, useState } from 'react';
import TrendChart from './TrendChart';
import MiniSparkline from '../ui/MiniSparkline';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import {
  applyDashboardMove,
  applyDashboardResize,
  clampDashboardRect,
  createDefaultDashboardRect,
  type DashboardResizeHandle,
  type FloatingDashboardRect,
} from './dashboard-window';
import { usePhysicsStore, type PhysicsHistoryPoint } from '../../store/physics-store';
import { useUIStore } from '../../store/ui-store';

interface PointerInteraction {
  kind: 'move' | 'resize';
  startX: number;
  startY: number;
  rect: FloatingDashboardRect;
  handle?: DashboardResizeHandle;
}

const RESIZE_HANDLES: Array<{
  handle: DashboardResizeHandle;
  className: string;
  cursor: string;
}> = [
  { handle: 'n', className: 'left-6 right-6 top-0 h-3 -translate-y-1/2', cursor: 'ns-resize' },
  { handle: 's', className: 'bottom-0 left-6 right-6 h-3 translate-y-1/2', cursor: 'ns-resize' },
  { handle: 'e', className: 'bottom-6 right-0 top-6 w-3 translate-x-1/2', cursor: 'ew-resize' },
  { handle: 'w', className: 'bottom-6 left-0 top-6 w-3 -translate-x-1/2', cursor: 'ew-resize' },
  { handle: 'ne', className: 'right-0 top-0 h-4 w-4 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
  { handle: 'nw', className: 'left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
  { handle: 'se', className: 'bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
  { handle: 'sw', className: 'bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
];

/** Animated stat value display */
function AnimatedStat({
  label,
  value,
  unit,
  color,
  sparkData,
  sparkColor,
}: {
  label: string;
  value: number;
  unit: string;
  color?: string;
  sparkData?: number[];
  sparkColor?: string;
}) {
  const animated = useAnimatedNumber(value);
  const isInteger = unit === '' || unit === ' km' || unit === ' m/yr';
  const displayValue = isInteger
    ? Math.round(animated).toString()
    : animated > 0 && unit === ' m'
      ? `+${animated.toFixed(2)}`
      : animated.toFixed(1);

  return (
    <div
      className="rounded-md px-2 py-1.5 flex flex-col items-center min-w-0"
      style={{ background: 'var(--bg-card)' }}
    >
      <div
        className="font-data text-[10px] uppercase tracking-wider leading-tight"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div className="flex items-center gap-0.5">
        <span
          className="font-data text-xs font-medium leading-tight"
          style={{ color: color || 'var(--text-primary)' }}
        >
          {displayValue}
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{unit}</span>
        </span>
        {sparkData && sparkData.length > 2 && (
          <MiniSparkline data={sparkData} color={sparkColor || color || 'var(--accent)'} />
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const state = usePhysicsStore((s) => s.state);
  const history = usePhysicsStore((s) => s.history);
  const language = useUIStore((s) => s.language);
  const canvasWidth = useUIStore((s) => s.canvasWidth);
  const canvasHeight = useUIStore((s) => s.canvasHeight);
  const isZh = language === 'zh';

  const [windowRect, setWindowRect] = useState<FloatingDashboardRect>(() =>
    createDefaultDashboardRect(canvasWidth, canvasHeight),
  );
  const [minimized, setMinimized] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const interactionRef = useRef<PointerInteraction | null>(null);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    if (canvasWidth <= 0 || canvasHeight <= 0) return;

    setWindowRect((current) =>
      hasInteractedRef.current
        ? clampDashboardRect(current, canvasWidth, canvasHeight)
        : createDefaultDashboardRect(canvasWidth, canvasHeight),
    );
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = interactionRef.current;
      if (!active) return;

      event.preventDefault();

      const deltaX = event.clientX - active.startX;
      const deltaY = event.clientY - active.startY;

      if (active.kind === 'move') {
        setWindowRect(applyDashboardMove(active.rect, deltaX, deltaY, canvasWidth, canvasHeight));
        return;
      }

      setWindowRect(
        applyDashboardResize(
          active.rect,
          active.handle!,
          deltaX,
          deltaY,
          canvasWidth,
          canvasHeight,
        ),
      );
    };

    const finishInteraction = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishInteraction);
    window.addEventListener('pointercancel', finishInteraction);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishInteraction);
      window.removeEventListener('pointercancel', finishInteraction);
    };
  }, [canvasWidth, canvasHeight]);

  if (!state) return null;

  const chartHistory: PhysicsHistoryPoint[] = history.length > 0
    ? history
    : [{
      year: state.year,
      glFluxKm3Yr: state.gl_flux_km3_yr,
      massChangeGt: state.mass_change_gt,
    }];

  // Extract last 30 points for sparklines
  const recentHistory = history.slice(-30);
  const volumeSpark = recentHistory.map((h) =>
    'volume' in h ? (h as { volume: number }).volume : 0,
  );
  const glPosSpark = recentHistory.map((h) =>
    'glPosition' in h ? (h as { glPosition: number }).glPosition : 0,
  );

  const stats: Array<{
    label: string;
    value: number;
    unit: string;
    color?: string;
    sparkData?: number[];
    sparkColor?: string;
  }> = [
    { label: isZh ? '年份' : 'Year', value: state.year, unit: '' },
    { label: isZh ? '冰量' : 'Volume', value: state.volume, unit: ' km\u00b3' },
    {
      label: isZh ? '海平面' : 'Sea Level',
      value: state.sea_level,
      unit: ' m',
      color: state.sea_level > 0.5 ? 'var(--accent-danger)' : state.sea_level > 0 ? 'var(--accent-warm)' : 'var(--accent-light)',
    },
    {
      label: isZh ? '接地线' : 'GL Position',
      value: state.gl_position,
      unit: ' km',
      sparkData: glPosSpark.length > 2 ? glPosSpark : undefined,
      sparkColor: 'var(--accent-teal)',
    },
    { label: isZh ? 'GL速度' : 'GL Velocity', value: state.gl_velocity, unit: ' m/yr' },
  ];

  const windowTitle = isZh ? '趋势图' : 'Trend charts';
  const windowHint = isZh
    ? '拖动标题栏移动窗口，拖动边缘调整大小'
    : 'Drag the header to move. Drag the edges to resize.';

  const handleMoveStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-dashboard-action="ignore-move"]')) return;

    hasInteractedRef.current = true;
    setHasInteracted(true);
    interactionRef.current = {
      kind: 'move',
      startX: event.clientX,
      startY: event.clientY,
      rect: windowRect,
    };
  };

  const startResize = (handle: DashboardResizeHandle) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    hasInteractedRef.current = true;
    setHasInteracted(true);
    interactionRef.current = {
      kind: 'resize',
      handle,
      startX: event.clientX,
      startY: event.clientY,
      rect: windowRect,
    };
  };

  const resetWindow = () => {
    hasInteractedRef.current = false;
    setHasInteracted(false);
    setWindowRect(createDefaultDashboardRect(canvasWidth, canvasHeight));
  };

  return (
    <section
      role="dialog"
      aria-label={windowTitle}
      className="pointer-events-auto absolute z-10"
      style={{
        left: windowRect.x,
        top: windowRect.y,
        width: windowRect.width,
        height: minimized ? 'auto' : windowRect.height,
      }}
    >
      <div
        className="glass-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)]"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        {/* ─── Header bar ──────────────────────────────── */}
        <div
          className="flex cursor-move items-center justify-between gap-3 border-b px-3 py-2 select-none"
          style={{ borderColor: 'var(--border)', touchAction: 'none' }}
          onPointerDown={handleMoveStart}
        >
          <div className="min-w-0 flex items-center gap-2">
            <div
              className="font-data text-[10px] uppercase tracking-[0.24em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {windowTitle}
            </div>
            {!hasInteracted && (
              <p
                className="text-[10px] leading-tight opacity-60 animate-in"
                style={{ color: 'var(--text-muted)' }}
              >
                {windowHint}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2" data-dashboard-action="ignore-move">
            {state.is_misi_active && (
              <div
                className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background: 'var(--severity-critical-bg)',
                  border: '1px solid var(--severity-critical-border)',
                }}
              >
                <span className="font-data text-[10px] font-medium" style={{ color: 'var(--accent-danger)' }}>MISI</span>
              </div>
            )}

            {state.is_mici_active && (
              <div
                className="flex items-center gap-1 rounded-full px-2 py-0.5"
                style={{
                  background: 'var(--severity-critical-bg)',
                  border: '1px solid var(--severity-critical-border)',
                }}
              >
                <span className="font-data text-[10px] font-medium" style={{ color: 'var(--accent-warm)' }}>MICI</span>
                <span className="font-data text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {state.cliff_height.toFixed(0)}m
                </span>
              </div>
            )}

            {/* Minimize / expand toggle */}
            <button
              type="button"
              className="pill-btn px-1.5 py-1"
              onClick={() => setMinimized((prev) => !prev)}
              aria-label={minimized ? 'Expand' : 'Minimize'}
              data-dashboard-action="ignore-move"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: minimized ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms ease',
                }}
              >
                <path d="M3.5 5.25L7 8.75L10.5 5.25" />
              </svg>
            </button>

            <button
              type="button"
              className="pill-btn text-[11px]"
              onClick={resetWindow}
              aria-label={isZh ? '默认位置' : 'Default position'}
              data-dashboard-action="ignore-move"
            >
              {isZh ? '默认' : 'Default'}
            </button>
          </div>
        </div>

        {/* ─── Charts (collapsible) ────────────────────── */}
        {!minimized && (
          <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
            <div className="grid h-full min-h-0 grid-cols-2 gap-3">
              <TrendChart
                id="gl-flux-chart"
                title={isZh ? '接地线冰通量' : 'Grounding Line Ice Flux'}
                unit="km\u00b3/yr"
                accent="var(--accent-teal)"
                history={chartHistory}
                valueKey="glFluxKm3Yr"
                format="flux"
                className="min-h-0"
              />
              <TrendChart
                id="mass-change-chart"
                title={isZh ? '总冰质量变化' : 'Total Ice Mass Change'}
                unit="Gt"
                accent="var(--accent-warm)"
                history={chartHistory}
                valueKey="massChangeGt"
                format="mass"
                includeZeroBaseline
                className="min-h-0"
              />
            </div>
          </div>
        )}

        {/* ─── Stats footer ────────────────────────────── */}
        <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {stats.map((s) => (
              <AnimatedStat
                key={s.label}
                label={s.label}
                value={s.value}
                unit={s.unit}
                color={s.color}
                sparkData={s.sparkData}
                sparkColor={s.sparkColor}
              />
            ))}
          </div>
        </div>

        {/* ─── Resize handles ──────────────────────────── */}
        {!minimized && RESIZE_HANDLES.map(({ handle, className, cursor }) => (
          <button
            key={handle}
            type="button"
            className={`absolute z-20 rounded-full bg-transparent ${className}`}
            style={{ cursor, touchAction: 'none' }}
            aria-label={isZh ? `调整趋势窗口 ${handle}` : `Resize trend window ${handle}`}
            onPointerDown={startResize(handle)}
          />
        ))}
      </div>
    </section>
  );
}
