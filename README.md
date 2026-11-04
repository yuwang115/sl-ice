# SL-ICE

SL-ICE (Streamline Lab Interactive Cryosphere Explorer) is a React + TypeScript ice-sheet simulator with a 3D-ICE-based Explorer mode. The Explorer catalog and scenario files are generated from Antarctic flowlines under [`public/data/flowline-catalog.json`](public/data/flowline-catalog.json) and [`public/data/scenarios/flowlines`](public/data/scenarios/flowlines).

## Development

```bash
npm install
npm run dev
```

Checks (all run before a release):

```bash
npx tsc -b
npm run lint
npm test
npm run build
```

`npm run build` writes a self-contained static site to `dist/` (relative `base`, so it can be served from any sub-path such as `https://yuwang.blog/tools/sl-ice/`). Social-card tags (`og:url`, `og:image`, `twitter:image`) need absolute URLs; they are built from `SITE_URL`, which defaults to `https://yuwang.blog/tools/sl-ice`:

```bash
SITE_URL=https://example.org/sl-ice npm run build
```

Original high-resolution artwork lives in `design/branding/`; `public/` holds the web-sized copies.

## Physics engine (`src/engine/`)

A 2D flowline (x–σ) Blatter–Pattyn model solved in a Web Worker.

- **Momentum balance** — Picard iteration on the viscosity; each linear system is
  solved by banded Gaussian elimination without pivoting (`bandSolveNoPivot`),
  which is stable because every row is diagonally dominant. `bandSolve` keeps a
  general partial-pivoting solver with LAPACK-style fill-in storage.
- **Ice margins** — any ice column next to an ice-free cell (the domain end or a
  retreated calving front) gets the hydrostatic margin stress
  `(½ρᵢgH² − ½ρ_w gD²)/H` as a known longitudinal flux.
- **Basal friction** (`friction.ts`) — Budd-type law
  `τ_b = C · (N/N₀)^(1/3) · |u_b|^(1/3)` with `N₀ = ρᵢgH`, i.e. `u_b ∝ τ_b³/N`.
  `C` is a Weertman coefficient in Pa (m/yr)^(-1/3); the MISMIP value
  7.624e6 Pa m^(-1/3) s^(1/3) converts to ≈ 2.41e4 in yearly units.
- **Lateral drag** — floating ice feels a side-wall drag `−γ(x)·u`, standing in
  for the embayment buttressing a 2D flowline cannot resolve. Without it, shelves
  spread unconfined and shelf loss has no effect on the grounding line. Strong
  drag also stabilises grounding lines on retrograde beds, so `scenario_b_misi`
  uses a weaker `lateral_drag` (7e-4) to keep its overdeepening unstable.
- **Ice cliffs (MICI, opt-in)** (`cliff-calving.ts`) — the Schlemm & Levermann
  (2019) cliff-calving law `C = C₀·((F − F_c)/F_s)^s` (their Eqs. 23–27),
  evaluated at the calving front with its actual freeboard `F = H − D` and
  relative water depth `w = D/H`; the critical freeboard is raised by 60 m
  (Bassis & Walker 2012). A thin shelf front never reaches that height, so an
  intact shelf suppresses cliff failure.
- **Ocean melt** (`ocean-melt.ts`) — two-box PICO-style quadratic melt. The
  geoengineering curtain shields floating ice landward of `curtain_position`
  (between the grounding line and the barrier); placed under grounded ice it
  does nothing.
- **Inversion** (`inversion.ts`) — at load time `C(x)` (grounded ice) and `γ(x)`
  (floating ice) are iterated together until the modelled surface speed matches
  the observed speed in the scenario's geometry points. Scenarios without
  observations use `C_SLIDING` and `LATERAL_DRAG_DEFAULT` (override per scenario
  with a `lateral_drag` field; `0` = unconfined shelf).
- **Time stepping** — upwind mass transport with a CFL limit; the end-of-step
  velocity is reused by the next step unless the user changes parameters.
- **Events** — game events fire on threshold crossings (or once per cooldown
  window), not on every step. They read the grounding-line retreat rate
  smoothed over 5 model years: MISI starts above 200 m/yr on a retrograde bed
  and ends after a 50-year stall; hysteresis ("irreversible") needs the warming
  to have been reversed for 20 years while the retreat continues above 50 m/yr.

Engine tests live in `tests/engine/` and include analytic checks (unconfined
ice-shelf spreading rate, banded solvers vs dense elimination).

### Idealized scenarios

`scenario_a_stable`, `scenario_b_misi` and `scenario_c_shelf` (challenges and
sandbox) ship a spun-up `initial_H`: the steady state under default parameters.
After any physics change, regenerate them and re-run the tests:

```bash
npm run scenarios:spinup -- scenario_b_misi
```

The challenges are tuned against these steady states. `npm run challenges:check`
plays each challenge headlessly with reference strategies (no action, a timely
fix, a late or wrong one) and fails if any ends differently from what its
description and hints promise. Pass challenge ids to check only some of them
(`npm run challenges:check -- 2 5`).

## Raw-NC Flowline Generation

This repository includes a raw-data pipeline that rebuilds the Antarctic Explorer dataset from:

- `BedMachineAntarctica_V4.nc`
- the original Antarctic ice-velocity NetCDF
- `imbie_refined_basins_v2.json`

Python dependencies live in [`requirements-flowlines.txt`](requirements-flowlines.txt).

### Setup

```bash
python3 -m venv .venv-flowlines
source .venv-flowlines/bin/activate
pip install -r requirements-flowlines.txt
```

### Build the 70 major basin groups

```bash
npm run flowlines:build-groups
```

This writes [`scripts/major-basin-groups.json`](scripts/major-basin-groups.json).

### Generate the 100 flowlines

Replace the `<…>` placeholders with the locations of the source datasets on your machine.

```bash
source .venv-flowlines/bin/activate
python scripts/generate-antarctica-flowlines.py \
  --bedmachine-nc "<datasets>/BedMachineAntarctica_V4.nc" \
  --velocity-nc "<datasets>/antarctic_ice_vel_phase_map_v01_ErrorDel_inpaint_extend_slim_PIGmodified.nc" \
  --basins-json "<3d-ice>/static/tools/data/imbie_refined_basins_v2.json" \
  --target-lines 100 \
  --spacing-km 2 \
  --output-dir public/data
```

The generator:

- downsamples BedMachine from 500 m to a 2 km working grid
- resamples velocity onto the same EPSG:3031 grid
- traces candidate flowlines with bilinear velocity sampling
- guarantees coverage of 70 major basin groups
- exports 100 catalog entries and 100 scenario JSON files
- validates geometry spacing, group coverage, priority basins, and scenario consistency

### Outputs

- Catalog: [`public/data/flowline-catalog.json`](public/data/flowline-catalog.json)
- Scenarios: [`public/data/scenarios/flowlines`](public/data/scenarios/flowlines)

Each scenario now includes:

- explicit `nx`
- `bedrock` and `initial_H`
- `geometry.spacing_km = 2`
- per-point geometry with `distance_km`, `x_m`, `y_m`, `lon`, `lat`, `bed_m`, `surface_m`, `thickness_m`, `mask`, and `speed_m_per_yr`
