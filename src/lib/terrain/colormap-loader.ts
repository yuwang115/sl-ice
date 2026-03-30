/**
 * Load and parse GMT Relief RGB colormap table.
 * Produces ocean and land LUTs split at entry 128.
 */

import type { RGB } from './color-functions';

export interface ColorTableResult {
  readonly ocean: RGB[];
  readonly land: RGB[];
}

/**
 * Parse a whitespace-separated RGB text table (e.g. GMT_relief.rgb).
 * Values can be in 0-1 or 0-255 range; auto-detected.
 */
function parseRgbTableText(text: string): RGB[] {
  const lines = text.split(/\r?\n/);
  const rawColors: [number, number, number][] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('ncolors')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;
    rawColors.push([r, g, b]);
  }

  const has255Range = rawColors.some(([r, g, b]) => r > 1 || g > 1 || b > 1);
  const scale = has255Range ? 1 / 255 : 1;

  return rawColors.map(([r, g, b]) => [
    Math.max(0, Math.min(1, r * scale)),
    Math.max(0, Math.min(1, g * scale)),
    Math.max(0, Math.min(1, b * scale)),
  ]);
}

/**
 * Fetch and parse the GMT Relief colormap, returning ocean (0-127) and land (128-255) LUTs.
 */
export async function loadGmtReliefColormap(
  url = '/3d-ice/data/GMT_relief.rgb',
): Promise<ColorTableResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load colormap: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const colors = parseRgbTableText(text);

  return {
    ocean: colors.slice(0, 128),
    land: colors.slice(128, 256),
  };
}
