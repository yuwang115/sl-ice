/**
 * Pretext-powered Canvas text utilities.
 * Provides multiline text measurement & rendering without DOM reflow.
 */

import {
  clearCache as clearPretextCaches,
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
  type LayoutLine,
} from '@chenglou/pretext';

// ── Prepared text cache ──
// prepare() is expensive (~19ms for a batch); layout() is cheap (~0.09ms).
// Cache by text+font composite key; clear on language change and whenever
// web fonts finish loading (measurements taken with a fallback font are wrong).
const preparedCache = new Map<string, PreparedTextWithSegments>();

function getPrepared(text: string, font: string): PreparedTextWithSegments {
  const key = `${font}||${text}`;
  let p = preparedCache.get(key);
  if (!p) {
    p = prepareWithSegments(text, font);
    preparedCache.set(key, p);
  }
  return p;
}

/**
 * Clear the prepared text cache and pretext's per-font glyph-width caches
 * (call on language change or after fonts load).
 */
export function clearPreparedCache(): void {
  preparedCache.clear();
  clearPretextCaches();
}

/**
 * Re-measure text once web fonts are ready (and after any later font load),
 * so layouts cached while "Nunito" / "IBM Plex Mono" were still loading are
 * not kept forever. Returns an unsubscribe function.
 */
export function invalidateTextLayoutOnFontLoad(): () => void {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  if (!fonts) return () => undefined;

  let active = true;
  const invalidate = () => {
    if (active) clearPreparedCache();
  };
  fonts.ready.then(invalidate, () => undefined);
  fonts.addEventListener('loadingdone', invalidate);
  return () => {
    active = false;
    fonts.removeEventListener('loadingdone', invalidate);
  };
}

// ── Multiline text drawing ──

export interface MultilineTextOptions {
  font: string;
  maxWidth: number;
  lineHeight: number;
  color: string;
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
}

export interface MultilineTextResult {
  height: number;
  lineCount: number;
  lines: LayoutLine[];
}

/**
 * Measure and draw multiline text on canvas using pretext.
 * Returns the total text block height and line count.
 */
export function drawMultilineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: MultilineTextOptions,
): MultilineTextResult {
  if (!text) return { height: 0, lineCount: 0, lines: [] };

  const prepared = getPrepared(text, opts.font);
  const result = layoutWithLines(prepared, opts.maxWidth, opts.lineHeight);

  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'top';

  for (let i = 0; i < result.lines.length; i++) {
    const line = result.lines[i];
    let lx = opts.x;
    if (opts.align === 'center') {
      lx = opts.x + opts.maxWidth / 2;
    } else if (opts.align === 'right') {
      lx = opts.x + opts.maxWidth;
    }
    ctx.fillText(line.text, lx, opts.y + i * opts.lineHeight);
  }

  return {
    height: result.height,
    lineCount: result.lineCount,
    lines: result.lines,
  };
}

/**
 * Measure multiline text height without drawing (for layout calculations).
 */
export function measureMultilineText(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): { height: number; lineCount: number } {
  if (!text) return { height: 0, lineCount: 0 };
  const prepared = getPrepared(text, font);
  const result = layoutWithLines(prepared, maxWidth, lineHeight);
  return { height: result.height, lineCount: result.lineCount };
}

// ── Tooltip panel drawing ──

export interface TooltipPanelOptions {
  x: number;
  y: number;
  maxWidth: number;
  padding: number;
  bgColor: string;
  borderColor: string;
  borderRadius: number;
  borderWidth?: number;
  title?: string;
  titleFont: string;
  titleColor: string;
  body: string;
  bodyFont: string;
  bodyColor: string;
  lineHeight: number;
  dataRows?: ReadonlyArray<{ label: string; value: string }>;
  dataFont?: string;
  dataLabelColor?: string;
  dataValueColor?: string;
}

export interface TooltipPanelResult {
  width: number;
  height: number;
}

/** The subset of panel options that determines its size. */
export type TooltipPanelLayoutOptions = Pick<
  TooltipPanelOptions,
  'maxWidth' | 'padding' | 'lineHeight' | 'title' | 'titleFont' | 'body' | 'bodyFont' | 'dataRows'
