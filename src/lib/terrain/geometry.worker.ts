/**
 * Web Worker for terrain geometry generation.
 * Decodes binary data and builds mesh arrays off the main thread.
 * Results are transferred (zero-copy) back to the main thread.
 */

// ── Types (duplicated to avoid import issues in worker context) ──────

interface FieldDescriptor {
  name: string;
  dtype: string;
  byte_offset: number;
  byte_length: number;
}

interface QuantizationParams {
  int16_fill_value: number;
  scale: number;
  offset: number;
}

interface GridMeta {
  nx: number;
  ny: number;
  x0_m: number;
  y0_m: number;
  dx_m: number;
  dy_m: number;
}

interface DatasetMeta {
  grid: GridMeta;
  quantization: QuantizationParams;
  fields: FieldDescriptor[];
}

type RGB = [number, number, number];

// ── Constants ────────────────────────────────────────────────────────

const TARGET_WORLD_EXTENT_UNITS = 128;
const BASE_HORIZONTAL_VERTICAL_SCALE_RATIO = 52_000 / 3_800;
const BED_ELEVATION_MIN = -7_000;
const BED_ELEVATION_MAX = 3_500;
const ICE_THICKNESS_REFERENCE = 4_200;
const VELOCITY_MAX = 3_000;
const VELOCITY_KNEE = 20;
const MASK_FLOATING = 3;

const VELOCITY_COLOR_STOPS: [number, RGB][] = [
  [0.0, [0.06, 0.20, 0.50]],
  [0.35, [0.08, 0.62, 0.86]],
  [0.65, [0.95, 0.90, 0.27]],
  [1.0, [0.90, 0.20, 0.12]],
];

const GMT_RELIEF_OCEAN_ZERO: RGB = [0.975613, 0.999387, 0.994608];
const GMT_RELIEF_LAND_ZERO: RGB = [0.284908, 0.466429, 0.196078];

// ── Utility functions ────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(from: number[], to: number[], t: number): RGB {
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
}

function sampleColorLUT(lut: RGB[], t: number): RGB {
  if (!lut.length) return [0, 0, 0];
  const scaled = clamp01(t) * (lut.length - 1);
  const i0 = Math.floor(scaled);
  const i1 = Math.min(lut.length - 1, i0 + 1);
  return lerpColor(lut[i0], lut[i1], scaled - i0);
}

function sampleColorStops(stops: [number, RGB][], t: number): RGB {
  if (!stops.length) return [1, 1, 1];
  const clamped = clamp01(t);
  if (clamped <= stops[0][0]) return [...stops[0][1]];
  for (let i = 1; i < stops.length; i++) {
    if (clamped <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      return lerpColor(c0, c1, (clamped - t0) / Math.max(1e-6, t1 - t0));
    }
  }
  return [...stops[stops.length - 1][1]];
}

// ── Color functions ──────────────────────────────────────────────────

function bedColor(h: number, oceanLut: RGB[], landLut: RGB[]): RGB {
  const clamped = Math.max(BED_ELEVATION_MIN, Math.min(BED_ELEVATION_MAX, h));
  if (clamped < 0) {
    const t = clamp01((clamped - BED_ELEVATION_MIN) / (0 - BED_ELEVATION_MIN));
    return sampleColorLUT(oceanLut.length ? oceanLut : [GMT_RELIEF_OCEAN_ZERO], t);
  }
  if (clamped > 0) {
    const t = clamp01(clamped / BED_ELEVATION_MAX);
    return sampleColorLUT(landLut.length ? landLut : [GMT_RELIEF_LAND_ZERO], t);
  }
  const oz = oceanLut.length ? oceanLut[oceanLut.length - 1] : GMT_RELIEF_OCEAN_ZERO;
  const lz = landLut.length ? landLut[0] : GMT_RELIEF_LAND_ZERO;
  return lerpColor(oz, lz, 0.5);
}

function iceColor(thickness: number, maskValue: number): RGB {
  const t = clamp01(thickness / ICE_THICKNESS_REFERENCE);
  const grounded = lerpColor([0.72, 0.84, 0.95], [0.97, 0.99, 1.0], t);
  const floating = lerpColor([0.58, 0.78, 0.93], [0.87, 0.95, 1.0], t);
  return maskValue === MASK_FLOATING ? floating : grounded;
}

function iceBottomColor(thickness: number, maskValue: number): RGB {
  const t = clamp01(thickness / ICE_THICKNESS_REFERENCE);
  const grounded = lerpColor([0.22, 0.42, 0.58], [0.48, 0.66, 0.78], t);
  const floating = lerpColor([0.14, 0.34, 0.56], [0.40, 0.61, 0.79], t);
  return maskValue === MASK_FLOATING ? floating : grounded;
}

