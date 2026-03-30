#!/usr/bin/env node
/**
 * extract-flowlines.mjs
 *
 * Reads BedMachine + velocity binary data from the 3D-ICE project,
 * traces ~2400 flow lines, selects 30 representative ones,
 * and exports SLICE scenario JSONs + a catalog + Antarctica outline.
 *
 * Usage: node scripts/extract-flowlines.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLICE_ROOT = join(__dirname, '..');
const ICE3D_DATA = join(SLICE_ROOT, '..', '3d-ice', 'static', 'tools', 'data');

// ─── Constants (from 3D-ICE) ───────────────────────────────────
const FLOWLINE_SEED_TARGET = 2400;
const FLOWLINE_SEED_PASSES = 2;
const FLOWLINE_MIN_SEED_SPEED = 15;
const FLOWLINE_MIN_TRACE_SPEED = 4;
const FLOWLINE_MAX_STEPS = 180;
const FLOWLINE_STEP_CELLS = 0.6;
const FLOWLINE_REVERSE_DIRECTION_DOT = -0.12;
const RESAMPLE_POINTS = 80;
const FILL_INT16 = -32768;

// ─── Load Binary Data ──────────────────────────────────────────

function loadMeta(filename) {
  return JSON.parse(readFileSync(join(ICE3D_DATA, filename), 'utf-8'));
}

function loadBinary(filename) {
  return readFileSync(join(ICE3D_DATA, filename));
}

function parseInt16Field(buffer, byteOffset, count) {
  const arr = new Int16Array(buffer.buffer, buffer.byteOffset + byteOffset, count);
  const out = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    out[i] = arr[i] === FILL_INT16 ? NaN : arr[i];
  }
  return out;
}

function parseUint8Field(buffer, byteOffset, count) {
  return new Uint8Array(buffer.buffer, buffer.byteOffset + byteOffset, count);
}

console.log('Loading BedMachine data...');
const bedMeta = loadMeta('bedmachine_antarctica_v4_480.meta.json');
const bedBuf = loadBinary('bedmachine_antarctica_v4_480.bin');
const { nx, ny, x0_m, y0_m, dx_m, dy_m } = bedMeta.grid;
const totalCells = nx * ny;

const bed = parseInt16Field(bedBuf, bedMeta.fields[0].byte_offset, totalCells);
const surface = parseInt16Field(bedBuf, bedMeta.fields[1].byte_offset, totalCells);
const thickness = parseInt16Field(bedBuf, bedMeta.fields[2].byte_offset, totalCells);
const mask = parseUint8Field(bedBuf, bedMeta.fields[3].byte_offset, totalCells);

console.log(`  Grid: ${nx}x${ny}, dx=${dx_m}m, dy=${dy_m}m`);

console.log('Loading velocity data...');
const velMeta = loadMeta('antarctic_ice_velocity_phase_v01_480.meta.json');
const velBuf = loadBinary('antarctic_ice_velocity_phase_v01_480.bin');

const vxRaw = parseInt16Field(velBuf, velMeta.fields[0].byte_offset, totalCells);
const vyRaw = parseInt16Field(velBuf, velMeta.fields[1].byte_offset, totalCells);

// Compute derived fields
const iceValid = new Uint8Array(totalCells);
const velocityValid = new Uint8Array(totalCells);
const velocitySpeed = new Float64Array(totalCells);

for (let i = 0; i < totalCells; i++) {
  iceValid[i] = (mask[i] >= 2 && Number.isFinite(surface[i]) && thickness[i] > 0) ? 1 : 0;
  const vxOk = Number.isFinite(vxRaw[i]);
  const vyOk = Number.isFinite(vyRaw[i]);
  velocityValid[i] = (vxOk && vyOk) ? 1 : 0;
  velocitySpeed[i] = (vxOk && vyOk) ? Math.hypot(vxRaw[i], vyRaw[i]) : 0;
}

const field = {
  nx, ny,
  dxMeters: dx_m,
  dyMeters: dy_m,
  velocityX: vxRaw,
  velocityY: vyRaw,
  velocitySpeed,
  velocityValid,
  surfaceHeights: surface,
  bedHeights: bed,
  thicknessField: thickness,
  maskField: mask,
  iceValid,
};

// ─── Flow Line Tracing (ported from 3D-ICE) ───────────────────

function sampleVelocityBilinear(f, col, row) {
  if (col < 1 || row < 1 || col > f.nx - 2 || row > f.ny - 2) return null;
  const c0 = Math.floor(col);
  const c1 = c0 + 1;
  const r0 = Math.floor(row);
  const r1 = r0 + 1;
  const i00 = r0 * f.nx + c0;
  const i10 = r0 * f.nx + c1;
  const i01 = r1 * f.nx + c0;
  const i11 = r1 * f.nx + c1;
  if (!f.velocityValid[i00] || !f.velocityValid[i10] || !f.velocityValid[i01] || !f.velocityValid[i11]) return null;
  const tx = col - c0;
  const ty = row - r0;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  const vx = f.velocityX[i00] * w00 + f.velocityX[i10] * w10 + f.velocityX[i01] * w01 + f.velocityX[i11] * w11;
  const vy = f.velocityY[i00] * w00 + f.velocityY[i10] * w10 + f.velocityY[i01] * w01 + f.velocityY[i11] * w11;
  const speed = Math.hypot(vx, vy);
  if (!Number.isFinite(speed)) return null;
  return { vx, vy, speed };
}

function sampleFieldBilinear(f, data, col, row) {
  if (col < 1 || row < 1 || col > f.nx - 2 || row > f.ny - 2) return NaN;
  const c0 = Math.floor(col);
  const c1 = c0 + 1;
  const r0 = Math.floor(row);
  const r1 = r0 + 1;
  const i00 = r0 * f.nx + c0;
  const i10 = r0 * f.nx + c1;
  const i01 = r1 * f.nx + c0;
  const i11 = r1 * f.nx + c1;
  const h00 = data[i00], h10 = data[i10], h01 = data[i01], h11 = data[i11];
  if (!Number.isFinite(h00) || !Number.isFinite(h10) || !Number.isFinite(h01) || !Number.isFinite(h11)) {
    // Nearest neighbor fallback
    const c = Math.round(col), r = Math.round(row);
    if (c < 0 || r < 0 || c >= f.nx || r >= f.ny) return NaN;
    const val = data[r * f.nx + c];
    return Number.isFinite(val) ? val : NaN;
  }
  const tx = col - c0;
  const ty = row - r0;
  return h00 * (1 - tx) * (1 - ty) + h10 * tx * (1 - ty) + h01 * (1 - tx) * ty + h11 * tx * ty;
}

function velocityGridDirection(f, col, row) {
  const velocity = sampleVelocityBilinear(f, col, row);
  if (!velocity || velocity.speed < FLOWLINE_MIN_TRACE_SPEED) return null;
  const absDx = Math.abs(f.dxMeters);
  const absDy = Math.abs(f.dyMeters);
  const dCol = velocity.vx / absDx;
  const dRow = -velocity.vy / absDy;
  const norm = Math.hypot(dCol, dRow);
  if (norm < 1e-8) return null;
  return { speed: velocity.speed, dCol: dCol / norm, dRow: dRow / norm };
}

function traceFlowlineDirection(f, seedCol, seedRow, direction) {
  const out = [];
  let col = seedCol, row = seedRow;
  let previousDirection = null;
  for (let step = 0; step < FLOWLINE_MAX_STEPS; step++) {
    const guide = velocityGridDirection(f, col, row);
    if (!guide) break;
    const surf = sampleFieldBilinear(f, f.surfaceHeights, col, row);
    if (!Number.isFinite(surf)) break;
    if (previousDirection && guide.dCol * previousDirection.dCol + guide.dRow * previousDirection.dRow < FLOWLINE_REVERSE_DIRECTION_DOT) break;
    const bedVal = sampleFieldBilinear(f, f.bedHeights, col, row);
    const thickVal = sampleFieldBilinear(f, f.thicknessField, col, row);
    const maskIdx = Math.round(row) * f.nx + Math.round(col);
    const maskVal = (maskIdx >= 0 && maskIdx < totalCells) ? f.maskField[maskIdx] : 0;
    out.push({ col, row, speed: guide.speed, surface: surf, bed: bedVal, thickness: thickVal, mask: maskVal });
    const halfStep = FLOWLINE_STEP_CELLS * 0.5;
    const midCol = col + direction * guide.dCol * halfStep;
    const midRow = row + direction * guide.dRow * halfStep;
    const midGuide = velocityGridDirection(f, midCol, midRow);
    const nextGuide = midGuide || guide;
    if (previousDirection && nextGuide.dCol * previousDirection.dCol + nextGuide.dRow * previousDirection.dRow < FLOWLINE_REVERSE_DIRECTION_DOT) break;
    col += direction * nextGuide.dCol * FLOWLINE_STEP_CELLS;
    row += direction * nextGuide.dRow * FLOWLINE_STEP_CELLS;
    previousDirection = nextGuide;
  }
  return out;
}

function collectFlowlineSeeds(f, seedSpacing) {
  const seeds = [];
  const seen = new Set();
  const halfOffset = Math.max(1, Math.floor(seedSpacing / 2));
  for (let pass = 0; pass < FLOWLINE_SEED_PASSES; pass++) {
    const offset = pass === 0 ? 0 : halfOffset;
    const rowStart = 2 + offset;
    const colStart = 2 + offset;
    for (let rowBlock = rowStart; rowBlock < f.ny - 2; rowBlock += seedSpacing) {
      const rowEnd = Math.min(f.ny - 2, rowBlock + seedSpacing);
      for (let colBlock = colStart; colBlock < f.nx - 2; colBlock += seedSpacing) {
        const colEnd = Math.min(f.nx - 2, colBlock + seedSpacing);
        let bestIdx = -1, bestSpeed = FLOWLINE_MIN_SEED_SPEED;
        for (let r = rowBlock; r < rowEnd; r++) {
          for (let c = colBlock; c < colEnd; c++) {
            const idx = r * f.nx + c;
            if (!f.iceValid[idx] || !f.velocityValid[idx]) continue;
            const sp = f.velocitySpeed[idx];
            if (!Number.isFinite(sp) || sp < bestSpeed) continue;
            bestSpeed = sp;
            bestIdx = idx;
          }
        }
        if (bestIdx < 0) continue;
        const seedRow = Math.floor(bestIdx / f.nx);
        const seedCol = bestIdx % f.nx;
        const key = `${seedCol}:${seedRow}`;
        if (seen.has(key)) continue;
        seen.add(key);
        seeds.push({ col: seedCol, row: seedRow });
      }
    }
  }
  return seeds;
}

// ─── Trace All Flow Lines ──────────────────────────────────────

console.log('Tracing flow lines...');
const seedSpacing = Math.max(8, Math.round(Math.sqrt(totalCells / FLOWLINE_SEED_TARGET)));
const seeds = collectFlowlineSeeds(field, seedSpacing);
console.log(`  Seeds collected: ${seeds.length}`);

const allFlowlines = [];
for (const seed of seeds) {
  const forward = traceFlowlineDirection(field, seed.col, seed.row, 1);
  const backward = traceFlowlineDirection(field, seed.col, seed.row, -1);
  if (!forward.length && !backward.length) continue;
  const merged = backward.reverse().concat(forward.slice(forward.length > 0 && backward.length > 0 ? 1 : 0));
  if (merged.length < 5) continue;

  // Compute path length in km
  let pathLength = 0;
  for (let i = 1; i < merged.length; i++) {
    const dxCells = merged[i].col - merged[i - 1].col;
    const dyCells = merged[i].row - merged[i - 1].row;
    pathLength += Math.hypot(dxCells * Math.abs(dx_m), dyCells * Math.abs(dy_m));
  }
  pathLength /= 1000; // to km

  const maxSpeed = Math.max(...merged.map(p => p.speed));
  const meanSpeed = merged.reduce((s, p) => s + p.speed, 0) / merged.length;
  const minBed = Math.min(...merged.filter(p => Number.isFinite(p.bed)).map(p => p.bed));
  const maxThickness = Math.max(...merged.filter(p => Number.isFinite(p.thickness)).map(p => p.thickness));
  const hasFloating = merged.some(p => p.mask === 3);

  // Check for retrograde bed (bed deepens going upstream / inland)
  const bedValues = merged.filter(p => Number.isFinite(p.bed)).map(p => p.bed);
  let retrogradeScore = 0;
  if (bedValues.length > 10) {
    // Compare first quarter vs last quarter
    const q1 = bedValues.slice(0, Math.floor(bedValues.length / 4));
    const q4 = bedValues.slice(Math.floor(3 * bedValues.length / 4));
    const meanQ1 = q1.reduce((a, b) => a + b, 0) / q1.length;
    const meanQ4 = q4.reduce((a, b) => a + b, 0) / q4.length;
    retrogradeScore = meanQ4 < meanQ1 ? (meanQ1 - meanQ4) : 0;
  }

  // Seed position in EPSG:3031
  const seedX = x0_m + seed.col * dx_m;
  const seedY = y0_m + seed.row * dy_m;

  allFlowlines.push({
    seed, merged, pathLength, maxSpeed, meanSpeed, minBed, maxThickness,
    hasFloating, retrogradeScore, seedX, seedY,
  });
}

console.log(`  Total flow lines traced: ${allFlowlines.length}`);

// ─── Load IMBIE Basins for Classification ──────────────────────

console.log('Loading IMBIE basins...');
const imbieData = JSON.parse(readFileSync(join(ICE3D_DATA, 'imbie_refined_basins_v2.json'), 'utf-8'));
const basins = imbieData.basins;

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function classifyBasin(x, y) {
  for (const basin of basins) {
    for (const segment of basin.segments_xy_m) {
      if (pointInPolygon(x, y, segment)) {
        return basin.name;
      }
    }
  }
  return 'Unknown';
}

// Classify all flow lines
console.log('Classifying flow lines by basin...');
for (const fl of allFlowlines) {
  fl.basin = classifyBasin(fl.seedX, fl.seedY);
}

// ─── EPSG:3031 ↔ Lon/Lat Conversion ───────────────────────────

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
// EPSG:3031 Polar Stereographic South Pole
// Standard parallel: -71°, central meridian: 0°
const PHI_TS = -71 * DEG;
const A = 6378137.0;
const E = 0.0818191908426;
const MC = Math.cos(Math.abs(PHI_TS)) / Math.sqrt(1 - E * E * Math.sin(Math.abs(PHI_TS)) ** 2);
const TC = Math.tan(Math.PI / 4 - Math.abs(PHI_TS) / 2) / ((1 - E * Math.sin(Math.abs(PHI_TS))) / (1 + E * Math.sin(Math.abs(PHI_TS)))) ** (E / 2);

function epsg3031ToLonLat(x, y) {
  const rho = Math.hypot(x, y);
  if (rho < 1e-10) return [0, -90];
  const t = rho * TC / (A * MC);
  // Iterative latitude
  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 10; i++) {
    const sinPhi = Math.sin(phi);
    const phiNew = Math.PI / 2 - 2 * Math.atan(t * ((1 - E * sinPhi) / (1 + E * sinPhi)) ** (E / 2));
    if (Math.abs(phiNew - phi) < 1e-12) break;
    phi = phiNew;
  }
  const lambda = Math.atan2(x, -y);
  return [lambda * RAD, -phi * RAD];
}

// ─── Select 30 Representative Flow Lines ───────────────────────

console.log('Selecting 30 representative flow lines...');
const namesData = JSON.parse(readFileSync(join(__dirname, 'flowline-names.json'), 'utf-8'));
const targetFlowlines = namesData.flowlines;

const selected = [];

for (const target of targetFlowlines) {
  const basinName = target.target_basin;

  // Find candidates matching this basin
  let candidates = allFlowlines.filter(fl => fl.basin === basinName);

  // If no exact match, try substring match
  if (candidates.length === 0) {
    candidates = allFlowlines.filter(fl =>
      fl.basin.toLowerCase().includes(basinName.toLowerCase()) ||
      basinName.toLowerCase().includes(fl.basin.toLowerCase())
    );
  }

  // If still none, find nearest by position (use known approximate coords)
  if (candidates.length === 0) {
    console.warn(`  Warning: No candidates for basin "${basinName}" (${target.id}), using nearest fast flow line`);
    // Sort all by speed and pick from fast ones
    candidates = allFlowlines
      .filter(fl => fl.pathLength > 50 && fl.maxSpeed > 30)
      .sort((a, b) => b.maxSpeed * Math.sqrt(b.pathLength) - a.maxSpeed * Math.sqrt(a.pathLength))
      .slice(0, 20);
  }

  if (candidates.length === 0) {
    console.error(`  ERROR: No candidates at all for ${target.id}`);
    continue;
  }

  // Score: prefer long, fast trunk lines
  candidates.sort((a, b) => {
    const scoreA = a.maxSpeed * Math.sqrt(a.pathLength);
    const scoreB = b.maxSpeed * Math.sqrt(b.pathLength);
    return scoreB - scoreA;
  });

  // Check if this flow line already selected (avoid duplicates by checking seed proximity)
  let best = null;
  for (const cand of candidates) {
    const isDuplicate = selected.some(s => {
      const dx = s.flowline.seedX - cand.seedX;
      const dy = s.flowline.seedY - cand.seedY;
      return Math.hypot(dx, dy) < 50000; // 50km threshold
    });
    if (!isDuplicate) {
      best = cand;
      break;
    }
  }

  if (!best) {
    // Relax distance constraint
    best = candidates[0];
  }

  selected.push({ target, flowline: best });
  console.log(`  ${target.id}: basin=${best.basin}, length=${best.pathLength.toFixed(0)}km, maxSpeed=${best.maxSpeed.toFixed(0)}m/yr, points=${best.merged.length}`);
}

console.log(`\nSelected ${selected.length} flow lines.`);

// ─── Resample and Export Scenario JSONs ────────────────────────

function resampleAlongPath(points, fieldAccessor, numPoints) {
  // Compute cumulative distance along path
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    const dxCells = points[i].col - points[i - 1].col;
    const dyCells = points[i].row - points[i - 1].row;
    distances.push(distances[i - 1] + Math.hypot(dxCells * Math.abs(dx_m), dyCells * Math.abs(dy_m)));
  }
  const totalDist = distances[distances.length - 1];

  const result = [];
  for (let i = 0; i < numPoints; i++) {
    const targetDist = (i / (numPoints - 1)) * totalDist;
    // Find bracketing indices
    let lo = 0;
    for (let j = 1; j < distances.length; j++) {
      if (distances[j] >= targetDist) {
        lo = j - 1;
        break;
      }
      lo = j;
    }
    const hi = Math.min(lo + 1, points.length - 1);
    if (lo === hi) {
      result.push(fieldAccessor(points[lo]));
      continue;
    }
    const segLen = distances[hi] - distances[lo];
    const t = segLen > 0 ? (targetDist - distances[lo]) / segLen : 0;
    const valLo = fieldAccessor(points[lo]);
    const valHi = fieldAccessor(points[hi]);
    if (!Number.isFinite(valLo) || !Number.isFinite(valHi)) {
      result.push(Number.isFinite(valLo) ? valLo : valHi);
    } else {
      result.push(valLo + t * (valHi - valLo));
    }
  }
  return result;
}

console.log('\nExporting scenario JSONs...');
const outDir = join(SLICE_ROOT, 'public', 'data', 'scenarios', 'flowlines');
mkdirSync(outDir, { recursive: true });

const catalog = [];

for (const { target, flowline } of selected) {
  const points = flowline.merged;
  const domainLength = Math.round(flowline.pathLength);

  // Resample bed and thickness
  const bedProfile = resampleAlongPath(points, p => p.bed, RESAMPLE_POINTS);
  const thicknessProfile = resampleAlongPath(points, p => p.thickness, RESAMPLE_POINTS);

  // Clean up: round to integers, replace NaN with nearest valid
  const cleanBed = bedProfile.map(v => Number.isFinite(v) ? Math.round(v) : -500);
  const cleanThickness = thicknessProfile.map(v => Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

  // Build scenario JSON
  const scenario = {
    name: target.name_en,
    description_en: target.description_en,
    description_zh: target.description_zh,
    domain_length: domainLength,
    T_atm_base: target.T_atm_base,
    T_ocean_base: target.T_ocean_base,
    P_snow_base: target.P_snow_base,
    enable_hydrology: target.enable_hydrology,
    bedrock: cleanBed,
    initial_H: cleanThickness,
    sea_level_potential: target.sea_level_potential,
    region_info: {
      name_en: target.name_en,
      name_zh: target.name_zh,
      location: target.location_en,
      sea_level_m: target.sea_level_potential,
      current_retreat_m_yr: Math.round(flowline.maxSpeed),
      key_facts_en: target.key_facts_en,
      key_facts_zh: target.key_facts_zh,
    },
  };

  writeFileSync(join(outDir, `${target.id}.json`), JSON.stringify(scenario, null, 2));

  // Build catalog entry
  // Simplified path in lon/lat (every Nth point for ~30 coords)
  const stride = Math.max(1, Math.floor(points.length / 30));
  const pathCoords = [];
  for (let i = 0; i < points.length; i += stride) {
    const p = points[i];
    const px = x0_m + p.col * dx_m;
    const py = y0_m + p.row * dy_m;
    const [lon, lat] = epsg3031ToLonLat(px, py);
    pathCoords.push([Math.round(lon * 100) / 100, Math.round(lat * 100) / 100]);
  }

  const [seedLon, seedLat] = epsg3031ToLonLat(flowline.seedX, flowline.seedY);

  // Color based on region
  const colorMap = {
    west: '#ef4444',      // red
    east: '#3b82f6',      // blue
    peninsula: '#f59e0b', // amber
  };

  catalog.push({
    id: target.id,
    scenario: `flowlines/${target.id}`,
    name_en: target.name_en,
    name_zh: target.name_zh,
    description_en: target.description_en,
    description_zh: target.description_zh,
    region: target.region,
    basin: flowline.basin,
    location_en: target.location_en,
    location_zh: target.location_zh,
    domain_length: domainLength,
    max_speed: Math.round(flowline.maxSpeed),
    min_bed: Math.round(flowline.minBed),
    max_thickness: Math.round(flowline.maxThickness),
    sea_level_potential: target.sea_level_potential,
    has_retrograde: flowline.retrogradeScore > 100,
    has_floating: flowline.hasFloating,
    enable_hydrology: target.enable_hydrology,
    seed_lonlat: [Math.round(seedLon * 100) / 100, Math.round(seedLat * 100) / 100],
    path_lonlat: pathCoords,
    color: colorMap[target.region] || '#6b7280',
    key_facts_en: target.key_facts_en,
    key_facts_zh: target.key_facts_zh,
  });
}

writeFileSync(join(SLICE_ROOT, 'public', 'data', 'flowline-catalog.json'), JSON.stringify(catalog, null, 2));
console.log(`Catalog written with ${catalog.length} entries.`);

// ─── Extract Antarctica Outline ────────────────────────────────

console.log('Extracting Antarctica outline...');

// Find ice boundary cells (ice next to ocean)
const boundaryPoints = [];
for (let r = 1; r < ny - 1; r++) {
  for (let c = 1; c < nx - 1; c++) {
    const idx = r * nx + c;
    if (mask[idx] < 2) continue; // Not ice
    // Check if any neighbor is ocean
    const neighbors = [
      mask[(r - 1) * nx + c],
      mask[(r + 1) * nx + c],
      mask[r * nx + (c - 1)],
      mask[r * nx + (c + 1)],
    ];
    if (neighbors.some(n => n === 0)) {
      const px = x0_m + c * dx_m;
      const py = y0_m + r * dy_m;
      boundaryPoints.push([px, py]);
    }
  }
}

console.log(`  Raw boundary points: ${boundaryPoints.length}`);

// Sort by angle from center for a rough outline ordering
const cx = boundaryPoints.reduce((s, p) => s + p[0], 0) / boundaryPoints.length;
const cy = boundaryPoints.reduce((s, p) => s + p[1], 0) / boundaryPoints.length;
boundaryPoints.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));

// Simplify: take every Nth point to get ~800 points
const outlineStride = Math.max(1, Math.floor(boundaryPoints.length / 800));
const outline = [];
for (let i = 0; i < boundaryPoints.length; i += outlineStride) {
  const [lon, lat] = epsg3031ToLonLat(boundaryPoints[i][0], boundaryPoints[i][1]);
  outline.push([Math.round(lon * 100) / 100, Math.round(lat * 100) / 100]);
}

writeFileSync(join(SLICE_ROOT, 'public', 'data', 'antarctica-outline.json'), JSON.stringify(outline));
console.log(`  Outline written with ${outline.length} points.`);

console.log('\nDone! All files generated successfully.');