>;

interface TooltipPanelLayout {
  readonly contentWidth: number;
  readonly titleHeight: number;
  readonly bodyHeight: number;
  readonly dataRowHeight: number;
  readonly width: number;
  readonly height: number;
}

function layoutTooltipPanel(opts: TooltipPanelLayoutOptions): TooltipPanelLayout {
  const { padding, maxWidth, lineHeight } = opts;
  const contentWidth = maxWidth - padding * 2;
  let totalContentHeight = 0;

  // Title
  let titleHeight = 0;
  if (opts.title) {
    titleHeight = measureMultilineText(opts.title, opts.titleFont, contentWidth, lineHeight + 2).height;
    totalContentHeight += titleHeight + 4; // gap after title
  }

  // Body
  const bodyHeight = measureMultilineText(opts.body, opts.bodyFont, contentWidth, lineHeight).height;
  totalContentHeight += bodyHeight;

  // Data rows
  const dataRowHeight = lineHeight + 1;
  if (opts.dataRows && opts.dataRows.length > 0) {
    totalContentHeight += 6; // gap before data
    totalContentHeight += opts.dataRows.length * dataRowHeight;
  }

  return {
    contentWidth,
    titleHeight,
    bodyHeight,
    dataRowHeight,
    width: maxWidth,
    height: totalContentHeight + padding * 2,
  };
}

/** Size a tooltip panel exactly as drawTooltipPanel will draw it (for placement). */
export function measureTooltipPanel(opts: TooltipPanelLayoutOptions): TooltipPanelResult {
  const { width, height } = layoutTooltipPanel(opts);
  return { width, height };
}

/**
 * Draw a rounded-rect tooltip panel with title, body, and optional data rows.
 * All text is measured and laid out by pretext.
 */
export function drawTooltipPanel(
  ctx: CanvasRenderingContext2D,
  opts: TooltipPanelOptions,
): TooltipPanelResult {
  const { padding, lineHeight } = opts;
  const layout = layoutTooltipPanel(opts);
  const { contentWidth, titleHeight, dataRowHeight } = layout;
  const bodyMeasure = { height: layout.bodyHeight };
  const dataFont = opts.dataFont ?? '11px monospace';
  const panelHeight = layout.height;
  const panelWidth = layout.width;

  // ── Draw background ──
  const { x, y, borderRadius } = opts;
  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.roundRect(x, y, panelWidth, panelHeight, borderRadius);
  ctx.fillStyle = opts.bgColor;
  ctx.fill();

  // Reset shadow for border
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = opts.borderColor;
  ctx.lineWidth = opts.borderWidth ?? 1;
  ctx.stroke();

  ctx.restore();

  // ── Draw text content ──
  let curY = y + padding;

  // Title
  if (opts.title) {
    drawMultilineText(ctx, opts.title, {
      font: opts.titleFont,
      maxWidth: contentWidth,
      lineHeight: lineHeight + 2,
      color: opts.titleColor,
      x: x + padding,
      y: curY,
    });
    curY += titleHeight + 4;
  }

  // Body
  drawMultilineText(ctx, opts.body, {
    font: opts.bodyFont,
    maxWidth: contentWidth,
    lineHeight,
    color: opts.bodyColor,
    x: x + padding,
    y: curY,
  });
  curY += bodyMeasure.height;

  // Data rows
  if (opts.dataRows && opts.dataRows.length > 0) {
    curY += 6;
    const labelColor = opts.dataLabelColor ?? 'rgba(180, 200, 220, 0.7)';
    const valueColor = opts.dataValueColor ?? '#ffffff';

    for (const row of opts.dataRows) {
      ctx.font = dataFont;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      // Label
      ctx.fillStyle = labelColor;
      ctx.fillText(row.label, x + padding, curY);

      // Value (right-aligned)
      ctx.textAlign = 'right';
      ctx.fillStyle = valueColor;
      ctx.fillText(row.value, x + panelWidth - padding, curY);

      curY += dataRowHeight;
    }
  }

  return { width: panelWidth, height: panelHeight };
}
