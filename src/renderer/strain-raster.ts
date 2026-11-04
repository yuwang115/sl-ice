/**
 * Strain-rate field rasterisation for the 2D heatmap overlay.
 *
 * Produces one RGBA texel per (column, sigma interval). The renderer stretches
 * each 1-texel-wide column strip over its ice column with drawImage (smoothing
 * off), which replaces thousands of fillRect calls — each with a freshly
 * parsed fillStyle string — by one drawImage per column. Buffers are reused
 * between frames.
 */

/** 5-stop strain rate colormap: indigo → teal → green → yellow → red-orange. */
const COLORMAP_STOPS: readonly (readonly [number, number, number, number])[] = [
  [0.0, 26, 26, 94],     // deep indigo
  [0.25, 45, 106, 142],  // teal
  [0.5, 77, 166, 77],    // green
  [0.75, 232, 192, 32],  // warm yellow
  [1.0, 255, 58, 32],    // red-orange
];

/** Heatmap opacity (matches the former rgba(…, 0.75) fill). */
export const STRAIN_ALPHA = 0.75;
const STRAIN_ALPHA_BYTE = Math.round(STRAIN_ALPHA * 255);

export const STRAIN_LOG_MIN = -4;   // log10(1e-4 yr^-1)
export const STRAIN_LOG_MAX = -0.5; // log10(~0.3 yr^-1)
const EPS_MIN_SQ = 1e-20;           // regularization
/** Columns thinner than this (m) are left empty. */
export const STRAIN_MIN_THICKNESS = 10;

function colormapRGB(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  let lo = 0;
  for (let i = 1; i < COLORMAP_STOPS.length; i++) {
    if (COLORMAP_STOPS[i][0] >= clamped) { lo = i - 1; break; }
  }
  const hi = Math.min(lo + 1, COLORMAP_STOPS.length - 1);
  const range = COLORMAP_STOPS[hi][0] - COLORMAP_STOPS[lo][0];
  const f = range > 0 ? (clamped - COLORMAP_STOPS[lo][0]) / range : 0;
  const channel = (k: 1 | 2 | 3) =>
    Math.round(COLORMAP_STOPS[lo][k] + f * (COLORMAP_STOPS[hi][k] - COLORMAP_STOPS[lo][k]));
  return [channel(1), channel(2), channel(3)];
}

/** 256-entry RGBA lookup table (bytes) for the strain colormap. */
export const STRAIN_COLOR_LUT: Uint8ClampedArray = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = colormapRGB(i / 255);
    lut.set([r, g, b, STRAIN_ALPHA_BYTE], i * 4);
  }
  return lut;
})();

/** Horizontal subsampling used for large grids. */
export function strainColumnStep(nx: number): number {
  return nx > 300 ? 2 : 1;
}

/** Vertical subsampling used for many sigma layers. */
export function strainLayerStep(nz: number): number {
  return nz > 15 ? 2 : 1;
}

/** LUT index (0–255) for the effective strain rate at node i, layer j; -1 if undefined. */
export function strainColorIndex(
  u2d: Float64Array, H: Float64Array, dx: number, nz: number, dsigma: number, i: number, j: number,
): number {
  const dudx = (u2d[(i + 1) * nz + j] - u2d[(i - 1) * nz + j]) / (2 * dx);
  const jUp = Math.min(j + 1, nz - 1);
  const jDn = Math.max(j - 1, 0);
  const dudsigma = (u2d[i * nz + jUp] - u2d[i * nz + jDn]) / ((jUp - jDn) * dsigma);
  const dudz = dudsigma / Math.max(H[i], 1);

  const epsEff = Math.sqrt(dudx * dudx + 0.25 * dudz * dudz + EPS_MIN_SQ);
  const t = (Math.log10(epsEff) - STRAIN_LOG_MIN) / (STRAIN_LOG_MAX - STRAIN_LOG_MIN);
  const idx = Math.round(t * 255);
  return Number.isFinite(idx) ? Math.max(0, Math.min(255, idx)) : -1;
}

export interface StrainRaster {
  /** Number of columns (one per rendered node). */
  cols: number;
  /** Number of sigma intervals (nz − 1); row 0 is the surface. */
  rows: number;
  /** RGBA bytes, row-major, `cols × rows × 4` (wrapped by an ImageData for upload). */
  data: Uint8ClampedArray<ArrayBuffer>;
  /** Grid node index of each column. */
  nodeIndex: Int32Array;
}

export interface StrainFieldInput {
  readonly u2d: Float64Array;
  readonly H: Float64Array;
  /** Node spacing (m). */
  readonly dx: number;
  readonly nx: number;
  readonly nz: number;
  readonly dsigma: number;
}

/** Reuse `target` when the dimensions match (they are fixed per scenario). */
function rasterFor(target: StrainRaster | undefined, cols: number, rows: number): StrainRaster {
  if (target && target.cols === cols && target.rows === rows) return target;
  return { cols, rows, data: new Uint8ClampedArray(cols * rows * 4), nodeIndex: new Int32Array(cols) };
}

function writeTexel(data: Uint8ClampedArray, offset: number, lutIndex: number): void {
  if (lutIndex < 0) {
    data[offset + 3] = 0;
    return;
  }
  const src = lutIndex * 4;
  data[offset] = STRAIN_COLOR_LUT[src];
  data[offset + 1] = STRAIN_COLOR_LUT[src + 1];
  data[offset + 2] = STRAIN_COLOR_LUT[src + 2];
  data[offset + 3] = STRAIN_COLOR_LUT[src + 3];
}

/**
 * Rasterise the effective strain rate. Column c covers node i = 1 + c·xStep
 * (interior nodes only); each layer-step block shares the colour sampled at
 * its lowest layer, exactly like the former per-quad fills. Columns thinner
 * than STRAIN_MIN_THICKNESS stay transparent.
 */
export function rasterizeStrainField(input: StrainFieldInput, reuse?: StrainRaster): StrainRaster {
  const { u2d, H, dx, nx, nz, dsigma } = input;
  const xStep = strainColumnStep(nx);
  const jStep = strainLayerStep(nz);
  const cols = nx > 2 ? Math.ceil((nx - 2) / xStep) : 0;
  const rows = Math.max(0, nz - 1);
  const raster = rasterFor(reuse, cols, rows);
  const { data, nodeIndex } = raster;

  for (let c = 0; c < cols; c++) {
    const i = 1 + c * xStep;
    nodeIndex[c] = i;
    const thick = H[i] >= STRAIN_MIN_THICKNESS;
    let lutIndex = -1;
    for (let r = 0; r < rows; r++) {
      // A new block starts at every jStep-th interval (r is then the block's layer j).
      if (r % jStep === 0) lutIndex = thick ? strainColorIndex(u2d, H, dx, nz, dsigma, i, r) : -1;
      writeTexel(data, ((rows - 1 - r) * cols + c) * 4, lutIndex);
    }
  }
  return raster;
}
