#!/usr/bin/env node

/**
 * Build a stable major-basin grouping file from the 199 IMBIE refined basins.
 *
 * Rule:
 * - Take the 70 largest refined basins as anchors.
 * - Assign every remaining refined basin to the nearest anchor by label-point distance.
 * - Persist the explicit grouping so downstream data generation is reproducible.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SLICE_ROOT = join(__dirname, '..');
const DEFAULT_BASINS_JSON = join(SLICE_ROOT, '..', '3d-ice', 'static', 'tools', 'data', 'imbie_refined_basins_v2.json');
const FLOWLINE_NAMES_JSON = join(__dirname, 'flowline-names.json');
const OUTPUT_JSON = join(__dirname, 'major-basin-groups.json');
const GROUP_COUNT = 70;

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const PHI_TS = -71 * DEG;
const A = 6378137.0;
const E = 0.0818191908426;
const MC = Math.cos(Math.abs(PHI_TS)) / Math.sqrt(1 - E * E * Math.sin(Math.abs(PHI_TS)) ** 2);
const TC = Math.tan(Math.PI / 4 - Math.abs(PHI_TS) / 2) / ((1 - E * Math.sin(Math.abs(PHI_TS))) / (1 + E * Math.sin(Math.abs(PHI_TS)))) ** (E / 2);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function epsg3031ToLonLat(x, y) {
  const rho = Math.hypot(x, y);
  if (rho < 1e-10) return [0, -90];
  const t = rho * TC / (A * MC);
  let phi = Math.PI / 2 - 2 * Math.atan(t);
  for (let i = 0; i < 10; i += 1) {
    const sinPhi = Math.sin(phi);
    const next = Math.PI / 2 - 2 * Math.atan(t * ((1 - E * sinPhi) / (1 + E * sinPhi)) ** (E / 2));
    if (Math.abs(next - phi) < 1e-12) break;
    phi = next;
  }
  const lambda = Math.atan2(x, -y);
  return [lambda * RAD, -phi * RAD];
}

function inferRegion(lon, lat) {
  if (lon >= -100 && lon <= -45 && lat >= -78.5) {
    return 'peninsula';
  }
  if (lon < 0 && lon > -170) {
    return 'west';
  }
  return 'east';
}

function buildZhNameMap(flowlineNames) {
  const zhByBasin = new Map();
  const regionByBasin = new Map();
  for (const row of flowlineNames.flowlines ?? []) {
    const cleaned = String(row.name_zh ?? '')
      .replace(/（.*?）/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
    if (cleaned && !zhByBasin.has(row.target_basin)) {
      zhByBasin.set(row.target_basin, cleaned);
    }
    if (row.region && !regionByBasin.has(row.target_basin)) {
      regionByBasin.set(row.target_basin, row.region);
    }
  }
  return { zhByBasin, regionByBasin };
}

function main() {
  const basinsPayload = JSON.parse(readFileSync(DEFAULT_BASINS_JSON, 'utf8'));
  const flowlineNames = JSON.parse(readFileSync(FLOWLINE_NAMES_JSON, 'utf8'));
  const { zhByBasin, regionByBasin } = buildZhNameMap(flowlineNames);

  const basins = [...basinsPayload.basins].sort((a, b) => b.area_km2 - a.area_km2);
  const anchors = basins.slice(0, GROUP_COUNT);
  const anchorIds = new Set(anchors.map((anchor) => anchor.id));

  const groups = anchors.map((anchor) => {
    const [labelX, labelY] = anchor.label_xy_m;
    const [lon, lat] = epsg3031ToLonLat(labelX, labelY);
    return {
      group_id: slugify(anchor.name),
      group_name_en: anchor.name,
      group_name_zh: zhByBasin.get(anchor.name) ?? `${anchor.name}流域`,
      region: regionByBasin.get(anchor.name) ?? inferRegion(lon, lat),
      anchor_basin_id: anchor.id,
      anchor_basin_name: anchor.name,
      anchor_label_xy_m: anchor.label_xy_m,
      anchor_lonlat: [Number(lon.toFixed(4)), Number(lat.toFixed(4))],
      member_basins: [anchor.name],
      total_area_km2: anchor.area_km2,
    };
  });

  const groupByAnchorId = new Map(groups.map((group) => [group.anchor_basin_id, group]));

  for (const basin of basins) {
    if (anchorIds.has(basin.id)) continue;
    const [bx, by] = basin.label_xy_m;
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
      const [ax, ay] = anchor.label_xy_m;
      const distance = Math.hypot(bx - ax, by - ay);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = anchor;
      }
    }
    const group = groupByAnchorId.get(best.id);
    group.member_basins.push(basin.name);
    group.total_area_km2 += basin.area_km2;
  }

  groups.sort((a, b) => b.total_area_km2 - a.total_area_km2);
  for (const group of groups) {
    group.member_basins.sort((a, b) => a.localeCompare(b));
    group.total_area_km2 = Number(group.total_area_km2.toFixed(2));
  }

  const output = {
    dataset: 'Antarctica major basin groups for SLICE flowline generation',
    source_basins_json: 'imbie_refined_basins_v2.json',
    group_count: groups.length,
    anchor_rule: `Top ${GROUP_COUNT} refined basins by area; remaining basins assigned by nearest label-point distance.`,
    groups,
  };

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_JSON} with ${groups.length} groups`);
}

main();
