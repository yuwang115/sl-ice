/**
 * Ice-flow cross-section silhouette rendered from real terrain data.
 * Samples surface, ice-bottom, and bed elevations along the flowline path
 * and renders a 3-layer SVG matching the 3D-ICE reference style.
 */

import { useMemo } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import { sampleFlowlineProfile, type ProfileSample } from '../../lib/terrain/profile-sampler';
import type { FlowlineCatalogEntry } from './FlowlineListPanel';

interface IceProfileSilhouetteProps {
  flowline: FlowlineCatalogEntry;
  width?: number;
  height?: number;
}

// ── SVG path builders ───────────────────────────────────────────────

interface Point { x: number; y: number }

function buildSvgPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

// ── Grid params (fixed for 480 dataset) ─────────────────────────────

const GRID_PARAMS = {
  x0_m: -3_333_000,
  y0_m: 3_333_000,
  dx_m: 10_000,
  dy_m: -10_000,
  nx: 0,
  ny: 0,
} as const;

// ── Component ───────────────────────────────────────────────────────

export default function IceProfileSilhouette({
  flowline,
  width = 280,
  height = 100,
}: IceProfileSilhouetteProps) {
  const surfaceHeights = useExplorerStore((s) => s.surfaceHeights);
  const bedHeights = useExplorerStore((s) => s.bedHeights);
  const thicknessData = useExplorerStore((s) => s.thicknessData);
  const gridNx = useExplorerStore((s) => s.gridNx);
  const gridNy = useExplorerStore((s) => s.gridNy);

  const samples = useMemo<ProfileSample[] | null>(() => {
    if (!surfaceHeights || !bedHeights || !thicknessData || gridNx === 0) return null;
    const grid = { ...GRID_PARAMS, nx: gridNx, ny: gridNy };
    return sampleFlowlineProfile(
      flowline.path_lonlat,
      grid,
      surfaceHeights,
      bedHeights,
      thicknessData,
      gridNx,
      gridNy,
    );
  }, [flowline.path_lonlat, surfaceHeights, bedHeights, thicknessData, gridNx, gridNy]);

  if (!samples || samples.length < 2) return null;

  return <ProfileSvg samples={samples} width={width} height={height} />;
}

// ── Pure SVG renderer (no store dependency) ─────────────────────────

function ProfileSvg({
  samples,
  width,
  height,
}: {
  samples: ProfileSample[];
  width: number;
  height: number;
}) {
  const padLeft = 8;
  const padRight = 8;
  const padTop = 6;
  const padBottom = 6;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Compute elevation range across all three layers
  const allElevations: number[] = [];
  for (const s of samples) {
    allElevations.push(s.surface, s.bottom, s.bed);
  }
  let minElev = Math.min(...allElevations);
  let maxElev = Math.max(...allElevations);
  const padElev = Math.max(25, (maxElev - minElev) * 0.08);
  minElev -= padElev;
  maxElev += padElev;
  if (Math.abs(maxElev - minElev) < 1) {
    maxElev += 1;
    minElev -= 1;
  }

  const totalDist = Math.max(1e-6, samples[samples.length - 1].distanceKm);
  const toX = (km: number, fallbackIdx: number) =>
    padLeft + plotW * (totalDist > 0 ? Math.max(0, Math.min(1, km / totalDist)) : fallbackIdx / Math.max(1, samples.length - 1));
  const toY = (elev: number) =>
    padTop + ((maxElev - elev) / (maxElev - minElev)) * plotH;

  // Build coordinate arrays
  const surfacePts: Point[] = [];
  const bottomPts: Point[] = [];
  const bedPts: Point[] = [];

  samples.forEach((s, i) => {
    const x = toX(s.distanceKm, i);
    surfacePts.push({ x, y: toY(s.surface) });
    bottomPts.push({ x, y: toY(s.bottom) });
    bedPts.push({ x, y: toY(s.bed) });
  });

  // Ice body fill: surface → bottom (reversed)
  const iceFillPath = `${buildSvgPath(surfacePts)} ${buildSvgPath([...bottomPts].reverse()).replace(/^M /, 'L ')} Z`;

  // Bed rock fill: bed → chart bottom
  const chartBottom = padTop + plotH;
  const bedFillPath = `${buildSvgPath(bedPts)} L ${bedPts[bedPts.length - 1].x.toFixed(1)} ${chartBottom.toFixed(1)} L ${bedPts[0].x.toFixed(1)} ${chartBottom.toFixed(1)} Z`;

  // Stroke paths
  const surfacePath = buildSvgPath(surfacePts);
  const bottomPath = buildSvgPath(bottomPts);
  const bedPath = buildSvgPath(bedPts);

  const gradientId = `ice-profile-grad`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', borderRadius: 8 }}
    >
      <defs>
        {/* Ice body gradient matching 3D-ICE: light blue top → deeper blue bottom */}
        <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#e0f6ff" stopOpacity={0.92} />
          <stop offset="60%" stopColor="#aadbf2" stopOpacity={0.85} />
          <stop offset="100%" stopColor="#76abca" stopOpacity={0.88} />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect x="0" y="0" width={width} height={height} rx="8" fill="rgba(223, 241, 249, 0.55)" />

      {/* Bed rock fill (brown) */}
      <path d={bedFillPath} fill="rgba(143, 101, 58, 0.36)" />

      {/* Ice body fill (blue gradient) */}
      <path d={iceFillPath} fill={`url(#${gradientId})`} />

      {/* Bed stroke (brown) */}
      <path
        d={bedPath}
        fill="none"
        stroke="rgba(120, 78, 36, 0.92)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ice bottom stroke (dark blue-grey) */}
      <path
        d={bottomPath}
        fill="none"
        stroke="rgba(44, 79, 107, 0.58)"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ice surface stroke (white) */}
      <path
        d={surfacePath}
        fill="none"
        stroke="rgba(248, 253, 255, 0.96)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
