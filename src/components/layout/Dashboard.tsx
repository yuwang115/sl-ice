/**
 * Floating trend dashboard shown over the simulation viewport.
 */

import { useEffect, useRef, useState } from 'react';
import TrendChart from './TrendChart';
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

  const windowTitle = isZh ? '\u8d8b\u52bf\u56fe' : 'Trend charts';
  const windowHint = isZh
    ? '\u62d6\u52a8\u6807\u9898\u680f\u79fb\u52a8\u7a97\u53e3\uff0c\u62d6\u52a8\u8fb9\u7f18\u8c03\u6574\u5927\u5c0f'
    : 'Drag the header to move. Drag the edges to resize.';

  const handleMoveStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('[data-dashboard-action="ignore-move"]')) return;

    hasInteractedRef.current = true;
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
        height: windowRect.height,
      }}
    >
      <div
        className="glass-panel relative flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)]"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <div
          className="flex cursor-move items-start justify-between gap-3 border-b px-3 py-2 select-none"
          style={{ borderColor: 'var(--border)', touchAction: 'none' }}
          onPointerDown={handleMoveStart}
        >
          <div className="min-w-0">
            <div
              className="font-data text-[10px] uppercase tracking-[0.24em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {windowTitle}
            </div>
            <p className="mt-1 text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
              {windowHint}
            </p>
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

            <button
              type="button"
              className="pill-btn text-[11px]"
              onClick={resetWindow}
              aria-label={isZh ? '\u91cd\u7f6e\u8d8b\u52bf\u7a97\u53e3' : 'Reset trend window'}
              data-dashboard-action="ignore-move"
            >
              {isZh ? '\u91cd\u7f6e' : 'Reset'}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
          <div className="grid h-full min-h-0 grid-cols-2 gap-3">
            <TrendChart
              id="gl-flux-chart"
              title={isZh ? '\u63a5\u5730\u7ebf\u51b0\u901a\u91cf' : 'Grounding Line Ice Flux'}
              unit="km\u00b3/yr"
              accent="var(--accent-teal)"
              history={chartHistory}
              valueKey="glFluxKm3Yr"
              format="flux"
              className="min-h-0"
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
              className="min-h-0"
            />
          </div>
        </div>

        <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-5 gap-1 text-center">
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
        </div>

        {RESIZE_HANDLES.map(({ handle, className, cursor }) => (
          <button
            key={handle}
            type="button"
            className={`absolute z-20 rounded-full bg-transparent ${className}`}
            style={{ cursor, touchAction: 'none' }}
            aria-label={isZh ? `\u8c03\u6574\u8d8b\u52bf\u7a97\u53e3 ${handle}` : `Resize trend window ${handle}`}
            onPointerDown={startResize(handle)}
          />
        ))}
      </div>
    </section>
  );
}
