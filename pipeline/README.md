# Flanders land-use tile pipeline

Aggregates `lu_landgebruik_vlaa_2025_v3.tiff` into equal-area square tiles in
EPSG:31370. This milestone assigns each retained tile its raw dominant grouped
land-use class.

## Setup

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Build 2 km tiles

```sh
.venv/bin/python build_tiles.py
```

Outputs `frontend/public/data/tiles.json` and `frontend/public/data/stats.json`.

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
