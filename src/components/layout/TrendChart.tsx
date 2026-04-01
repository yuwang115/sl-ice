import type { PhysicsHistoryPoint } from '../../store/physics-store';

const SVG_WIDTH = 360;
const SVG_HEIGHT = 100;
const PADDING = {
  top: 8,
  right: 12,
  bottom: 20,
  left: 44,
};
const MAX_DISPLAY_POINTS = 180;

type TrendMetricKey = 'glFluxKm3Yr' | 'massChangeGt';
type TrendFormat = 'flux' | 'mass';

interface TrendChartProps {
  id: string;
  title: string;
  unit: string;
  accent: string;
  history: PhysicsHistoryPoint[];
  valueKey: TrendMetricKey;
  format: TrendFormat;
  includeZeroBaseline?: boolean;
  className?: string;
}

function downsampleHistory(history: PhysicsHistoryPoint[], maxPoints: number): PhysicsHistoryPoint[] {
  if (history.length <= maxPoints) return history;

  const sampled: PhysicsHistoryPoint[] = [];
  const stride = (history.length - 1) / (maxPoints - 1);

  for (let i = 0; i < maxPoints; i++) {
    const index = i === maxPoints - 1
      ? history.length - 1
      : Math.round(i * stride);
    sampled.push(history[index]);
  }

  return sampled;
}

function formatYearLabel(year: number): string {
  if (Math.abs(year) >= 100) return year.toFixed(0);
  if (Math.abs(year) >= 10) return year.toFixed(1);
  return year.toFixed(1);
}

function formatTrendValue(value: number, format: TrendFormat): string {
  const sign = format === 'mass' && value > 0 ? '+' : '';
  const absValue = Math.abs(value);

  if (absValue >= 1000) return `${sign}${value.toFixed(0)}`;
  if (absValue >= 100) return `${sign}${value.toFixed(1)}`;
  if (absValue >= 10) return `${sign}${value.toFixed(2)}`;
  return `${sign}${value.toFixed(3)}`;
}

function resolveDomain(values: number[], includeZeroBaseline: boolean): { min: number; max: number } {
  let min = values.length > 0 ? Math.min(...values) : 0;
  let max = values.length > 0 ? Math.max(...values) : 1;

  if (includeZeroBaseline) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.1, 1);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
  }

  if (includeZeroBaseline) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }

  return { min, max };
}

export default function TrendChart({
  id,
  title,
  unit,
  accent,
  history,
  valueKey,
  format,
  includeZeroBaseline = false,
  className = '',
}: TrendChartProps) {
  const sampledHistory = downsampleHistory(history, MAX_DISPLAY_POINTS);
  const latestPoint = history[history.length - 1];
  const latestValue = latestPoint ? latestPoint[valueKey] : 0;
  const values = sampledHistory.map((point) => point[valueKey]);
  const { min, max } = resolveDomain(values, includeZeroBaseline);

  const plotLeft = PADDING.left;
  const plotRight = SVG_WIDTH - PADDING.right;
  const plotTop = PADDING.top;
  const plotBottom = SVG_HEIGHT - PADDING.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const startYear = sampledHistory[0]?.year ?? 0;
  const endYear = sampledHistory[sampledHistory.length - 1]?.year ?? 0;
  const yearSpan = Math.max(endYear - startYear, 1);
  const valueSpan = Math.max(max - min, 1e-6);

  const plottedPoints = sampledHistory.map((point) => {
    const x = sampledHistory.length === 1
      ? plotLeft + plotWidth * 0.5
      : plotLeft + ((point.year - startYear) / yearSpan) * plotWidth;
    const y = plotBottom - ((point[valueKey] - min) / valueSpan) * plotHeight;
    return { x, y };
  });

  const linePoints = plottedPoints
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');

  const areaPath = plottedPoints.length > 0
    ? [
      `M ${plottedPoints[0].x.toFixed(1)} ${plotBottom.toFixed(1)}`,
      ...plottedPoints.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`),
      `L ${plottedPoints[plottedPoints.length - 1].x.toFixed(1)} ${plotBottom.toFixed(1)}`,
      'Z',
    ].join(' ')
    : '';

  const baselineY = includeZeroBaseline
    ? plotBottom - ((0 - min) / valueSpan) * plotHeight
    : null;

  return (
    <section
      className={`rounded-[var(--radius-md)] border px-3 py-2 flex h-full min-h-0 flex-col ${className}`}
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h3
            className="font-data text-[10px] uppercase tracking-[0.24em]"
            style={{ color: 'var(--text-muted)' }}
          >
            {title}
          </h3>
        </div>
        <div className="text-right">
          <div
            className="font-data text-sm font-semibold"
            style={{ color: accent }}
          >
            {formatTrendValue(latestValue, format)}
            <span
              className="ml-1 text-[10px] font-normal"
              style={{ color: 'var(--text-muted)' }}
            >
              {unit}
            </span>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="block w-full flex-1 min-h-[120px]"
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={`${id}-title`}
      >
        <title id={`${id}-title`}>{title}</title>

        {[0, 0.5, 1].map((offset) => {
          const y = plotTop + offset * plotHeight;
          return (
            <line
              key={offset}
              x1={plotLeft}
              y1={y}
              x2={plotRight}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.55"
            />
          );
        })}

        {baselineY != null && baselineY >= plotTop && baselineY <= plotBottom && (
          <line
            x1={plotLeft}
            y1={baselineY}
            x2={plotRight}
            y2={baselineY}
            stroke={accent}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
        )}

        {areaPath && (
          <path
            d={areaPath}
            fill={accent}
            opacity="0.12"
          />
        )}

        {linePoints && (
          <polyline
            points={linePoints}
            fill="none"
            stroke={accent}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {plottedPoints.length > 0 && (
          <circle
            cx={plottedPoints[plottedPoints.length - 1].x}
            cy={plottedPoints[plottedPoints.length - 1].y}
            r="3.4"
            fill={accent}
          />
        )}

        <text
          x={plotLeft - 6}
          y={plotTop + 4}
          textAnchor="end"
          fontSize="9"
          fill="var(--text-muted)"
        >
          {formatTrendValue(max, format)}
        </text>
        <text
          x={plotLeft - 6}
          y={plotBottom}
          textAnchor="end"
          fontSize="9"
          fill="var(--text-muted)"
        >
          {formatTrendValue(min, format)}
        </text>
        <text
          x={plotLeft}
          y={SVG_HEIGHT - 8}
          fontSize="9"
          fill="var(--text-muted)"
        >
          {formatYearLabel(startYear)} yr
        </text>
        <text
          x={plotRight}
          y={SVG_HEIGHT - 8}
          textAnchor="end"
          fontSize="9"
          fill="var(--text-muted)"
        >
          {formatYearLabel(endYear)} yr
        </text>
      </svg>
    </section>
  );
}
