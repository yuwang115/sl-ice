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
