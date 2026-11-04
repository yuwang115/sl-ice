/**
 * Vertex normals for indexed triangle meshes.
 *
 * A faithful port of three.js `BufferGeometry.computeVertexNormals()` for the
 * indexed case (area-weighted face normals accumulated per vertex in float32,
 * then normalised), so the geometry worker can precompute normals that shade
 * exactly like the main-thread call they replace — without its ~140 ms stall
 * on the 667 × 667 terrain grids.
 */

/** Accumulate un-normalised, area-weighted face normals onto each vertex. */
function accumulateFaceNormals(
  positions: Float32Array,
  indices: Uint32Array,
  normals: Float32Array,
): void {
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;

    // cb = pC − pB, ab = pA − pB, n = cb × ab (three's winding convention)
    const cbx = positions[c] - positions[b];
    const cby = positions[c + 1] - positions[b + 1];
    const cbz = positions[c + 2] - positions[b + 2];
    const abx = positions[a] - positions[b];
    const aby = positions[a + 1] - positions[b + 1];
    const abz = positions[a + 2] - positions[b + 2];

    const nx = cby * abz - cbz * aby;
    const ny = cbz * abx - cbx * abz;
    const nz = cbx * aby - cby * abx;

    normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
    normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
    normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
  }
}

/** Normalise every xyz triple in place; zero vectors stay zero (like three). */
function normalizeVectors(normals: Float32Array): void {
  for (let i = 0; i + 2 < normals.length; i += 3) {
    const x = normals[i];
    const y = normals[i + 1];
    const z = normals[i + 2];
    const inverseLength = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
    normals[i] = x * inverseLength;
    normals[i + 1] = y * inverseLength;
    normals[i + 2] = z * inverseLength;
  }
}

/**
 * Compute smooth vertex normals for an indexed mesh.
 * Vertices not referenced by any triangle get a zero normal.
 */
export function computeVertexNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(positions.length);
  accumulateFaceNormals(positions, indices, normals);
  normalizeVectors(normals);
  return normals;
}
