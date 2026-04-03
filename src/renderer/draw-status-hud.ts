/**
 * Always-visible HUD panel in the top-right corner.
 * Uses pretext for proper multiline text measurement & layout.
 */

import { drawTooltipPanel } from './canvas-text';
import type { DrawContext } from './draw-bedrock';
import type { PhysicsStatePayload } from '../engine/types';

type Language = 'en' | 'zh';

/**
 * Draw a compact status HUD showing live simulation metrics.
 */
export function drawStatusHUD(
  dc: DrawContext,
  state: PhysicsStatePayload,
  language: Language,
): void {
  const { ctx, width } = dc;

  const panelWidth = 170;
  const padding = 8;
  const x = width - panelWidth - 10;
  const y = 10;

  const yearLabel = language === 'zh' ? '年份' : 'Year';
  const volumeLabel = language === 'zh' ? '冰量' : 'Volume';
  const slrLabel = language === 'zh' ? '海平面' : 'Sea Level';
  const glLabel = language === 'zh' ? '接地线' : 'GL Pos.';

  // Format values
  const volumeKm3 = state.volume;
  const volumeStr = volumeKm3 >= 1e6
    ? `${(volumeKm3 / 1e6).toFixed(2)}M km\u00b3`
    : volumeKm3 >= 1e3
      ? `${(volumeKm3 / 1e3).toFixed(1)}k km\u00b3`
      : `${volumeKm3.toFixed(0)} km\u00b3`;

  const slSign = state.sea_level >= 0 ? '+' : '';
  const slStr = `${slSign}${state.sea_level.toFixed(2)} m`;

  const dataRows = [
    { label: yearLabel, value: `${Math.round(state.year)}` },
    { label: volumeLabel, value: volumeStr },
    { label: slrLabel, value: slStr },
    { label: glLabel, value: `${state.gl_position.toFixed(0)} km` },
  ];

  // Color the sea level value based on magnitude
  const slColor = state.sea_level > 0.5
    ? '#f87171'   // red for significant rise
    : state.sea_level > 0.1
      ? '#fbbf24'  // amber for moderate
      : '#7dd3fc'; // blue for stable

  // Draw panel
  ctx.save();
  ctx.globalAlpha = 0.85;

  drawTooltipPanel(ctx, {
    x,
    y,
    maxWidth: panelWidth,
    padding,
    bgColor: 'rgba(8, 18, 35, 0.88)',
    borderColor: 'rgba(100, 160, 220, 0.2)',
    borderRadius: 5,
    borderWidth: 1,
    titleFont: 'bold 10px "IBM Plex Mono", monospace',
    titleColor: 'rgba(150, 180, 210, 0.5)',
    title: language === 'zh' ? '\u25c9 \u5b9e\u65f6\u72b6\u6001' : '\u25c9 LIVE STATUS',
    bodyFont: '10px "IBM Plex Mono", monospace',
    bodyColor: 'transparent',
    body: '', // no body text, all data rows
    lineHeight: 13,
    dataFont: '11px "IBM Plex Mono", monospace',
    dataLabelColor: 'rgba(150, 175, 200, 0.6)',
    dataValueColor: slColor,
    dataRows,
  });

  ctx.globalAlpha = 1;
  ctx.restore();
}