function velocityColor(speed: number): RGB {
  const clamped = Math.max(0, Math.min(VELOCITY_MAX, speed));
  const scaled = clamp01(Math.log1p(clamped / VELOCITY_KNEE) / Math.log1p(VELOCITY_MAX / VELOCITY_KNEE));
  return sampleColorStops(VELOCITY_COLOR_STOPS, scaled);
}

// ── Binary decoders ──────────────────────────────────────────────────

function decodeInt16(buffer: ArrayBuffer, field: FieldDescriptor, q: QuantizationParams): Float32Array {
  const raw = new Int16Array(buffer, field.byte_offset, field.byte_length / 2);
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw[i] === q.int16_fill_value ? NaN : raw[i] * q.scale + q.offset;
  }
  return out;
}

function findField(meta: DatasetMeta, name: string): FieldDescriptor {
  const f = meta.fields.find((fd) => fd.name === name);
  if (!f) throw new Error(`Field "${name}" not found`);
  return f;
}

// ── Mesh builder ─────────────────────────────────────────────────────

interface BuildResult {
  positions: Float32Array;
  colors: Uint8Array;
  indices: Uint32Array;
}

function buildSurface(
  nx: number, ny: number,
  dxMeters: number, dyMeters: number,
  hScale: number, vScale: number,
  heights: Float32Array, valid: Uint8Array,
  colorFn: (h: number, extra: number, mask: number) => RGB,
  extraField?: Float32Array, mask?: Uint8Array,
): BuildResult {
  const count = nx * ny;
  const positions = new Float32Array(count * 3);
  const colors = new Uint8Array(count * 3);
  const idxList: number[] = [];
  const halfX = (nx - 1) / 2;
  const halfY = (ny - 1) / 2;
  const absDy = Math.abs(dyMeters);

  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const i = row * nx + col;
      positions[3 * i]     = ((col - halfX) * dxMeters) / hScale;
      positions[3 * i + 1] = valid[i] ? heights[i] / vScale : 0;
      positions[3 * i + 2] = ((row - halfY) * absDy) / hScale;
      const rgb = colorFn(heights[i], extraField ? extraField[i] : 0, mask ? mask[i] : 0);
      colors[3 * i]     = Math.round(rgb[0] * 255);
      colors[3 * i + 1] = Math.round(rgb[1] * 255);
      colors[3 * i + 2] = Math.round(rgb[2] * 255);
    }
  }

  for (let row = 0; row < ny - 1; row++) {
    for (let col = 0; col < nx - 1; col++) {
      const i0 = row * nx + col;
      const i1 = i0 + 1;
      const i2 = i0 + nx;
      const i3 = i2 + 1;
      if (valid[i0] && valid[i2] && valid[i1]) idxList.push(i0, i2, i1);
      if (valid[i1] && valid[i2] && valid[i3]) idxList.push(i1, i2, i3);
    }
  }

  return { positions, colors, indices: new Uint32Array(idxList) };
}

// ── Scale computation ────────────────────────────────────────────────

function computeScales(nx: number, ny: number, dx: number, dy: number) {
  const w = Math.abs(dx) * Math.max(1, nx - 1);
  const d = Math.abs(dy) * Math.max(1, ny - 1);
  const h = Math.max(1, Math.max(w, d) / TARGET_WORLD_EXTENT_UNITS);
  const v = Math.max(1, h / BASE_HORIZONTAL_VERTICAL_SCALE_RATIO);
  return { horizontalMetersPerUnit: h, verticalMetersPerUnit: v };
}

// ── Message handler ──────────────────────────────────────────────────

