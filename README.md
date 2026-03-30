# SLICE

SLICE is a React + TypeScript ice-sheet simulator with a 3D-ICE-based Explorer mode. The Explorer catalog and scenario files are generated from Antarctic flowlines under [`public/data/flowline-catalog.json`](/Users/eddie/Documents/SLICE/public/data/flowline-catalog.json) and [`public/data/scenarios/flowlines`](/Users/eddie/Documents/SLICE/public/data/scenarios/flowlines).

## Development

```bash
npm install
npm run dev
```

## Raw-NC Flowline Generation

This repository includes a raw-data pipeline that rebuilds the Antarctic Explorer dataset from:

- `BedMachineAntarctica_V4.nc`
- the original Antarctic ice-velocity NetCDF
- `imbie_refined_basins_v2.json`

Python dependencies live in [`requirements-flowlines.txt`](/Users/eddie/Documents/SLICE/requirements-flowlines.txt).

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

This writes [`scripts/major-basin-groups.json`](/Users/eddie/Documents/SLICE/scripts/major-basin-groups.json).

### Generate the 100 flowlines

```bash
source .venv-flowlines/bin/activate
python scripts/generate-antarctica-flowlines.py \
  --bedmachine-nc "/Users/eddie/Library/CloudStorage/OneDrive-UniversityofTasmania/Documents/Antarctica_Dataset/BedMachineAntarctica_V4.nc" \
  --velocity-nc "/Users/eddie/Library/CloudStorage/OneDrive-UniversityofTasmania/Documents/Antarctica_Dataset/antarctic_ice_vel_phase_map_v01_ErrorDel_inpaint_extend_slim_PIGmodified.nc" \
  --basins-json "/Users/eddie/Documents/3d-ice/static/tools/data/imbie_refined_basins_v2.json" \
  --target-lines 100 \
  --spacing-km 2 \
  --output-dir "/Users/eddie/Documents/SLICE/public/data"
```

The generator:

- downsamples BedMachine from 500 m to a 2 km working grid
- resamples velocity onto the same EPSG:3031 grid
- traces candidate flowlines with bilinear velocity sampling
- guarantees coverage of 70 major basin groups
- exports 100 catalog entries and 100 scenario JSON files
- validates geometry spacing, group coverage, priority basins, and scenario consistency

### Outputs

- Catalog: [`public/data/flowline-catalog.json`](/Users/eddie/Documents/SLICE/public/data/flowline-catalog.json)
- Scenarios: [`public/data/scenarios/flowlines`](/Users/eddie/Documents/SLICE/public/data/scenarios/flowlines)

Each scenario now includes:

- explicit `nx`
- `bedrock` and `initial_H`
- `geometry.spacing_km = 2`
- per-point geometry with `distance_km`, `x_m`, `y_m`, `lon`, `lat`, `bed_m`, `surface_m`, `thickness_m`, `mask`, and `speed_m_per_yr`
