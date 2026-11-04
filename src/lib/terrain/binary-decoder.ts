/**
 * Decode quantized binary fields from BedMachine / velocity .bin files.
 * Ported from 3D-ICE explorer's decodeQuantizedInt16() and parseField().
 */

// ── Types ────────────────────────────────────────────────────────────

export interface FieldDescriptor {
  readonly name: string;
  readonly dtype: 'int16' | 'uint8' | 'uint16' | 'float32';
  readonly byte_offset: number;
  readonly byte_length: number;
}

export interface QuantizationParams {
  readonly int16_fill_value: number;
  readonly scale: number;
  readonly offset: number;
}

export interface GridMeta {
  readonly nx: number;
  readonly ny: number;
  readonly x0_m: number;
  readonly y0_m: number;
  readonly dx_m: number;
  readonly dy_m: number;
}

export interface DatasetMeta {
  readonly grid: GridMeta;
  readonly quantization: QuantizationParams;
  readonly fields: readonly FieldDescriptor[];
}

// ── Decoders ─────────────────────────────────────────────────────────

/**
 * Decode an int16 field to Float32Array, mapping fill values to NaN.
 */
export function decodeInt16Field(
  buffer: ArrayBuffer,
  field: FieldDescriptor,
  quantization: QuantizationParams,
): Float32Array {
  const raw = new Int16Array(buffer, field.byte_offset, field.byte_length / 2);
  const out = new Float32Array(raw.length);
  const { int16_fill_value, scale, offset } = quantization;

  for (let i = 0; i < raw.length; i++) {
    out[i] = raw[i] === int16_fill_value ? NaN : raw[i] * scale + offset;
  }
  return out;
}

/**
 * Decode a uint8 field (e.g. mask).
 */
export function decodeUint8Field(
  buffer: ArrayBuffer,
  field: FieldDescriptor,
): Uint8Array {
  return new Uint8Array(buffer, field.byte_offset, field.byte_length);
}

/**
 * Find a field descriptor by name, throwing if not found.
 */
export function findField(meta: DatasetMeta, name: string): FieldDescriptor {
  const field = meta.fields.find((f) => f.name === name);
  if (!field) {
    throw new Error(`Field "${name}" not found in metadata. Available: ${meta.fields.map((f) => f.name).join(', ')}`);
  }
  return field;
}

// ── Metadata validation ──────────────────────────────────────────────

const FIELD_DTYPES: readonly FieldDescriptor['dtype'][] = ['int16', 'uint8', 'uint16', 'float32'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseField(value: unknown): FieldDescriptor | null {
  if (!isRecord(value)) return null;
  const { name, dtype, byte_offset, byte_length } = value;
  if (typeof name !== 'string' || !FIELD_DTYPES.includes(dtype as FieldDescriptor['dtype'])) return null;
  if (!isFiniteNumber(byte_offset) || !isFiniteNumber(byte_length) || byte_offset < 0 || byte_length < 0) return null;
  return { name, dtype: dtype as FieldDescriptor['dtype'], byte_offset, byte_length };
}

/**
 * Validate untrusted dataset metadata (fetched JSON) before it is used to
 * index into binary buffers. Throws a descriptive error when malformed.
 *
 * Entries without a binary layout (e.g. the stats-only "speed" entry in the
 * velocity metadata) are dropped; a required field that was dropped is then
 * reported by `findField`.
 */
export function parseDatasetMeta(value: unknown, label: string): DatasetMeta {
  if (!isRecord(value) || !isRecord(value.grid) || !isRecord(value.quantization) || !Array.isArray(value.fields)) {
    throw new Error(`${label} metadata is malformed`);
  }
  const { nx, ny, x0_m, y0_m, dx_m, dy_m } = value.grid;
  if (![nx, ny, x0_m, y0_m, dx_m, dy_m].every(isFiniteNumber) || (nx as number) < 2 || (ny as number) < 2) {
    throw new Error(`${label} metadata has an invalid grid`);
  }
  const { int16_fill_value, scale, offset } = value.quantization;
  if (![int16_fill_value, scale, offset].every(isFiniteNumber)) {
    throw new Error(`${label} metadata has invalid quantization`);
  }
  const fields = value.fields
    .map(parseField)
    .filter((field): field is FieldDescriptor => field !== null);
  return {
    grid: { nx, ny, x0_m, y0_m, dx_m, dy_m } as GridMeta,
    quantization: { int16_fill_value, scale, offset } as QuantizationParams,
    fields,
  };
}

/**
 * Build a boolean-like validity mask from a Float32Array (true where finite).
 */
export function buildValidityMask(data: Float32Array): Uint8Array {
  const valid = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    valid[i] = Number.isFinite(data[i]) ? 1 : 0;
  }
  return valid;
}
