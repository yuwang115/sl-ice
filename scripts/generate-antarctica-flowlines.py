#!/usr/bin/env python3
"""Generate ~100 representative Antarctic flowlines from raw BedMachine/velocity NC files."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import h5py
import numpy as np
from netCDF4 import Dataset

WORKING_STRIDE = 4  # BedMachine 500 m -> 2 km
WORKING_SPACING_KM = 2.0
TARGET_CANDIDATE_COUNT = 12000
FLOWLINE_SEED_PASSES = 2
MIN_SEED_SPEED = 15.0
MIN_TRACE_SPEED = 4.0
MAX_STEPS = 5000
STEP_CELLS = 0.75
REVERSE_DIRECTION_DOT = -0.12
MIN_PATH_LENGTH_KM = 40.0
MIN_VALID_RATIO = 0.8
GROUP_COUNT = 70
MIN_START_DISTANCE_M = 50_000.0
MAX_OVERLAP_RATIO = 0.60
PRIORITY_GROUP_IDS = ("thwaites", "pine-island", "totten", "lambert", "recovery", "byrd")
VELOCITY_FILL_EPS = 1e-3
FILL_FLOAT = -9999.0
RHO_ICE = 917.0
RHO_WATER = 1028.0
VOLUME_TO_SLE = RHO_ICE / (RHO_WATER * 3.625e14)

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DEFAULT_BASINS_JSON = PROJECT_ROOT.parent / "3d-ice" / "static" / "tools" / "data" / "imbie_refined_basins_v2.json"
DEFAULT_GROUPS_JSON = SCRIPT_DIR / "major-basin-groups.json"
DEFAULT_NAMES_JSON = SCRIPT_DIR / "flowline-names.json"

REGION_LABELS = {
    "west": ("West Antarctica", "西南极"),
    "east": ("East Antarctica", "东南极"),
    "peninsula": ("Antarctic Peninsula", "南极半岛"),
}
REGION_COLORS = {
    "west": "#ef4444",
    "east": "#3b82f6",
    "peninsula": "#f59e0b",
}

DEG = math.pi / 180.0
RAD = 180.0 / math.pi
PHI_TS = -71.0 * DEG
A = 6378137.0
E = 0.0818191908426
MC = math.cos(abs(PHI_TS)) / math.sqrt(1.0 - E * E * math.sin(abs(PHI_TS)) ** 2)
TC = math.tan(math.pi / 4.0 - abs(PHI_TS) / 2.0) / (
    ((1.0 - E * math.sin(abs(PHI_TS))) / (1.0 + E * math.sin(abs(PHI_TS)))) ** (E / 2.0)
)


@dataclass(slots=True)
class BasinPolygon:
    name: str
    segments: list[np.ndarray]
    segment_bboxes: list[tuple[float, float, float, float]]
    bbox: tuple[float, float, float, float]


@dataclass(slots=True)
class TemplateMeta:
    region: str
    T_atm_base: float
    T_ocean_base: float
    P_snow_base: float
    enable_hydrology: bool
    location_en: str
    location_zh: str


@dataclass(slots=True)
class FieldData:
    x: np.ndarray
    y: np.ndarray
    bed: np.ndarray
    surface: np.ndarray
    thickness: np.ndarray
    mask: np.ndarray
    vx: np.ndarray
    vy: np.ndarray
    speed: np.ndarray
    ice_valid: np.ndarray
    velocity_valid: np.ndarray
    nx: int
    ny: int
    x0: float
    y0: float
    dx: float
    dy: float
    abs_dx: float
    abs_dy: float


@dataclass(slots=True)
class Candidate:
    group_id: str
    group_name_en: str
    group_name_zh: str
    region: str
    group_area_km2: float
    refined_basin_name: str
    seed_col: int
    seed_row: int
    seed_x_m: float
    seed_y_m: float
    path_length_km: float
    domain_length_km: float
    max_speed: float
    mean_speed: float
    min_bed: float
    max_thickness: float
    start_surface: float
    has_floating: bool
    has_retrograde: bool
    trunk_score: float
    sampled_distance_km: np.ndarray
    sampled_cols: np.ndarray
    sampled_rows: np.ndarray
    sampled_x_m: np.ndarray
    sampled_y_m: np.ndarray
    sampled_bed: np.ndarray
    sampled_surface: np.ndarray
    sampled_thickness: np.ndarray
    sampled_speed: np.ndarray
    sampled_mask: np.ndarray
    sampled_cell_keys: frozenset[tuple[int, int]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate representative Antarctic flowlines from raw NC datasets."
    )
    parser.add_argument("--bedmachine-nc", required=True, help="Path to BedMachineAntarctica_V4.nc")
    parser.add_argument("--velocity-nc", required=True, help="Path to raw Antarctica velocity .nc")
    parser.add_argument(
        "--basins-json",
        default=str(DEFAULT_BASINS_JSON),
        help="Path to imbie_refined_basins_v2.json",
    )
    parser.add_argument(
        "--target-lines",
        type=int,
        default=100,
        help="Exact number of flowlines to export.",
    )
    parser.add_argument(
        "--spacing-km",
        type=float,
        default=2.0,
        help="Along-flowline geometry spacing in km.",
    )
    parser.add_argument(
        "--output-dir",
        default="public/data",
        help="Output directory containing flowline-catalog.json and scenarios/flowlines/*.json",
    )
    return parser.parse_args()


def ensure_exists(path: Path, label: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing {label}: {path}")


def scalar_attr(value: Any, default: float = FILL_FLOAT) -> float:
    if value is None:
        return default
    if isinstance(value, np.ndarray):
        if value.size == 0:
            return default
        return float(value.reshape(-1)[0])
    return float(value)


def normalize_grid(data: np.ndarray, fill_value: float) -> np.ndarray:
    out = np.asarray(data, dtype=np.float32)
    invalid = (~np.isfinite(out)) | np.isclose(out, fill_value, atol=1e-5)
    out[invalid] = np.nan
    return out


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "basin"


def normalize_key(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def round_float(value: float, digits: int = 2) -> float:
    return round(float(value), digits)


def epsg3031_to_lonlat(x: float, y: float) -> tuple[float, float]:
    rho = math.hypot(x, y)
    if rho < 1e-10:
        return (0.0, -90.0)
    t = rho * TC / (A * MC)
    phi = math.pi / 2.0 - 2.0 * math.atan(t)
    for _ in range(10):
        sin_phi = math.sin(phi)
        updated = math.pi / 2.0 - 2.0 * math.atan(
            t * ((1.0 - E * sin_phi) / (1.0 + E * sin_phi)) ** (E / 2.0)
        )
        if abs(updated - phi) < 1e-12:
            break
        phi = updated
    lam = math.atan2(x, -y)
    return (lam * RAD, -phi * RAD)


def point_in_polygon(x: float, y: float, polygon: np.ndarray) -> bool:
    inside = False
    xj, yj = polygon[-1]
    for xi, yi in polygon:
        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        xj, yj = xi, yi
    return inside


def compute_bbox(segment: np.ndarray) -> tuple[float, float, float, float]:
    return (
        float(np.min(segment[:, 0])),
        float(np.min(segment[:, 1])),
        float(np.max(segment[:, 0])),
        float(np.max(segment[:, 1])),
    )


def load_refined_basins(path: Path) -> list[BasinPolygon]:
    data = json.loads(path.read_text(encoding="utf-8"))
    basins: list[BasinPolygon] = []
    for basin in data["basins"]:
        segments = [np.asarray(segment, dtype=np.float64) for segment in basin["segments_xy_m"]]
        segment_bboxes = [compute_bbox(segment) for segment in segments]
        overall = (
            min(b[0] for b in segment_bboxes),
            min(b[1] for b in segment_bboxes),
            max(b[2] for b in segment_bboxes),
            max(b[3] for b in segment_bboxes),
        )
        basins.append(
            BasinPolygon(
                name=basin["name"],
                segments=segments,
                segment_bboxes=segment_bboxes,
                bbox=overall,
            )
        )
    return basins


def classify_refined_basin(x: float, y: float, basins: list[BasinPolygon]) -> str | None:
    for basin in basins:
        min_x, min_y, max_x, max_y = basin.bbox
        if x < min_x or x > max_x or y < min_y or y > max_y:
            continue
        for segment, bbox in zip(basin.segments, basin.segment_bboxes):
            seg_min_x, seg_min_y, seg_max_x, seg_max_y = bbox
            if x < seg_min_x or x > seg_max_x or y < seg_min_y or y > seg_max_y:
                continue
            if point_in_polygon(x, y, segment):
                return basin.name
    return None


def load_major_groups(path: Path) -> tuple[list[dict[str, Any]], dict[str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    groups = data["groups"]
    if data.get("group_count") != GROUP_COUNT:
        raise RuntimeError(f"Expected {GROUP_COUNT} major groups in {path}, found {data.get('group_count')}")
    refined_to_group: dict[str, str] = {}
    for group in groups:
        for basin_name in group["member_basins"]:
            refined_to_group[basin_name] = group["group_id"]
    return groups, refined_to_group


def aggregate_template(items: list[dict[str, Any]]) -> TemplateMeta:
    first = items[0]
    return TemplateMeta(
        region=first["region"],
        T_atm_base=float(np.mean([item["T_atm_base"] for item in items])),
        T_ocean_base=float(np.mean([item["T_ocean_base"] for item in items])),
        P_snow_base=float(np.mean([item["P_snow_base"] for item in items])),
        enable_hydrology=bool(any(item["enable_hydrology"] for item in items)),
        location_en=first["location_en"],
        location_zh=first["location_zh"],
    )


def load_templates(path: Path) -> tuple[dict[str, TemplateMeta], dict[str, TemplateMeta]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    by_basin: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_region: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in data["flowlines"]:
        by_basin[normalize_key(item["target_basin"])].append(item)
        by_region[item["region"]].append(item)
    basin_templates = {key: aggregate_template(items) for key, items in by_basin.items()}
    region_templates = {}
    for key, items in by_region.items():
        template = aggregate_template(items)
        template.location_en = ""
        template.location_zh = ""
        region_templates[key] = template
    return basin_templates, region_templates


def match_template(
    group: dict[str, Any],
    basin_templates: dict[str, TemplateMeta],
    region_templates: dict[str, TemplateMeta],
) -> TemplateMeta:
    keys = {
        normalize_key(group["group_id"]),
        normalize_key(group["group_name_en"]),
        *(normalize_key(name) for name in group["member_basins"]),
    }
    best_key = None
    best_score = -1
    for basin_key in basin_templates:
        for key in keys:
            if not key:
                continue
            score = -1
            if key == basin_key:
                score = 100
            elif key in basin_key or basin_key in key:
                score = 60
            if score > best_score:
                best_score = score
                best_key = basin_key
    if best_key is not None and best_score >= 60:
        return basin_templates[best_key]
    region = group["region"]
    if region not in region_templates:
        raise RuntimeError(f"No fallback template for region {region}")
    return region_templates[region]


def load_bedmachine_grid(path: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    print(f"Loading BedMachine from {path} ...")
    with h5py.File(path, "r") as ds:
        x = np.asarray(ds["x"][::WORKING_STRIDE], dtype=np.float64)
        y = np.asarray(ds["y"][::WORKING_STRIDE], dtype=np.float64)
        bed = normalize_grid(ds["bed"][::WORKING_STRIDE, ::WORKING_STRIDE], scalar_attr(ds["bed"].attrs.get("_FillValue")))
        surface = normalize_grid(
            ds["surface"][::WORKING_STRIDE, ::WORKING_STRIDE],
            scalar_attr(ds["surface"].attrs.get("_FillValue")),
        )
        thickness = normalize_grid(
            ds["thickness"][::WORKING_STRIDE, ::WORKING_STRIDE],
            scalar_attr(ds["thickness"].attrs.get("_FillValue")),
        )
        mask = np.asarray(ds["mask"][::WORKING_STRIDE, ::WORKING_STRIDE], dtype=np.uint8)
    print(f"  BedMachine working grid: {x.shape[0]} x {y.shape[0]} at {x[1] - x[0]:.0f} m")
    return x, y, bed, surface, thickness, mask


def build_interp_indices(target_axis: np.ndarray, source_axis: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    src0 = float(source_axis[0])
    src_step = float(source_axis[1] - source_axis[0])
    positions = (target_axis - src0) / src_step
    idx0 = np.floor(positions).astype(np.int64)
    weights = (positions - idx0).astype(np.float32)
    idx1 = idx0 + 1
    valid = (idx0 >= 0) & (idx1 < source_axis.shape[0])
    idx0 = np.clip(idx0, 0, source_axis.shape[0] - 1)
    idx1 = np.clip(idx1, 0, source_axis.shape[0] - 1)
    return idx0, idx1, weights, valid


def sanitize_velocity_row(row: np.ndarray, fill_value: float) -> np.ndarray:
    out = np.asarray(row, dtype=np.float32)
    invalid = (~np.isfinite(out)) | np.isclose(out, fill_value, atol=VELOCITY_FILL_EPS)
    out[invalid] = np.nan
    return out


def nearest_neighbor_from_rows(
    row00: np.ndarray,
    row01: np.ndarray,
    row10: np.ndarray,
    row11: np.ndarray,
    wx: np.ndarray,
    wy: float,
) -> np.ndarray:
    choose_x = np.where(wx <= 0.5, 0, 1)
    choose_y = 0 if wy <= 0.5 else 1
    out = np.full(wx.shape, np.nan, dtype=np.float32)
    if choose_y == 0:
        out = np.where(choose_x == 0, row00, row01)
    else:
        out = np.where(choose_x == 0, row10, row11)
    if np.any(~np.isfinite(out)):
        for candidate in (row00, row01, row10, row11):
            out = np.where(np.isfinite(out), out, candidate)
    return out


def resample_velocity_to_grid(path: Path, target_x: np.ndarray, target_y: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    print(f"Resampling velocity from {path} ...")
    with Dataset(path, "r") as ds:
        src_x = np.asarray(ds.variables["x"][:], dtype=np.float64)
        src_y = np.asarray(ds.variables["y"][:], dtype=np.float64)
        vx_var = ds.variables["vx"]
        vy_var = ds.variables["vy"]
        fill_value = scalar_attr(getattr(vx_var, "_FillValue", None), -99999.9)

        ix0, ix1, wx, valid_x = build_interp_indices(target_x, src_x)
        iy0, iy1, wy, valid_y = build_interp_indices(target_y, src_y)

        target_nx = target_x.shape[0]
        target_ny = target_y.shape[0]
        vx_out = np.full((target_ny, target_nx), np.nan, dtype=np.float32)
        vy_out = np.full((target_ny, target_nx), np.nan, dtype=np.float32)

        for row_idx in range(target_ny):
            if not valid_y[row_idx]:
                continue
            sy0 = int(iy0[row_idx])
            sy1 = int(iy1[row_idx])
            y_weight = float(wy[row_idx])

            vx_row0 = sanitize_velocity_row(vx_var[sy0, :], fill_value)
            vy_row0 = sanitize_velocity_row(vy_var[sy0, :], fill_value)
            if sy1 == sy0:
                vx_row1 = vx_row0
                vy_row1 = vy_row0
            else:
                vx_row1 = sanitize_velocity_row(vx_var[sy1, :], fill_value)
                vy_row1 = sanitize_velocity_row(vy_var[sy1, :], fill_value)

            vx00 = vx_row0[ix0]
            vx01 = vx_row0[ix1]
            vx10 = vx_row1[ix0]
            vx11 = vx_row1[ix1]
            vy00 = vy_row0[ix0]
            vy01 = vy_row0[ix1]
            vy10 = vy_row1[ix0]
            vy11 = vy_row1[ix1]

            bilinear_valid = (
                valid_x
                & np.isfinite(vx00)
                & np.isfinite(vx01)
                & np.isfinite(vx10)
                & np.isfinite(vx11)
                & np.isfinite(vy00)
                & np.isfinite(vy01)
                & np.isfinite(vy10)
                & np.isfinite(vy11)
            )

            vx_interp = np.full(target_nx, np.nan, dtype=np.float32)
            vy_interp = np.full(target_nx, np.nan, dtype=np.float32)
            if np.any(bilinear_valid):
                one_minus_x = (1.0 - wx).astype(np.float32)
                vx_top = vx00 * one_minus_x + vx01 * wx
                vx_bottom = vx10 * one_minus_x + vx11 * wx
                vy_top = vy00 * one_minus_x + vy01 * wx
                vy_bottom = vy10 * one_minus_x + vy11 * wx
                vx_interp[bilinear_valid] = (
                    vx_top[bilinear_valid] * (1.0 - y_weight) + vx_bottom[bilinear_valid] * y_weight
                )
                vy_interp[bilinear_valid] = (
                    vy_top[bilinear_valid] * (1.0 - y_weight) + vy_bottom[bilinear_valid] * y_weight
                )

            fallback = ~bilinear_valid & valid_x
            if np.any(fallback):
                vx_fallback = nearest_neighbor_from_rows(vx00, vx01, vx10, vx11, wx, y_weight)
                vy_fallback = nearest_neighbor_from_rows(vy00, vy01, vy10, vy11, wx, y_weight)
                vx_interp[fallback] = vx_fallback[fallback]
                vy_interp[fallback] = vy_fallback[fallback]

            vx_out[row_idx, :] = vx_interp
            vy_out[row_idx, :] = vy_interp

            if row_idx % 250 == 0 or row_idx == target_ny - 1:
                print(f"  velocity rows: {row_idx + 1}/{target_ny}")

    return vx_out, vy_out


def build_field(
    x: np.ndarray,
    y: np.ndarray,
    bed: np.ndarray,
    surface: np.ndarray,
    thickness: np.ndarray,
    mask: np.ndarray,
    vx: np.ndarray,
    vy: np.ndarray,
) -> FieldData:
    speed = np.hypot(vx, vy).astype(np.float32)
    velocity_valid = np.isfinite(vx) & np.isfinite(vy)
    ice_valid = (mask >= 2) & np.isfinite(surface) & np.isfinite(thickness) & (thickness > 0)
    return FieldData(
        x=x,
        y=y,
        bed=bed,
        surface=surface,
        thickness=thickness,
        mask=mask,
        vx=vx,
        vy=vy,
        speed=speed,
        ice_valid=ice_valid,
        velocity_valid=velocity_valid,
        nx=x.shape[0],
        ny=y.shape[0],
        x0=float(x[0]),
        y0=float(y[0]),
        dx=float(x[1] - x[0]),
        dy=float(y[1] - y[0]),
        abs_dx=abs(float(x[1] - x[0])),
        abs_dy=abs(float(y[1] - y[0])),
    )


def sample_velocity_bilinear(field: FieldData, col: float, row: float) -> tuple[float, float, float] | None:
    if col < 1 or row < 1 or col > field.nx - 2 or row > field.ny - 2:
        return None
    c0 = int(math.floor(col))
    c1 = c0 + 1
    r0 = int(math.floor(row))
    r1 = r0 + 1
    if not (
        field.velocity_valid[r0, c0]
        and field.velocity_valid[r0, c1]
        and field.velocity_valid[r1, c0]
        and field.velocity_valid[r1, c1]
    ):
        return None
    tx = col - c0
    ty = row - r0
    w00 = (1.0 - tx) * (1.0 - ty)
    w10 = tx * (1.0 - ty)
    w01 = (1.0 - tx) * ty
    w11 = tx * ty
    vx = (
        float(field.vx[r0, c0]) * w00
        + float(field.vx[r0, c1]) * w10
        + float(field.vx[r1, c0]) * w01
        + float(field.vx[r1, c1]) * w11
    )
    vy = (
        float(field.vy[r0, c0]) * w00
        + float(field.vy[r0, c1]) * w10
        + float(field.vy[r1, c0]) * w01
        + float(field.vy[r1, c1]) * w11
    )
    speed = math.hypot(vx, vy)
    if not math.isfinite(speed):
        return None
    return (vx, vy, speed)


def sample_scalar_bilinear(data: np.ndarray, col: float, row: float) -> float:
    ny, nx = data.shape
    if col < 1 or row < 1 or col > nx - 2 or row > ny - 2:
        return math.nan
    c0 = int(math.floor(col))
    c1 = c0 + 1
    r0 = int(math.floor(row))
    r1 = r0 + 1
    h00 = float(data[r0, c0])
    h10 = float(data[r0, c1])
    h01 = float(data[r1, c0])
    h11 = float(data[r1, c1])
    if not (math.isfinite(h00) and math.isfinite(h10) and math.isfinite(h01) and math.isfinite(h11)):
        c = min(max(int(round(col)), 0), nx - 1)
        r = min(max(int(round(row)), 0), ny - 1)
        val = float(data[r, c])
        return val if math.isfinite(val) else math.nan
    tx = col - c0
    ty = row - r0
    return (
        h00 * (1.0 - tx) * (1.0 - ty)
        + h10 * tx * (1.0 - ty)
        + h01 * (1.0 - tx) * ty
        + h11 * tx * ty
    )


def sample_mask_nearest(mask: np.ndarray, cols: np.ndarray, rows: np.ndarray) -> np.ndarray:
    c = np.clip(np.rint(cols).astype(np.int64), 0, mask.shape[1] - 1)
    r = np.clip(np.rint(rows).astype(np.int64), 0, mask.shape[0] - 1)
    return mask[r, c].astype(np.uint8)


def velocity_grid_direction(field: FieldData, col: float, row: float) -> tuple[float, float, float] | None:
    sampled = sample_velocity_bilinear(field, col, row)
    if sampled is None:
        return None
    vx, vy, speed = sampled
    if speed < MIN_TRACE_SPEED:
        return None
    dcol = vx / field.abs_dx
    drow = -vy / field.abs_dy
    norm = math.hypot(dcol, drow)
    if norm < 1e-8:
        return None
    return (speed, dcol / norm, drow / norm)


def trace_flowline_direction(field: FieldData, seed_col: int, seed_row: int, direction: int) -> list[tuple[float, float, float, float, float, float, int]]:
    out: list[tuple[float, float, float, float, float, float, int]] = []
    col = float(seed_col)
    row = float(seed_row)
    previous_direction: tuple[float, float] | None = None
    for _ in range(MAX_STEPS):
        guide = velocity_grid_direction(field, col, row)
        if guide is None:
            break
        speed, dcol, drow = guide
        surf = sample_scalar_bilinear(field.surface, col, row)
        if not math.isfinite(surf):
            break
        if previous_direction is not None:
            dot = dcol * previous_direction[0] + drow * previous_direction[1]
            if dot < REVERSE_DIRECTION_DOT:
                break
        bed = sample_scalar_bilinear(field.bed, col, row)
        thickness = sample_scalar_bilinear(field.thickness, col, row)
        mask_val = int(
            field.mask[
                min(max(int(round(row)), 0), field.ny - 1),
                min(max(int(round(col)), 0), field.nx - 1),
            ]
        )
        out.append((col, row, speed, surf, bed, thickness, mask_val))

        half_step = STEP_CELLS * 0.5
        mid_col = col + direction * dcol * half_step
        mid_row = row + direction * drow * half_step
        mid_guide = velocity_grid_direction(field, mid_col, mid_row)
        next_guide = mid_guide or guide
        _, ndcol, ndrow = next_guide
        if previous_direction is not None:
            dot = ndcol * previous_direction[0] + ndrow * previous_direction[1]
            if dot < REVERSE_DIRECTION_DOT:
                break
        col += direction * ndcol * STEP_CELLS
        row += direction * ndrow * STEP_CELLS
        previous_direction = (ndcol, ndrow)
    return out


def collect_block_seeds(field: FieldData, target_count: int) -> list[tuple[int, int]]:
    seed_valid = field.ice_valid & field.velocity_valid & (field.speed >= MIN_SEED_SPEED)
    candidate_speed = np.where(seed_valid, field.speed, -np.inf)
    seed_spacing = max(8, round(math.sqrt((field.nx * field.ny) / (target_count / FLOWLINE_SEED_PASSES))))
    half_offset = max(1, seed_spacing // 2)
    seen: set[tuple[int, int]] = set()
    seeds: list[tuple[int, int]] = []
    print(f"Collecting block seeds with spacing {seed_spacing} cells ...")
    for pass_idx in range(FLOWLINE_SEED_PASSES):
        offset = 0 if pass_idx == 0 else half_offset
        row_start = 2 + offset
        col_start = 2 + offset
        for row_block in range(row_start, field.ny - 2, seed_spacing):
            row_end = min(field.ny - 2, row_block + seed_spacing)
            for col_block in range(col_start, field.nx - 2, seed_spacing):
                col_end = min(field.nx - 2, col_block + seed_spacing)
                block = candidate_speed[row_block:row_end, col_block:col_end]
                flat_index = int(np.argmax(block))
                best_speed = float(block.reshape(-1)[flat_index])
                if not math.isfinite(best_speed):
                    continue
                block_rows, block_cols = block.shape
                local_row, local_col = divmod(flat_index, block_cols)
                seed_row = row_block + local_row
                seed_col = col_block + local_col
                key = (seed_col, seed_row)
                if key in seen:
                    continue
                seen.add(key)
                seeds.append(key)
    print(f"  block seeds collected: {len(seeds)}")
    return seeds


def collect_anchor_seeds(
    field: FieldData,
    groups: list[dict[str, Any]],
    classify_seed: Any,
    seen: set[tuple[int, int]],
    radii: list[int],
    per_group_limit: int,
) -> list[tuple[int, int]]:
    seed_valid = field.ice_valid & field.velocity_valid & (field.speed >= MIN_SEED_SPEED)
    candidate_speed = np.where(seed_valid, field.speed, -np.inf)
    seeds: list[tuple[int, int]] = []
    print(f"Collecting anchor seeds for {len(groups)} groups ...")
    for group in groups:
        anchor_x, anchor_y = group["anchor_label_xy_m"]
        center_col = int(round((float(anchor_x) - field.x0) / field.dx))
        center_row = int(round((float(anchor_y) - field.y0) / field.dy))
        added = 0
        for radius in radii:
            row_min = max(2, center_row - radius)
            row_max = min(field.ny - 2, center_row + radius + 1)
            col_min = max(2, center_col - radius)
            col_max = min(field.nx - 2, center_col + radius + 1)
            if row_min >= row_max or col_min >= col_max:
                continue
            window = candidate_speed[row_min:row_max, col_min:col_max]
            valid_flat = np.flatnonzero(np.isfinite(window.reshape(-1)))
            if valid_flat.size == 0:
                continue
            top_n = min(12, valid_flat.size)
            top_idx = valid_flat[np.argpartition(window.reshape(-1)[valid_flat], -top_n)[-top_n:]]
            ordered = top_idx[np.argsort(window.reshape(-1)[top_idx])[::-1]]
            width = col_max - col_min
            for flat in ordered:
                local_row, local_col = divmod(int(flat), width)
                seed = (col_min + local_col, row_min + local_row)
                if seed in seen:
                    continue
                group_id, _ = classify_seed(*seed)
                if group_id != group["group_id"]:
                    continue
                seen.add(seed)
                seeds.append(seed)
                added += 1
                if added >= per_group_limit:
                    break
            if added >= per_group_limit:
                break
    print(f"  anchor seeds collected: {len(seeds)}")
    return seeds


def build_candidate(
    field: FieldData,
    group: dict[str, Any],
    refined_basin_name: str,
    seed_col: int,
    seed_row: int,
    spacing_km: float,
) -> Candidate | None:
    forward = trace_flowline_direction(field, seed_col, seed_row, 1)
    backward = trace_flowline_direction(field, seed_col, seed_row, -1)
    if not forward and not backward:
        return None

    if backward and forward:
        merged = backward[::-1] + forward[1:]
    elif backward:
        merged = backward[::-1]
    else:
        merged = forward
    if len(merged) < 5:
        return None

    cols = np.asarray([item[0] for item in merged], dtype=np.float32)
    rows = np.asarray([item[1] for item in merged], dtype=np.float32)
    speed = np.asarray([item[2] for item in merged], dtype=np.float32)
    surface = np.asarray([item[3] for item in merged], dtype=np.float32)
    bed = np.asarray([item[4] for item in merged], dtype=np.float32)
    thickness = np.asarray([item[5] for item in merged], dtype=np.float32)
    mask = np.asarray([item[6] for item in merged], dtype=np.uint8)

    seg_dx = np.diff(cols) * field.abs_dx
    seg_dy = np.diff(rows) * field.abs_dy
    cumulative_km = np.concatenate(
        [np.array([0.0], dtype=np.float32), np.cumsum(np.hypot(seg_dx, seg_dy) / 1000.0, dtype=np.float32)]
    )
    path_length_km = float(cumulative_km[-1])
    if path_length_km < MIN_PATH_LENGTH_KM:
        return None

    valid_geom = np.isfinite(bed) & np.isfinite(surface) & np.isfinite(thickness) & (mask >= 2)
    if float(np.mean(valid_geom)) < MIN_VALID_RATIO:
        return None

    max_segment_index = int(math.floor(path_length_km / spacing_km))
    if max_segment_index < int(MIN_PATH_LENGTH_KM / spacing_km):
        return None
    sampled_distance_km = np.arange(max_segment_index + 1, dtype=np.float32) * np.float32(spacing_km)
    sampled_cols = np.interp(sampled_distance_km, cumulative_km, cols).astype(np.float32)
    sampled_rows = np.interp(sampled_distance_km, cumulative_km, rows).astype(np.float32)
    sampled_speed = np.interp(sampled_distance_km, cumulative_km, speed).astype(np.float32)
    sampled_bed = np.interp(sampled_distance_km, cumulative_km, bed).astype(np.float32)
    sampled_surface = np.interp(sampled_distance_km, cumulative_km, surface).astype(np.float32)
    sampled_thickness = np.interp(sampled_distance_km, cumulative_km, thickness).astype(np.float32)
    sampled_mask = sample_mask_nearest(field.mask, sampled_cols, sampled_rows)
    sampled_x_m = (field.x0 + sampled_cols * field.dx).astype(np.float32)
    sampled_y_m = (field.y0 + sampled_rows * field.dy).astype(np.float32)

    if np.any(sampled_mask < 2):
        valid_idx = np.flatnonzero(sampled_mask >= 2)
        if valid_idx.size == 0:
            return None
        first_valid = int(valid_idx[0])
        last_valid = int(valid_idx[-1])
        sampled_distance_km = sampled_distance_km[first_valid : last_valid + 1] - sampled_distance_km[first_valid]
        sampled_cols = sampled_cols[first_valid : last_valid + 1]
        sampled_rows = sampled_rows[first_valid : last_valid + 1]
        sampled_speed = sampled_speed[first_valid : last_valid + 1]
        sampled_bed = sampled_bed[first_valid : last_valid + 1]
        sampled_surface = sampled_surface[first_valid : last_valid + 1]
        sampled_thickness = sampled_thickness[first_valid : last_valid + 1]
        sampled_mask = sampled_mask[first_valid : last_valid + 1]
        sampled_x_m = sampled_x_m[first_valid : last_valid + 1]
        sampled_y_m = sampled_y_m[first_valid : last_valid + 1]
        if sampled_distance_km.shape[0] < 2 or float(sampled_distance_km[-1]) < MIN_PATH_LENGTH_KM:
            return None
        if np.any(sampled_mask < 2):
            return None

    valid_sampled = (
        np.isfinite(sampled_bed)
        & np.isfinite(sampled_surface)
        & np.isfinite(sampled_thickness)
        & (sampled_mask >= 2)
    )
    if float(np.mean(valid_sampled)) < MIN_VALID_RATIO:
        return None

    quarter = max(1, sampled_bed.shape[0] // 4)
    start_mean = float(np.nanmean(sampled_bed[:quarter]))
    end_mean = float(np.nanmean(sampled_bed[-quarter:]))
    has_retrograde = end_mean > start_mean

    cell_keys = frozenset(
        zip(np.rint(sampled_cols).astype(int).tolist(), np.rint(sampled_rows).astype(int).tolist())
    )
    seed_x_m = field.x0 + seed_col * field.dx
    seed_y_m = field.y0 + seed_row * field.dy

    return Candidate(
        group_id=group["group_id"],
        group_name_en=group["group_name_en"],
        group_name_zh=group["group_name_zh"],
        region=group["region"],
        group_area_km2=float(group["total_area_km2"]),
        refined_basin_name=refined_basin_name,
        seed_col=seed_col,
        seed_row=seed_row,
        seed_x_m=float(seed_x_m),
        seed_y_m=float(seed_y_m),
        path_length_km=path_length_km,
        domain_length_km=float(sampled_distance_km[-1]),
        max_speed=float(np.nanmax(sampled_speed)),
        mean_speed=float(np.nanmean(sampled_speed)),
        min_bed=float(np.nanmin(sampled_bed)),
        max_thickness=float(np.nanmax(sampled_thickness)),
        start_surface=float(sampled_surface[0]),
        has_floating=bool(np.any(sampled_mask == 3)),
        has_retrograde=has_retrograde,
        trunk_score=float(np.nanmax(sampled_speed)) * math.sqrt(path_length_km),
        sampled_distance_km=sampled_distance_km,
        sampled_cols=sampled_cols,
        sampled_rows=sampled_rows,
        sampled_x_m=sampled_x_m,
        sampled_y_m=sampled_y_m,
        sampled_bed=sampled_bed,
        sampled_surface=sampled_surface,
        sampled_thickness=sampled_thickness,
        sampled_speed=sampled_speed,
        sampled_mask=sampled_mask,
        sampled_cell_keys=cell_keys,
    )


def candidate_sort_key(candidate: Candidate) -> tuple[float, float, float, float]:
    return (
        candidate.trunk_score,
        candidate.path_length_km,
        candidate.max_speed,
        candidate.start_surface,
    )


def normalize_metric(values: dict[str, float]) -> dict[str, float]:
    numbers = np.asarray(list(values.values()), dtype=np.float64)
    min_v = float(np.min(numbers))
    max_v = float(np.max(numbers))
    if math.isclose(min_v, max_v):
        return {key: 1.0 for key in values}
    return {key: (value - min_v) / (max_v - min_v) for key, value in values.items()}


def compute_group_importance(candidates_by_group: dict[str, list[Candidate]]) -> dict[str, float]:
    areas = {group_id: math.log1p(candidates[0].group_area_km2) for group_id, candidates in candidates_by_group.items()}
    speeds = {group_id: math.log1p(candidates[0].max_speed) for group_id, candidates in candidates_by_group.items()}
    lengths = {group_id: candidates[0].path_length_km for group_id, candidates in candidates_by_group.items()}
    area_norm = normalize_metric(areas)
    speed_norm = normalize_metric(speeds)
    length_norm = normalize_metric(lengths)
    importance = {}
    for group_id in candidates_by_group:
        importance[group_id] = 0.5 * area_norm[group_id] + 0.3 * speed_norm[group_id] + 0.2 * length_norm[group_id]
    return importance


def start_distance_m(a: Candidate, b: Candidate) -> float:
    return math.hypot(float(a.sampled_x_m[0] - b.sampled_x_m[0]), float(a.sampled_y_m[0] - b.sampled_y_m[0]))


def overlap_ratio(a: Candidate, b: Candidate) -> float:
    shorter = a.sampled_cell_keys if len(a.sampled_cell_keys) <= len(b.sampled_cell_keys) else b.sampled_cell_keys
    longer = b.sampled_cell_keys if shorter is a.sampled_cell_keys else a.sampled_cell_keys
    if not shorter:
        return 0.0
    return len(shorter & longer) / len(shorter)


def can_add_candidate(existing: list[Candidate], candidate: Candidate) -> bool:
    for other in existing:
        if start_distance_m(other, candidate) < MIN_START_DISTANCE_M:
            return False
        if overlap_ratio(other, candidate) > MAX_OVERLAP_RATIO:
            return False
    return True


def allocate_extras(
    candidates_by_group: dict[str, list[Candidate]],
    importance: dict[str, float],
    target_lines: int,
) -> dict[str, int]:
    base_count = len(candidates_by_group)
    if target_lines < base_count:
        raise RuntimeError(f"Target lines {target_lines} is smaller than group count {base_count}")

    extras_needed = target_lines - base_count
    allocation = {group_id: 0 for group_id in candidates_by_group}

    for group_id in PRIORITY_GROUP_IDS:
        if extras_needed <= 0:
            break
        if group_id in candidates_by_group and len(candidates_by_group[group_id]) > 1:
            allocation[group_id] += 1
            extras_needed -= 1

    if extras_needed <= 0:
        return allocation

    capacities = {
        group_id: max(0, len(candidates) - 1 - allocation[group_id])
        for group_id, candidates in candidates_by_group.items()
    }

    total_weight = sum(importance.values())
    raw = {
        group_id: (importance[group_id] / total_weight) * extras_needed if total_weight > 0 else 0.0
        for group_id in candidates_by_group
    }
    integer_alloc = {group_id: min(capacities[group_id], int(math.floor(raw[group_id]))) for group_id in candidates_by_group}
    for group_id, extra in integer_alloc.items():
        allocation[group_id] += extra
        capacities[group_id] -= extra
        extras_needed -= extra

    remainders = sorted(
        candidates_by_group,
        key=lambda group_id: (raw[group_id] - math.floor(raw[group_id]), importance[group_id]),
        reverse=True,
    )
    for group_id in remainders:
        if extras_needed <= 0:
            break
        if capacities[group_id] <= 0:
            continue
        allocation[group_id] += 1
        capacities[group_id] -= 1
        extras_needed -= 1

    if extras_needed > 0:
        for group_id in sorted(candidates_by_group, key=lambda item: importance[item], reverse=True):
            while extras_needed > 0 and capacities[group_id] > 0:
                allocation[group_id] += 1
                capacities[group_id] -= 1
                extras_needed -= 1
            if extras_needed <= 0:
                break

    if extras_needed > 0:
        raise RuntimeError(f"Unable to allocate {extras_needed} extra flowlines within candidate capacities.")

    return allocation


def select_final_candidates(
    groups: list[dict[str, Any]],
    candidates_by_group: dict[str, list[Candidate]],
    target_lines: int,
) -> dict[str, list[Candidate]]:
    importance = compute_group_importance(candidates_by_group)
    extra_targets = allocate_extras(candidates_by_group, importance, target_lines)

    selected: dict[str, list[Candidate]] = {}
    for group in groups:
        group_id = group["group_id"]
        candidates = candidates_by_group[group_id]
        picked = [candidates[0]]
        desired = 1 + extra_targets[group_id]
        for candidate in candidates[1:]:
            if len(picked) >= desired:
                break
            if can_add_candidate(picked, candidate):
                picked.append(candidate)
        selected[group_id] = picked

    selected_count = sum(len(items) for items in selected.values())
    if selected_count < target_lines:
        leftovers: list[tuple[float, float, Candidate]] = []
        for group_id, candidates in candidates_by_group.items():
            chosen_ids = {id(candidate) for candidate in selected[group_id]}
            for candidate in candidates:
                if id(candidate) in chosen_ids:
                    continue
                leftovers.append((importance[group_id], candidate.trunk_score, candidate))
        leftovers.sort(reverse=True, key=lambda item: (item[0], item[1]))
        for _, _, candidate in leftovers:
            if selected_count >= target_lines:
                break
            picked = selected[candidate.group_id]
            if can_add_candidate(picked, candidate):
                picked.append(candidate)
                selected_count += 1

    if selected_count != target_lines:
        raise RuntimeError(f"Expected {target_lines} selected flowlines, found {selected_count}")

    for group_id in PRIORITY_GROUP_IDS:
        if group_id in selected and len(selected[group_id]) < 2:
            raise RuntimeError(f"Priority basin {group_id} did not receive multiple flowlines.")

    return selected


def compute_sea_level_potential(candidate: Candidate) -> float:
    bed = candidate.sampled_bed.astype(np.float64)
    thickness = candidate.sampled_thickness.astype(np.float64)
    haf = np.where(bed >= 0.0, thickness, np.maximum(0.0, thickness + (RHO_WATER / RHO_ICE) * bed))
    grounded = candidate.sampled_mask == 2
    if np.any(grounded):
        mean_haf = float(np.mean(haf[grounded]))
    else:
        mean_haf = float(np.mean(haf))
    volume_m3 = candidate.group_area_km2 * 1_000_000.0 * mean_haf
    sle_m = volume_m3 * VOLUME_TO_SLE
    return round_float(max(0.01, sle_m), 2)


def build_names_and_descriptions(candidate: Candidate, line_index: int) -> tuple[str, str, str, str, list[str], list[str]]:
    name_en = f"{candidate.group_name_en} Flowline {line_index}"
    name_zh = f"{candidate.group_name_zh}流线 {line_index}"
    terminus_phrase_en = "terminus" if not candidate.has_floating else "floating terminus"
    terminus_phrase_zh = "末端" if not candidate.has_floating else "浮动末端"
    description_en = (
        f"Representative 2 km flowline for the {candidate.group_name_en} basin, spanning "
        f"about {round(candidate.domain_length_km)} km from the inland catchment to the {terminus_phrase_en}."
    )
    description_zh = (
        f"基于原始 BedMachine 与冰流速场提取的 {candidate.group_name_zh} 代表性 2 km 流线，"
        f"沿程约 {round(candidate.domain_length_km)} 公里，连接内陆汇流区与下游{terminus_phrase_zh}。"
    )
    fact_1_en = f"Peak observed flow speed along the line is about {round(candidate.max_speed)} m/yr."
    fact_1_zh = f"沿线最大观测流速约为每年 {round(candidate.max_speed)} 米。"
    fact_2_en = (
        f"Minimum bed elevation reaches {round(candidate.min_bed)} m and maximum ice thickness reaches "
        f"{round(candidate.max_thickness)} m."
    )
    fact_2_zh = (
        f"最低基岩高程约为 {round(candidate.min_bed)} 米，最大冰厚约为 {round(candidate.max_thickness)} 米。"
    )
    if candidate.has_floating:
        fact_3_en = "The extracted line includes a floating shelf section near the downstream end."
        fact_3_zh = "这条流线在下游末端包含浮冰架段。"
    elif candidate.has_retrograde:
        fact_3_en = "The bed profile shows a retrograde slope signature toward the interior catchment."
        fact_3_zh = "基岩剖面显示出向内陆加深的逆坡特征。"
    else:
        fact_3_en = "The line remains mostly grounded from the interior catchment to the terminus."
        fact_3_zh = "这条流线从内陆汇流区到末端大多保持接地状态。"
    return name_en, name_zh, description_en, description_zh, [fact_1_en, fact_2_en, fact_3_en], [fact_1_zh, fact_2_zh, fact_3_zh]


def simplify_path_lonlat(candidate: Candidate) -> list[list[float]]:
    point_count = candidate.sampled_x_m.shape[0]
    stride = max(1, point_count // 40)
    coords: list[list[float]] = []
    for index in range(0, point_count, stride):
        lon, lat = epsg3031_to_lonlat(float(candidate.sampled_x_m[index]), float(candidate.sampled_y_m[index]))
        coords.append([round_float(lon, 3), round_float(lat, 3)])
    if coords:
        last_lon, last_lat = epsg3031_to_lonlat(float(candidate.sampled_x_m[-1]), float(candidate.sampled_y_m[-1]))
        last_pair = [round_float(last_lon, 3), round_float(last_lat, 3)]
        if coords[-1] != last_pair:
            coords.append(last_pair)
    return coords


def write_outputs(
    selected: dict[str, list[Candidate]],
    groups: list[dict[str, Any]],
    templates_by_group: dict[str, TemplateMeta],
    output_dir: Path,
    spacing_km: float,
) -> list[dict[str, Any]]:
    scenarios_dir = output_dir / "scenarios" / "flowlines"
    scenarios_dir.mkdir(parents=True, exist_ok=True)
    for existing in scenarios_dir.glob("*.json"):
        existing.unlink()

    catalog: list[dict[str, Any]] = []
    for group in groups:
        group_id = group["group_id"]
        template = templates_by_group[group_id]
        for line_index, candidate in enumerate(selected[group_id], start=1):
            flowline_id = f"{group_id}-flowline-{line_index:02d}"
            name_en, name_zh, desc_en, desc_zh, facts_en, facts_zh = build_names_and_descriptions(candidate, line_index)
            region_en, region_zh = REGION_LABELS[candidate.region]
            location_en = template.location_en or f"{region_en}, {candidate.group_name_en} basin"
            location_zh = template.location_zh or f"{region_zh}，{candidate.group_name_zh}"
            sea_level_potential = compute_sea_level_potential(candidate)
            geometry_points = []
            for idx in range(candidate.sampled_distance_km.shape[0]):
                lon, lat = epsg3031_to_lonlat(float(candidate.sampled_x_m[idx]), float(candidate.sampled_y_m[idx]))
                geometry_points.append(
                    {
                        "distance_km": round_float(candidate.sampled_distance_km[idx], 3),
                        "x_m": round_float(candidate.sampled_x_m[idx], 1),
                        "y_m": round_float(candidate.sampled_y_m[idx], 1),
                        "lon": round_float(lon, 5),
                        "lat": round_float(lat, 5),
                        "bed_m": round_float(candidate.sampled_bed[idx], 1),
                        "surface_m": round_float(candidate.sampled_surface[idx], 1),
                        "thickness_m": round_float(max(0.0, float(candidate.sampled_thickness[idx])), 1),
                        "mask": int(candidate.sampled_mask[idx]),
                        "speed_m_per_yr": round_float(candidate.sampled_speed[idx], 2),
                    }
                )
            scenario = {
                "name": name_en,
                "name_zh": name_zh,
                "description_en": desc_en,
                "description_zh": desc_zh,
                "domain_length": round_float(candidate.domain_length_km, 3),
                "nx": int(candidate.sampled_distance_km.shape[0]),
                "T_atm_base": round_float(template.T_atm_base, 3),
                "T_ocean_base": round_float(template.T_ocean_base, 3),
                "P_snow_base": round_float(template.P_snow_base, 3),
                "enable_hydrology": bool(template.enable_hydrology),
                "bedrock": [int(round(value)) for value in candidate.sampled_bed.tolist()],
                "initial_H": [max(0, int(round(value))) for value in candidate.sampled_thickness.tolist()],
                "sea_level_potential": sea_level_potential,
                "geometry": {
                    "spacing_km": spacing_km,
                    "points": geometry_points,
                },
                "region_info": {
                    "name_en": name_en,
                    "name_zh": name_zh,
                    "location": location_en,
                    "sea_level_m": sea_level_potential,
                    "current_retreat_m_yr": round_float(candidate.max_speed, 1),
                    "key_facts_en": facts_en,
                    "key_facts_zh": facts_zh,
                },
            }
            (scenarios_dir / f"{flowline_id}.json").write_text(
                json.dumps(scenario, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            seed_lon, seed_lat = epsg3031_to_lonlat(candidate.seed_x_m, candidate.seed_y_m)
            catalog.append(
                {
                    "id": flowline_id,
                    "scenario": f"flowlines/{flowline_id}",
                    "name_en": name_en,
                    "name_zh": name_zh,
                    "description_en": desc_en,
                    "description_zh": desc_zh,
                    "region": candidate.region,
                    "basin": candidate.group_name_en,
                    "group_id": candidate.group_id,
                    "group_name_en": candidate.group_name_en,
                    "group_name_zh": candidate.group_name_zh,
                    "line_index": line_index,
                    "location_en": location_en,
                    "location_zh": location_zh,
                    "domain_length": round_float(candidate.domain_length_km, 3),
                    "max_speed": round_float(candidate.max_speed, 1),
                    "min_bed": round_float(candidate.min_bed, 1),
                    "max_thickness": round_float(candidate.max_thickness, 1),
                    "sea_level_potential": sea_level_potential,
                    "has_retrograde": candidate.has_retrograde,
                    "has_floating": candidate.has_floating,
                    "enable_hydrology": bool(template.enable_hydrology),
                    "seed_lonlat": [round_float(seed_lon, 5), round_float(seed_lat, 5)],
                    "path_lonlat": simplify_path_lonlat(candidate),
                    "color": REGION_COLORS.get(candidate.region, "#6b7280"),
                    "key_facts_en": facts_en,
                    "key_facts_zh": facts_zh,
                    "geometry_spacing_km": spacing_km,
                }
            )

    (output_dir / "flowline-catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return catalog


def validate_outputs(
    catalog: list[dict[str, Any]],
    groups: list[dict[str, Any]],
    output_dir: Path,
    target_lines: int,
    spacing_km: float,
) -> None:
    if len(catalog) != target_lines:
        raise RuntimeError(f"Expected {target_lines} catalog entries, found {len(catalog)}")
    unique_ids = {entry["id"] for entry in catalog}
    if len(unique_ids) != len(catalog):
        raise RuntimeError("Catalog contains duplicate ids.")

    expected_groups = {group["group_id"] for group in groups}
    covered_groups = {entry["group_id"] for entry in catalog}
    if covered_groups != expected_groups:
        missing = sorted(expected_groups - covered_groups)
        raise RuntimeError(f"Missing group coverage for: {missing}")

    region_set = {entry["region"] for entry in catalog}
    if region_set != {"west", "east", "peninsula"}:
        raise RuntimeError(f"Expected west/east/peninsula coverage, found {sorted(region_set)}")

    by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in catalog:
        by_group[entry["group_id"]].append(entry)
    for group_id in PRIORITY_GROUP_IDS:
        if len(by_group[group_id]) < 2:
            raise RuntimeError(f"Priority group {group_id} has fewer than 2 flowlines.")

    for entry in catalog:
        scenario_path = output_dir / "scenarios" / "flowlines" / f"{entry['id']}.json"
        scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
        geometry_points = scenario["geometry"]["points"]
        distances = np.asarray([point["distance_km"] for point in geometry_points], dtype=np.float64)
        if distances.shape[0] != scenario["nx"]:
            raise RuntimeError(f"{entry['id']}: nx does not match geometry point count")
        if len(scenario["bedrock"]) != scenario["nx"] or len(scenario["initial_H"]) != scenario["nx"]:
            raise RuntimeError(f"{entry['id']}: bedrock/initial_H lengths do not match nx")
        if not np.all(np.diff(distances) >= -1e-6):
            raise RuntimeError(f"{entry['id']}: geometry distances are not monotonic")
        if distances.shape[0] > 1:
            spacing = np.diff(distances)
            if not np.allclose(spacing, spacing_km, atol=1e-5):
                raise RuntimeError(f"{entry['id']}: geometry spacing is not {spacing_km} km")
        if not math.isclose(float(distances[-1]), float(scenario["domain_length"]), abs_tol=1e-5):
            raise RuntimeError(f"{entry['id']}: domain_length does not match geometry endpoint")
        thickness = np.asarray([point["thickness_m"] for point in geometry_points], dtype=np.float64)
        if np.any(thickness < -1e-6):
            raise RuntimeError(f"{entry['id']}: negative thickness encountered")
        masks = {int(point["mask"]) for point in geometry_points}
        if masks - {2, 3, 4}:
            raise RuntimeError(f"{entry['id']}: non-ice mask values present in geometry")


def main() -> None:
    args = parse_args()
    bedmachine_nc = Path(args.bedmachine_nc).expanduser().resolve()
    velocity_nc = Path(args.velocity_nc).expanduser().resolve()
    basins_json = Path(args.basins_json).expanduser().resolve()
    groups_json = DEFAULT_GROUPS_JSON.resolve()
    names_json = DEFAULT_NAMES_JSON.resolve()
    output_dir = (PROJECT_ROOT / args.output_dir).resolve() if not Path(args.output_dir).is_absolute() else Path(args.output_dir).resolve()

    ensure_exists(bedmachine_nc, "--bedmachine-nc")
    ensure_exists(velocity_nc, "--velocity-nc")
    ensure_exists(basins_json, "--basins-json")
    ensure_exists(groups_json, "major basin groups json")
    ensure_exists(names_json, "flowline names json")

    if not math.isclose(args.spacing_km, 2.0, abs_tol=1e-9):
        raise RuntimeError(f"This pipeline is fixed to 2 km geometry spacing; received {args.spacing_km}")

    groups, refined_to_group = load_major_groups(groups_json)
    group_by_id = {group["group_id"]: group for group in groups}
    basin_templates, region_templates = load_templates(names_json)
    templates_by_group = {
        group["group_id"]: match_template(group, basin_templates, region_templates)
        for group in groups
    }

    basins = load_refined_basins(basins_json)
    x, y, bed, surface, thickness, mask = load_bedmachine_grid(bedmachine_nc)
    vx, vy = resample_velocity_to_grid(velocity_nc, x, y)
    field = build_field(x, y, bed, surface, thickness, mask, vx, vy)

    classify_cache: dict[tuple[int, int], tuple[str | None, str | None]] = {}

    def classify_seed(seed_col: int, seed_row: int) -> tuple[str | None, str | None]:
        key = (seed_col, seed_row)
        cached = classify_cache.get(key)
        if cached is not None:
            return cached
        seed_x = field.x0 + seed_col * field.dx
        seed_y = field.y0 + seed_row * field.dy
        basin_name = classify_refined_basin(seed_x, seed_y, basins)
        group_id = refined_to_group.get(basin_name) if basin_name is not None else None
        classify_cache[key] = (group_id, basin_name)
        return classify_cache[key]

    block_seeds = collect_block_seeds(field, TARGET_CANDIDATE_COUNT)
    seen_seeds = set(block_seeds)
    anchor_seeds = collect_anchor_seeds(
        field,
        groups,
        classify_seed,
        seen_seeds,
        radii=[0, 10, 20, 40, 60, 90, 120, 160],
        per_group_limit=4,
    )
    all_seeds = anchor_seeds + block_seeds
    print(f"Tracing {len(all_seeds)} seeds ...")

    candidates_by_group: dict[str, list[Candidate]] = defaultdict(list)
    traced = 0
    kept = 0
    for seed_col, seed_row in all_seeds:
        group_id, refined_basin_name = classify_seed(seed_col, seed_row)
        if group_id is None or refined_basin_name is None:
            continue
        candidate = build_candidate(
            field,
            group_by_id[group_id],
            refined_basin_name,
            seed_col,
            seed_row,
            args.spacing_km,
        )
        traced += 1
        if candidate is None:
            continue
        candidates_by_group[group_id].append(candidate)
        kept += 1
        if traced % 500 == 0:
            print(f"  traced {traced} classified seeds; kept {kept} candidates")

    missing_groups = [group for group in groups if group["group_id"] not in candidates_by_group]
    if missing_groups:
        print(f"Missing candidates for {len(missing_groups)} groups after first pass; retrying targeted seeds ...")
        retry_seeds = collect_anchor_seeds(
            field,
            missing_groups,
            classify_seed,
            seen_seeds,
            radii=[200, 260, 320, 420, 520],
            per_group_limit=10,
        )
        for seed_col, seed_row in retry_seeds:
            group_id, refined_basin_name = classify_seed(seed_col, seed_row)
            if group_id is None or refined_basin_name is None:
                continue
            candidate = build_candidate(
                field,
                group_by_id[group_id],
                refined_basin_name,
                seed_col,
                seed_row,
                args.spacing_km,
            )
            if candidate is None:
                continue
            candidates_by_group[group_id].append(candidate)

    missing_groups = [group["group_id"] for group in groups if group["group_id"] not in candidates_by_group]
    if missing_groups:
        raise RuntimeError(f"No usable flowline candidates found for major groups: {missing_groups}")

    for group_id, candidates in candidates_by_group.items():
        candidates.sort(key=candidate_sort_key, reverse=True)
        unique: list[Candidate] = []
        seen_seed_coords: set[tuple[int, int]] = set()
        for candidate in candidates:
            key = (candidate.seed_col, candidate.seed_row)
            if key in seen_seed_coords:
                continue
            seen_seed_coords.add(key)
            unique.append(candidate)
        candidates_by_group[group_id] = unique

    selected = select_final_candidates(groups, candidates_by_group, args.target_lines)
    catalog = write_outputs(selected, groups, templates_by_group, output_dir, args.spacing_km)
    validate_outputs(catalog, groups, output_dir, args.target_lines, args.spacing_km)

    print(f"Wrote {len(catalog)} catalog entries to {output_dir / 'flowline-catalog.json'}")
    print(f"Wrote scenario files to {output_dir / 'scenarios' / 'flowlines'}")


if __name__ == "__main__":
    main()
