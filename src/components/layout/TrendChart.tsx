import type { PhysicsHistoryPoint } from '../../store/physics-store';

const SVG_WIDTH = 300;
const SVG_HEIGHT = 80;
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

  const startYear = sampledHistory[0]?.year ?? 0;
  const endYear = sampledHistory[sampledHistory.length - 1]?.year ?? 0;
  const yearSpan = Math.max(endYear - startYear, 1);
  const valueSpan = Math.max(max - min, 1e-6);

  const plottedPoints = sampledHistory.map((point) => {
    const x = sampledHistory.length === 1
      ? SVG_WIDTH * 0.5
      : ((point.year - startYear) / yearSpan) * SVG_WIDTH;
    const y = SVG_HEIGHT - ((point[valueKey] - min) / valueSpan) * SVG_HEIGHT;
    return { x, y };
  });

  const linePoints = plottedPoints
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');

  const areaPath = plottedPoints.length > 0
    ? [
      `M ${plottedPoints[0].x.toFixed(1)} ${SVG_HEIGHT}`,
      ...plottedPoints.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`),
      `L ${plottedPoints[plottedPoints.length - 1].x.toFixed(1)} ${SVG_HEIGHT}`,
      'Z',
    ].join(' ')
    : '';

  const baselineY = includeZeroBaseline
    ? SVG_HEIGHT - ((0 - min) / valueSpan) * SVG_HEIGHT
    : null;

  return (
    <section
      className={`rounded-[var(--radius-md)] border p-3 flex h-full min-h-0 flex-col ${className}`}
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      {/* ─── Header: title + latest value ─── */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3
          className="font-data text-[10px] uppercase tracking-[0.24em] leading-tight"
          style={{ color: 'var(--text-muted)' }}
        >
          {title}
        </h3>
        <div
          className="font-data text-sm font-semibold leading-tight shrink-0"
          style={{ color: accent }}
        >
          {formatTrendValue(latestValue, format)}
          <span
            className="ml-0.5 text-[10px] font-normal"
            style={{ color: 'var(--text-muted)' }}
          >
            {unit}
          </span>
        </div>
      </div>

      {/* ─── Chart area: Y-labels | SVG | empty ─── */}
      <div
        className="flex-1 min-h-0"
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gridTemplateRows: '1fr auto',
          gap: '0',
        }}
      >
        {/* Y-axis labels */}
        <div
          className="flex flex-col justify-between items-end pr-1.5 py-0.5"
          style={{ minWidth: '2rem' }}
        >
          <span
            className="font-data text-[9px] leading-none"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatTrendValue(max, format)}
          </span>
          <span
            className="font-data text-[9px] leading-none"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatTrendValue(min, format)}
          </span>
        </div>

        {/* SVG chart — only lines and fills, no text */}
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full min-h-[60px]"
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={`${id}-title`}
        >
          <title id={`${id}-title`}>{title}</title>

          {[0, 0.5, 1].map((offset) => {
            const y = offset * SVG_HEIGHT;
            return (
              <line
                key={offset}
                x1={0}
                y1={y}
                x2={SVG_WIDTH}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                opacity="0.55"
              />
            );
          })}

          {baselineY != null && baselineY >= 0 && baselineY <= SVG_HEIGHT && (
            <line
              x1={0}
              y1={baselineY}
              x2={SVG_WIDTH}
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
        </svg>

        {/* Spacer under Y-axis labels column */}
        <div />

        {/* X-axis labels */}
        <div className="flex justify-between pt-1">
          <span
            className="font-data text-[9px] leading-none"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatYearLabel(startYear)} yr
          </span>
          <span
            className="font-data text-[9px] leading-none"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatYearLabel(endYear)} yr
          </span>
        </div>
      </div>
    </section>
  );
}
