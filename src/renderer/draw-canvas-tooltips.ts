/**
 * Interactive canvas tooltips — hover over ice sheet features to see
 * educational explanations rendered with pretext multiline text.
 */

import { toCanvasX, toCanvasY, type DrawContext } from './draw-bedrock';
import { drawTooltipPanel, clearPreparedCache } from './canvas-text';
import type { PhysicsStatePayload } from '../engine/types';

type Language = 'en' | 'zh';

// ── Tooltip definitions ──

interface TooltipDef {
  readonly id: string;
  readonly en: { title: string; body: string };
  readonly zh: { title: string; body: string };
  /** Return canvas-space anchor point, or null if not visible. */
  anchor: (dc: DrawContext, state: PhysicsStatePayload, xPositions: Float64Array) => { x: number; y: number } | null;
  /** Dynamic data rows populated from live state. */
  dataRows?: (state: PhysicsStatePayload, lang: Language) => ReadonlyArray<{ label: string; value: string }>;
  /** Hit radius in canvas pixels. */
  hitRadius: number;
}

const tooltipDefs: readonly TooltipDef[] = [
  {
    id: 'grounding-line',
    en: {
      title: 'Grounding Line',
      body: 'Where the ice sheet lifts off the bedrock and begins to float. This boundary controls how much ice discharges into the ocean.',
    },
    zh: {
      title: '接地线',
      body: '冰盖从基岩上抬起并开始漂浮的位置。该边界控制着冰向海洋的排放量。',
    },
    anchor: (dc, state, xPositions) => {
      const glPosM = state.gl_position * 1000;
      if (glPosM <= 0 || glPosM >= dc.xMax) return null;
      // Find bedrock at GL position
      const nx = xPositions.length;
      const dx = dc.xMax / (nx - 1);
      const idx = Math.min(Math.round(glPosM / dx), nx - 1);
      const bAtGl = state.b[idx];
      return {
        x: toCanvasX(glPosM, dc),
        y: toCanvasY(bAtGl, dc),
      };
    },
    dataRows: (state, lang) => [
      { label: lang === 'zh' ? '位置' : 'Position', value: `${state.gl_position.toFixed(0)} km` },
      { label: lang === 'zh' ? '流速' : 'Velocity', value: `${state.gl_velocity.toFixed(0)} m/yr` },
      { label: lang === 'zh' ? '通量' : 'Flux', value: `${state.gl_flux_km3_yr.toFixed(2)} km\u00b3/yr` },
    ],
    hitRadius: 30,
  },
  {
    id: 'ice-shelf',
    en: {
      title: 'Ice Shelf',
      body: 'Floating extension of the ice sheet. Shelves buttress inland ice — when they thin or collapse, upstream ice accelerates.',
    },
    zh: {
      title: '冰架',
      body: '冰盖的漂浮延伸部分。冰架为内陆冰提供支撑——当冰架变薄或崩塌时，上游冰流会加速。',
    },
    anchor: (dc, state, xPositions) => {
      if (!state.shelf_exists) return null;
      const glPosM = state.gl_position * 1000;
      // Find midpoint of floating section
      let shelfStart = -1;
      let shelfEnd = -1;
      for (let i = 0; i < xPositions.length; i++) {
        if (xPositions[i] > glPosM && state.H[i] > 10) {
          if (shelfStart < 0) shelfStart = i;
          shelfEnd = i;
        }
      }
      if (shelfStart < 0) return null;
      const midIdx = Math.floor((shelfStart + shelfEnd) / 2);
      return {
        x: toCanvasX(xPositions[midIdx], dc),
        y: toCanvasY(state.s[midIdx], dc) - 10,
      };
    },
    dataRows: (state, lang) => {
      // Estimate shelf thickness at midpoint
      const glPosM = state.gl_position * 1000;
      const nx = state.H.length;
      let shelfThickness = 0;
      let count = 0;
      for (let i = 0; i < nx; i++) {
        const xPos = i * (glPosM > 0 ? (glPosM * nx / (state.gl_position * (nx - 1))) : 1000);
        if (xPos > glPosM && state.H[i] > 10) {
          shelfThickness += state.H[i];
          count++;
        }
      }
      if (count > 0) shelfThickness /= count;
      return [
        { label: lang === 'zh' ? '平均厚度' : 'Avg. Thickness', value: `${shelfThickness.toFixed(0)} m` },
      ];
    },
    hitRadius: 40,
  },
  {
    id: 'calving-front',
    en: {
      title: 'Calving Front',
      body: 'Where icebergs break off. If the exposed cliff is too tall (>100m above sea level), it can collapse under its own weight — Marine Ice Cliff Instability.',
    },
    zh: {
      title: '崩解前端',
      body: '冰山断裂脱落的位置。如果暴露的冰崖过高（海平面以上>100米），它可能在自身重量下崩塌——海洋冰崖不稳定性。',
    },
    anchor: (dc, state, xPositions) => {
      // Find the last node with substantial ice
      for (let i = state.H.length - 1; i >= 0; i--) {
        if (state.H[i] >= 50) {
          return {
            x: toCanvasX(xPositions[i], dc),
            y: toCanvasY(state.s[i], dc) - 5,
          };
        }
      }
      return null;
    },
    dataRows: (state, lang) => {
      const rows: Array<{ label: string; value: string }> = [
        { label: lang === 'zh' ? '冰崖高度' : 'Cliff Height', value: `${state.cliff_height.toFixed(0)} m` },
      ];
      if (state.mici_calving_rate > 0) {
        rows.push({
          label: lang === 'zh' ? '崩解速率' : 'Calving Rate',
          value: `${state.mici_calving_rate.toFixed(0)} m/yr`,
        });
      }
      return rows;
    },
    hitRadius: 30,
  },
  {
    id: 'sea-level',
    en: {
      title: 'Sea Level Impact',
      body: 'This ice sheet\'s contribution to global sea level rise. Even small changes can flood coastal cities and reshape coastlines.',
    },
    zh: {
      title: '海平面影响',
      body: '该冰盖对全球海平面上升的贡献。即使微小的变化也可能淹没沿海城市并重塑海岸线。',
    },
    anchor: (dc) => {
      const seaY = toCanvasY(0, dc);
      return { x: 60, y: seaY };
    },
    dataRows: (state, lang) => [
      { label: lang === 'zh' ? '海平面变化' : 'Sea Level \u0394', value: `${state.sea_level >= 0 ? '+' : ''}${state.sea_level.toFixed(2)} m` },
      { label: lang === 'zh' ? '冰量变化' : 'Mass Change', value: `${state.mass_change_gt.toFixed(0)} Gt` },
    ],
    hitRadius: 30,
  },
];

