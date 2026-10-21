# Flanders land use tile map

Static square-tile map of dominant land use in Flanders, with a 2025 scrollytelling
story and a scroll-driven evolution view for 2013, 2016, 2022 and 2025.

## Data

Sources: `data/lu_landgebruik_vlaa_{year}_v3` rasters from Departement Omgeving,
Landgebruik Vlaanderen v3 (2025 published 2026). CRS: EPSG:31370. Native
resolution: 10 m. Sources are listed in `pipeline/config/years.json`.

The pipeline aggregates each raster into 2 km square tiles and assigns each
retained tile its raw dominant grouped land-use class. Edge tiles with less than
50% valid area are dropped. Tiles retained in every year form the common area
used by the evolution view. No area-share correction is applied yet.

## Run the pipeline

```sh
cd pipeline
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python build_tiles.py
```

This writes `frontend/public/data/evolution.json` plus backward-compatible
`tiles.json` and `stats.json` for the latest year.

Test the 1 km variant:

```sh
.venv/bin/python build_tiles.py --tile-size-m 1000 --output-dir /tmp/flanders_1km
```

## Run the frontend

```sh
cd frontend
npm install
npm run dev
```

Production build:

```sh
npm run build
```

## Deploy

The frontend is deployed on Vercel:

https://flanders-landuse.vercel.app

Redeploy with:

```sh
cd frontend
npx vercel --prod
```

## Current output

- 3,407 tiles at 2 km, retained in all four snapshots.
- 13,624.44 km² mapped.
- Nine grouped land-use classes.
- Raw dominant-class map only; largest-remainder correction is deferred.

## Views

The header switcher toggles between two views.

### 2025 scrollytelling

- intro map,
- one highlight step per land-use class,
- a regrouped waffle view of the same tiles,
- a closing step with the data table.

On the waffle view, block sizes show raw dominant tile counts, not true area
shares. The story states this explicitly; the largest-remainder correction is
still deferred.

### Evolution

Scroll through 2013 → 2016 → 2022 → 2025. The map crossfades each tile from its
previous dominant class to its new one, while true-area composition bars and the
largest net class shift update per year. Click a year pill to jump, or click a
class in the legend to isolate it on the map. Transition matrices
(`evolution.json`) supply the changed km² and tile counts.
