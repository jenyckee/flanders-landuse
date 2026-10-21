# Flanders land use tile map

Static square-tile map of dominant land use in Flanders, 2025.

## Data

Source: `lu_landgebruik_vlaa_2025_v3.tiff` from Departement Omgeving,
Landgebruik Vlaanderen 2025 v3. CRS: EPSG:31370. Native resolution: 10 m.

The pipeline aggregates the raster into 2 km square tiles and assigns each
retained tile its raw dominant grouped land-use class. Edge tiles with less than
50% valid area are dropped. No area-share correction is applied yet.

## Run the pipeline

```sh
cd pipeline
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python build_tiles.py
```

This writes `frontend/public/data/tiles.json` and `stats.json`.

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

- 3,407 tiles at 2 km.
- 13,624.44 km² mapped.
- Nine grouped land-use classes.
- Raw dominant-class map only; largest-remainder correction and scrollytelling
  are deferred.