// ── Hit testing ──

export interface HoverPosition {
  x: number; // canvas-space (pre-DPR)
  y: number;
}

/**
 * Find which tooltip the mouse is hovering near.
 */
function findActiveTooltip(
  dc: DrawContext,
  state: PhysicsStatePayload,
  xPositions: Float64Array,
  hover: HoverPosition | null,
): TooltipDef | null {
  if (!hover) return null;

  for (const def of tooltipDefs) {
    const anchor = def.anchor(dc, state, xPositions);
    if (!anchor) continue;
    const dx = hover.x - anchor.x;
    const dy = hover.y - anchor.y;
    if (dx * dx + dy * dy <= def.hitRadius * def.hitRadius) {
      return def;
    }
  }
  return null;
}

// ── Tooltip styling ──

const PANEL_STYLE = {
  padding: 10,
  bgColor: 'rgba(8, 18, 35, 0.92)',
  borderRadius: 6,
  borderWidth: 1.5,
  titleFont: 'bold 13px "Nunito", sans-serif',
  titleColor: '#ffffff',
  bodyFont: '11px "Nunito", sans-serif',
  bodyColor: 'rgba(200, 215, 235, 0.9)',
  lineHeight: 15,
  dataFont: '11px "IBM Plex Mono", monospace',
  dataLabelColor: 'rgba(150, 175, 200, 0.7)',
  dataValueColor: '#7dd3fc',
} as const;

const TOOLTIP_WIDTH = 240;

/**
 * Clamp a tooltip panel position to stay within canvas bounds.
 */
function clampPanel(
  anchorX: number,
  anchorY: number,
  panelW: number,
  panelH: number,
  canvasW: number,
  canvasH: number,
): { px: number; py: number } {
  // Default: position tooltip to the right and above the anchor
  let px = anchorX + 12;
  let py = anchorY - panelH - 8;

  // Clamp right edge
  if (px + panelW > canvasW - 8) {
    px = anchorX - panelW - 12;
  }
  // Clamp left edge
  if (px < 8) px = 8;
  // Clamp top
  if (py < 8) py = anchorY + 12;
  // Clamp bottom
  if (py + panelH > canvasH - 8) py = canvasH - panelH - 8;

  return { px, py };
}

// ── Small indicator dot at anchor ──

function drawAnchorDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.003);
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = pulse;
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── Main draw function ──

/**
 * Draw interactive canvas tooltips based on hover position.
 * Call this at the end of the render loop, after all other layers.
 */
export function drawCanvasTooltips(
  dc: DrawContext,
  state: PhysicsStatePayload,
  xPositions: Float64Array,
  hover: HoverPosition | null,
  language: Language,
): void {
  // Draw subtle anchor indicators for all visible tooltips
  for (const def of tooltipDefs) {
    const anchor = def.anchor(dc, state, xPositions);
    if (!anchor) continue;
    drawAnchorDot(dc.ctx, anchor.x, anchor.y, 'rgba(125, 211, 252, 0.6)');
  }

  // Find and draw the active tooltip
  const active = findActiveTooltip(dc, state, xPositions, hover);
  if (!active) return;

  const anchor = active.anchor(dc, state, xPositions);
  if (!anchor) return;

  const content = language === 'zh' ? active.zh : active.en;
  const dataRows = active.dataRows?.(state, language);
  const borderColor = active.id === 'sea-level'
    ? 'rgba(100, 180, 255, 0.5)'
    : 'rgba(125, 211, 252, 0.35)';

  // Estimate panel height for clamping (rough: title + body + data)
  const estimatedLines = Math.ceil(content.body.length / 28) + 1;
  const estimatedH = PANEL_STYLE.padding * 2 + estimatedLines * PANEL_STYLE.lineHeight + 20
    + (dataRows ? dataRows.length * 16 + 6 : 0);

  const { px, py } = clampPanel(
    anchor.x, anchor.y,
    TOOLTIP_WIDTH, estimatedH,
    dc.width, dc.height,
  );

  // Draw connecting line from anchor to panel
  dc.ctx.beginPath();
  dc.ctx.moveTo(anchor.x, anchor.y);
  dc.ctx.lineTo(px + TOOLTIP_WIDTH / 2, py + estimatedH);
  dc.ctx.strokeStyle = 'rgba(125, 211, 252, 0.2)';
  dc.ctx.lineWidth = 1;
  dc.ctx.setLineDash([3, 3]);
  dc.ctx.stroke();
  dc.ctx.setLineDash([]);

  // Draw the panel
  drawTooltipPanel(dc.ctx, {
    x: px,
    y: py,
    maxWidth: TOOLTIP_WIDTH,
    ...PANEL_STYLE,
    borderColor,
    title: content.title,
    body: content.body,
    dataRows,
  });
}

// Re-export clearPreparedCache for language-change hook
export { clearPreparedCache };
