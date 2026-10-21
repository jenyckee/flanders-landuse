# Flanders land-use tile pipeline

Aggregates the Landgebruik Vlaanderen v3 rasters (2013, 2016, 2022, 2025) into
equal-area square tiles in EPSG:31370. Source paths live in `config/years.json`.
Each retained tile gets its raw dominant grouped land-use class per year.

## Setup

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Build multi-year tiles

```sh
.venv/bin/python build_tiles.py
```

Outputs:

- `frontend/public/data/evolution.json`: years, per-year class stats, per-tile
  dominant class per year, and pairwise transition matrices.
- `frontend/public/data/tiles.json` and `stats.json`: backward-compatible
  latest-year files used by the 2025 scrollytelling view.

Pass `--years-config path/to/years.json` to build a different set of years, or
repeat `--input year=path` to override sources.

## Test 1 km tiles

```sh
.venv/bin/python build_tiles.py --tile-size-m 1000 --output-dir /tmp/flanders_1km
```

The production map uses 2 km tiles. The 1 km build is a detail/performance test.

## Rules

- Tiles are square and aligned to the source raster's upper-left corner.
- Tiles with less than 50% valid source area are dropped.
- Source classes are grouped in `config/landuse_classes.json`.
- The tile class is the group with the largest valid-pixel count.
- No largest-remainder correction is applied yet.