interface WorkerMessage {
  type: 'buildAll';
  bedMeta: DatasetMeta;
  bedBuffer: ArrayBuffer;
  velocityMeta: DatasetMeta;
  velocityBuffer: ArrayBuffer;
  oceanLut: RGB[];
  landLut: RGB[];
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type !== 'buildAll') return;

  try {
    self.postMessage({ type: 'progress', stage: 'Decoding terrain...', progress: 0.1 });

    const { bedMeta, bedBuffer, velocityMeta, velocityBuffer, oceanLut, landLut } = msg;
    const { nx, ny, dx_m, dy_m } = bedMeta.grid;
    const q = bedMeta.quantization;

    // Decode BedMachine fields
    const bed = decodeInt16(bedBuffer, findField(bedMeta, 'bed'), q);
    const surface = decodeInt16(bedBuffer, findField(bedMeta, 'surface'), q);
    const thickness = decodeInt16(bedBuffer, findField(bedMeta, 'thickness'), q);
    const maskField = bedMeta.fields.find((f) => f.name === 'mask');
    const mask = maskField
      ? new Uint8Array(bedBuffer, maskField.byte_offset, maskField.byte_length)
      : new Uint8Array(nx * ny);

    self.postMessage({ type: 'progress', stage: 'Building bedrock...', progress: 0.3 });

    // Validity masks
    const cellCount = nx * ny;
    const bedValid = new Uint8Array(cellCount);
    const iceValid = new Uint8Array(cellCount);
    for (let i = 0; i < cellCount; i++) {
      bedValid[i] = Number.isFinite(bed[i]) ? 1 : 0;
      const m = mask[i];
      iceValid[i] = (m === 2 || m === 3 || m === 4) && Number.isFinite(surface[i]) ? 1 : 0;
    }

    const { horizontalMetersPerUnit: hScale, verticalMetersPerUnit: vScale } =
      computeScales(nx, ny, dx_m, dy_m);

    // Build bedrock mesh
    const bedResult = buildSurface(
      nx, ny, dx_m, dy_m, hScale, vScale,
      bed, bedValid,
      (h) => bedColor(h, oceanLut, landLut),
    );

    self.postMessage({ type: 'progress', stage: 'Building ice surface...', progress: 0.5 });

    // Build ice surface mesh
    const iceResult = buildSurface(
      nx, ny, dx_m, dy_m, hScale, vScale,
      surface, iceValid,
      (_h, extra, m) => iceColor(extra, m),
      thickness, mask,
    );

    self.postMessage({ type: 'progress', stage: 'Building ice bottom...', progress: 0.6 });

    // Compute ice bottom heights (surface − thickness)
    const iceBottomHeights = new Float32Array(cellCount);
    const iceBottomValid = new Uint8Array(cellCount);
    for (let i = 0; i < cellCount; i++) {
      if (iceValid[i] && thickness[i] > 0) {
        const baseH = surface[i] - thickness[i];
        if (Number.isFinite(baseH)) {
          iceBottomHeights[i] = baseH;
          iceBottomValid[i] = 1;
        } else {
          iceBottomHeights[i] = NaN;
        }
      } else {
        iceBottomHeights[i] = NaN;
      }
    }

    // Build ice bottom mesh (darker blue tones, slightly rougher)
    const iceBottomResult = buildSurface(
      nx, ny, dx_m, dy_m, hScale, vScale,
      iceBottomHeights, iceBottomValid,
      (_h, extra, m) => iceBottomColor(extra, m),
      thickness, mask,
    );

    self.postMessage({ type: 'progress', stage: 'Building velocity overlay...', progress: 0.7 });

    // Decode velocity
    const vq = velocityMeta.quantization;
    const vx = decodeInt16(velocityBuffer, findField(velocityMeta, 'vx'), vq);
    const vy = decodeInt16(velocityBuffer, findField(velocityMeta, 'vy'), vq);
    const speed = new Float32Array(cellCount);
    const velValid = new Uint8Array(cellCount);
    for (let i = 0; i < cellCount; i++) {
      if (Number.isFinite(vx[i]) && Number.isFinite(vy[i]) && iceValid[i]) {
        speed[i] = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
        velValid[i] = 1;
      }
    }

    // Build velocity mesh (same geometry as ice surface, slightly offset handled in component)
    const velResult = buildSurface(
      nx, ny, dx_m, dy_m, hScale, vScale,
      surface, velValid,
      () => [0, 0, 0] as RGB, // placeholder, will be overwritten
    );

    // Override colors with velocity palette
    for (let i = 0; i < cellCount; i++) {
      if (velValid[i]) {
        const rgb = velocityColor(speed[i]);
        velResult.colors[3 * i] = Math.round(rgb[0] * 255);
        velResult.colors[3 * i + 1] = Math.round(rgb[1] * 255);
        velResult.colors[3 * i + 2] = Math.round(rgb[2] * 255);
      }
    }

    self.postMessage({ type: 'progress', stage: 'Finalizing...', progress: 0.9 });

    // Send all results back with transferable arrays
    const result = {
      type: 'result' as const,
      hScale,
      vScale,
      nx, ny,
      surface,
      bed: {
        positions: bedResult.positions,
        colors: bedResult.colors,
        indices: bedResult.indices,
      },
      ice: {
        positions: iceResult.positions,
        colors: iceResult.colors,
        indices: iceResult.indices,
      },
      iceBottom: {
        positions: iceBottomResult.positions,
        colors: iceBottomResult.colors,
        indices: iceBottomResult.indices,
      },
      velocity: {
        positions: velResult.positions,
        colors: velResult.colors,
        indices: velResult.indices,
      },
    };

    self.postMessage(result, {
      transfer: [
      result.surface.buffer,
      result.bed.positions.buffer,
      result.bed.colors.buffer,
      result.bed.indices.buffer,
      result.ice.positions.buffer,
      result.ice.colors.buffer,
      result.ice.indices.buffer,
      result.iceBottom.positions.buffer,
      result.iceBottom.colors.buffer,
      result.iceBottom.indices.buffer,
      result.velocity.positions.buffer,
      result.velocity.colors.buffer,
      result.velocity.indices.buffer,
      ] as Transferable[],
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
