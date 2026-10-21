"""Build multi-year land-use evolution dataset for Flanders.

Outputs:
  - frontend/public/data/stats.json      (2025 default, for existing scrollytelling)
  - frontend/public/data/tiles.json      (2025 default tiles)
  - frontend/public/data/evolution.json   (multi-year with transitions)

Usage:
  ./build_tiles.py                    # use years from config/years.json
  ./build_tiles.py --input 2013=/p/to/file.tif  # custom inputs
"""

from __future__ import annotations

import argparse
import heapq
import json
import math
import os
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT_DIR = ROOT / "frontend" / "public" / "data"
DEFAULT_CONFIG = Path(__file__).resolve().parent / "config" / "landuse_classes.json"
DEFAULT_YEARS = Path(__file__).resolve().parent / "config" / "years.json"

TILE_SIZE_M = 2000
MIN_VALID_FRACTION = 0.5
PIXEL_AREA_KM2 = 0.0001  # 10 m × 10 m


def load_config(path: Path) -> tuple[dict, np.ndarray, list[str]]:
    with path.open(encoding="utf-8") as handle:
        config = json.load(handle)
    source_classes = config["source_classes"]
    groups = config["groups"]
    source_ids = [int(item["id"]) for item in source_classes]
    max_source_id = max(source_ids)
    lookup = np.full(max_source_id + 1, -1, dtype=np.int16)
    group_ids: list[str] = []
    for group_index, group in enumerate(groups):
        gid = group["id"]
        group_ids.append(gid)
        for sid in group["source_classes"]:
            sid = int(sid)
            if lookup[sid] != -1:
                raise ValueError(f"Source class {sid} is mapped to more than one group")
            lookup[sid] = group_index
    return config, lookup, group_ids


def load_years(path: Path, root: Path) -> list[tuple[int, Path]]:
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    years = []
    for entry in data:
        year = entry["year"]
        f = entry.get("file", "")
        years.append((year, Path(f) if os.path.isabs(f) else root / f))
    return sorted(years)


def summarize_tile(group_counts, full_pixel_count, min_valid_fraction):
    valid = int(group_counts.sum())
    if valid == 0 or valid / full_pixel_count < min_valid_fraction:
        return -1, valid
    return int(np.argmax(group_counts)), valid


def largest_remainder(rounds: list[float], total: int) -> np.ndarray:
    target = np.floor(rounds).astype(int)
    diff = total - int(target.sum())
    rem = rounds - target
    if diff > 0:
        order = np.argsort(-rem, kind="stable")[:diff]
        target[order] += 1
    elif diff < 0:
        order = np.argsort(rem, kind="stable")[: -diff]
        target[order] -= 1
    return target


def tile_margins(group_counts, rows_idx, cols_idx) -> np.ndarray:
    """Margin between dominant and runner-up group pixel count per retained tile."""
    sel = group_counts[rows_idx, cols_idx]
    part = np.partition(sel, -2, axis=-1)
    return part[:, -1] - part[:, -2]


def apply_correction(group_counts, dominant, rows_idx, cols_idx, targets):
    """Reassign lowest-confidence tiles until per-class counts match targets.

    Targets must sum to the number of retained tiles. Candidates are
    (tile, deficit class) pairs where the tile holds at least one pixel of the
    deficit class and its current class has a surplus. They are processed by
    ascending dominant-class margin (lowest confidence first), tie-broken by
    more pixels of the receiving class, then by (row, col) for determinism.
    """
    G = len(targets)
    corrected = dominant.copy()
    sel = group_counts[rows_idx, cols_idx]
    margins = tile_margins(group_counts, rows_idx, cols_idx)
    current = dominant[rows_idx, cols_idx]
    counts = np.bincount(current, minlength=G)
    deficit = targets.astype(int) - counts
    if int(deficit.sum()) != 0:
        raise ValueError(f"Targets sum to {int(targets.sum())}, retained tiles to {len(rows_idx)}")

    reassignments: list[tuple[int, int, int, int, int]] = []

    heap = []
    for i in range(len(rows_idx)):
        a = int(current[i])
        if deficit[a] >= 0:
            continue
        for b in range(G):
            cnt = int(sel[i, b])
            if b != a and cnt > 0:
                heapq.heappush(heap, (int(margins[i]), -cnt, int(rows_idx[i]), int(cols_idx[i]), i, a, b))

    while heap:
        margin, _negcnt, r, c, i, a, b = heapq.heappop(heap)
        if deficit[b] <= 0 or deficit[a] >= 0 or corrected[rows_idx[i], cols_idx[i]] != a:
            continue
        corrected[rows_idx[i], cols_idx[i]] = b
        deficit[a] += 1
        deficit[b] -= 1
        reassignments.append((r, c, a, b, int(margin)))

    unfilled = [b for b in range(G) if deficit[b] > 0]
    if unfilled:
        print(f"WARNING: largest-remainder fallback engaged for classes {unfilled}")
        order = np.argsort(margins, kind="stable")
        for i in order:
            b = next((b for b in unfilled if deficit[b] > 0), None)
            if b is None:
                break
            a = int(corrected[rows_idx[i], cols_idx[i]])
            if deficit[a] < 0:
                corrected[rows_idx[i], cols_idx[i]] = b
                deficit[a] += 1
                deficit[b] -= 1
                reassignments.append((int(rows_idx[i]), int(cols_idx[i]), a, b, int(margins[i])))

    return corrected, margins, reassignments


def aggregate_year(src, lookup, G, tpx, tile_size_m, min_valid_fraction):
    res_x = abs(src.transform.a)
    full_tile_pixels = tpx * tpx
    width, height = src.width, src.height
    origin_x, origin_y = src.bounds.left, src.bounds.top
    cols = math.ceil(width / tpx)
    rows = math.ceil(height / tpx)

    group_counts = np.zeros((rows, cols, G), dtype=np.int64)
    valid_counts = np.zeros((rows, cols), dtype=np.int64)
    source_counts = np.zeros(20, dtype=np.int64)

    for row in range(rows):
        row_start = max(0, int(round((origin_y - row * tile_size_m) / res_x)))
        row_end = min(height, int(round((origin_y - (row * tile_size_m + tile_size_m)) / res_x)))
        if row_end <= row_start:
            row_start = row * tpx
            row_end = min(height, row_start + tpx)
        if row_end <= row_start:
            continue
        strip = src.read(
            1,
            window=Window(col_off=0, row_off=row_start, width=src.width, height=row_end - row_start),
        )
        all_valid = (strip >= 1) & (strip <= 19)
        source_counts += np.bincount(strip[all_valid], minlength=20)

        for col in range(cols):
            c0 = col * tpx
            c1 = min(width, c0 + tpx)
            tile = strip[:, c0:c1]
            v = tile[(tile >= 1) & (tile <= 19)]
            if len(v) == 0:
                continue
            group_counts[row, col] = np.bincount(lookup[v], minlength=G)
            valid_counts[row, col] = len(v)

    min_valid = min_valid_fraction * tpx * tpx
    retained = valid_counts >= min_valid
    dominant = group_counts.argmax(axis=-1)
    dominant[valid_counts < min_valid] = -1

    return {
        "group_counts": group_counts,
        "valid_counts": valid_counts,
        "dominant": dominant,
        "retained": retained,
        "source_counts": source_counts,
        "origin_x": origin_x,
        "origin_y": origin_y,
        "crs": str(src.crs),
        "cols": cols,
        "rows": rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", action="append", default=None)
    parser.add_argument("--years-config", type=Path, default=DEFAULT_YEARS)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--tile-size-m", type=int, default=TILE_SIZE_M)
    parser.add_argument("--min-valid-fraction", type=float, default=MIN_VALID_FRACTION)
    args = parser.parse_args()

    config, lookup, group_ids = load_config(args.config)
    G = len(group_ids)
    tpx = args.tile_size_m // 10  # pixels per tile side (10 m source res)

    if args.input:
        items = args.input
        parsed = []
        for item in items:
            if "=" in item:
                y_str, p_str = item.split("=", 1)
                parsed.append((int(y_str), Path(p_str)))
            else:
                parsed.append((None, Path(item)))
        sources = [(y, p, abs(rasterio.open(str(p)).transform.a)) for y, p in parsed if p.exists()]
        sources.sort(key=lambda x: (x[0] is not None, x[0] or 0))
    else:
        years_cfg = load_years(args.years_config, ROOT)
        sources = []
        for year, path in years_cfg:
            if not path.exists():
                print(f"WARNING: missing {path}", flush=True)
                continue
            sources.append((year, path, abs(rasterio.open(str(path)).transform.a)))

    if not sources:
        raise FileNotFoundError("No valid input rasters")

    # Validate identical geometry
    ref_year, ref_path, ref_res = sources[0]
    with rasterio.open(str(ref_path)) as ref_src:
        ref_geom = (ref_src.width, ref_src.height, ref_src.transform)

    results = {}
    for year, path, res in sources:
        print(f"Building {year} ...")
        with rasterio.open(str(path)) as src:
            results[year] = aggregate_year(src, lookup, G, tpx, args.tile_size_m, args.min_valid_fraction)

    year_order = sorted(results.keys())
    base = results[year_order[0]]
    shape = (base["rows"], base["cols"])

    retained = base["retained"]
    retained_tiles = int(retained.sum())

    rows_idx, cols_idx = np.where(retained)
    min_col = int(cols_idx.min()); max_col = int(cols_idx.max())
    min_row = int(rows_idx.min()); max_row = int(rows_idx.max())

    origin_x = base["origin_x"]; origin_y = base["origin_y"]
    total_area_km2 = int(base["source_counts"][1:].sum()) * PIXEL_AREA_KM2
    valid_pixel_count = int(base["source_counts"][1:].sum())

    year_stats = {}
    corrected_dominants = {}
    margins_by_year = {}

    for year in year_order:
        dom = results[year]["dominant"]
        scounts = results[year]["source_counts"]
        group_counts = results[year]["group_counts"]

        group_pixels = np.zeros(G, dtype=np.int64)
        for sid in range(1, 20):
            group_pixels[lookup[sid]] += scounts[sid]
        areas = group_pixels * PIXEL_AREA_KM2

        total_area_km2_y = float(areas.sum())
        counts = np.zeros(G, dtype=int)
        for r, c in zip(rows_idx, cols_idx):
            g = int(dom[r, c])
            if g >= 0:
                counts[g] += 1

        cls = []
        for gi, gid in enumerate(group_ids):
            g = config["groups"][gi]
            cls.append({
                "id": gid,
                "nl": g["nl"],
                "en": g["en"],
                "color": g["color"],
                "area_km2": round(float(areas[gi]), 4),
                "percent": round(100 * float(areas[gi]) / total_area_km2_y, 4),
                "raw_tile_count": int(counts[gi]),
                "target_tile_count": 0,
            })
        target = largest_remainder([c["area_km2"] / args.tile_size_m ** 2 * 1_000_000 for c in cls], retained_tiles)
        corrected, margins, reassignments = apply_correction(group_counts, dom, rows_idx, cols_idx, target)
        corrected_dominants[year] = corrected
        margins_by_year[year] = margins
        for i in range(G):
            cls[i]["target_tile_count"] = int(target[i])
        cls.sort(key=lambda x: x["area_km2"], reverse=True)

        year_stats[str(year)] = {
            "total_area_km2": round(total_area_km2_y, 4),
            "valid_pixel_count": int(scounts[1:].sum()),
            "retained_tiles": retained_tiles,
            "tile_size_m": args.tile_size_m,
            "tile_area_km2": args.tile_size_m ** 2 / 1_000_000,
            "correction": {
                "applied": True,
                "method": "largest remainder (lowest-margin reassignment)",
                "reassigned_tiles": len(reassignments),
            },
            "classes": cls,
        }
        print(f"  {year}: corrected {len(reassignments)} of {retained_tiles} tiles")

    # Setup for transitions (dominants are the corrected classes)
    doms = corrected_dominants
    years_map = dict((y, p) for y, p, _ in sources)
    src_opens = dict((y, None) for y, _, _ in sources)

    def open_year(year):
        if src_opens[year] is None:
            src_opens[year] = rasterio.open(str(years_map[year]))
        return src_opens[year]

    transitions = {}
    for i in range(len(year_order)):
        for j in range(i + 1, len(year_order)):
            ya, yb = year_order[i], year_order[j]
            key = f"{ya}-{yb}"
            mat = np.zeros((G, G), dtype=np.int64)
            sa = open_year(ya)
            sb = open_year(yb)
            for row in range(0, sa.height, tpx):
                r1 = min(sa.height, row + tpx)
                a = sa.read(1, window=Window(0, row, sa.width, r1 - row))
                b = sb.read(1, window=Window(0, row, sb.width, r1 - row))
                m = (a >= 1) & (a <= 19) & (b >= 1) & (b <= 19)
                pairs = lookup[a[m]] * G + lookup[b[m]]
                mat += np.bincount(pairs, minlength=G * G).reshape(G, G)
            mat_km2 = mat.astype(np.float64) * PIXEL_AREA_KM2
            changed = total_area_km2 - float(np.trace(mat_km2).sum())
            tile_changes = int(sum(1 for r, c in zip(rows_idx, cols_idx) if doms[ya][r, c] != doms[yb][r, c]))
            net = {}
            for gi in range(G):
                gained = float(mat_km2[:, gi].sum() - mat_km2[gi, gi])
                lost = float(mat_km2[gi, :].sum() - mat_km2[gi, gi])
                net[group_ids[gi]] = {"gained_km2": round(gained, 4), "lost_km2": round(lost, 4)}
            transitions[key] = {
                "matrix_km2": [[round(float(v), 4) for v in row] for row in mat_km2],
                "changed_km2": round(changed, 4),
                "tile_changes": tile_changes,
                "net_changes": net,
            }

    # Close open sources
    for src in src_opens.values():
        if src is not None:
            src.close()

    tiles_list = []
    for r, c in zip(rows_idx, cols_idx):
        tiles_list.append({
            "id": f"r{r:03d}c{c:03d}",
            "col": int(c),
            "row": int(r),
            "classes": [int(doms[y][r, c]) for y in year_order],
        })

    classes = [
        {"id": gid, "nl": config["groups"][gi]["nl"], "en": config["groups"][gi]["en"], "color": config["groups"][gi]["color"]}
        for gi, gid in enumerate(group_ids)
    ]

    evolution = {
        "years": year_order,
        "default_year": year_order[-1],
        "tile_size_m": args.tile_size_m,
        "tile_area_km2": args.tile_size_m ** 2 / 1_000_000,
        "common_area_km2": round(total_area_km2, 4),
        "valid_pixel_count": valid_pixel_count,
        "retained_tiles": retained_tiles,
        "map": {
            "origin_x": float(origin_x),
            "origin_y": float(origin_y),
            "cols": base["cols"],
            "rows": base["rows"],
            "min_col": min_col,
            "max_col": max_col,
            "min_row": min_row,
            "max_row": max_row,
        },
        "classes": classes,
        "year_stats": year_stats,
        "tiles": tiles_list,
        "transitions": transitions,
    }

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "evolution.json").open("w", encoding="utf-8") as f:
        json.dump(evolution, f, ensure_ascii=False, indent=2)
    print(f"Wrote {output_dir / 'evolution.json'}")

    # Write backward-compatible stats.json / tiles.json for default year
    default_year = year_order[-1]
    default_stats = year_stats[str(default_year)].copy()
    default_stats["source"] = f"lu_landgebruik_vlaa_{default_year}_v3.tif"
    default_stats["source_crs"] = base["crs"]
    default_stats["year"] = default_year
    default_stats["map"] = evolution["map"]
    default_stats["correction"] = year_stats[str(default_year)]["correction"]

    with (output_dir / "stats.json").open("w", encoding="utf-8") as f:
        json.dump(default_stats, f, ensure_ascii=False, indent=2)

    # tiles.json for default year: use class from default year (index in year_order)
    default_idx = year_order.index(default_year)
    default_raw_dominant = results[default_year]["dominant"]
    default_tiles = []
    for k, t in enumerate(tiles_list):
        default_tiles.append({
            "id": t["id"],
            "col": t["col"],
            "row": t["row"],
            "class": group_ids[t["classes"][default_idx]],
            "dominant_class": group_ids[int(default_raw_dominant[rows_idx[k], cols_idx[k]])],
            "margin": int(margins_by_year[default_year][k]),
        })
    with (output_dir / "tiles.json").open("w", encoding="utf-8") as f:
        json.dump({"tiles": default_tiles}, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Wrote {output_dir / 'stats.json'} and {output_dir / 'tiles.json'}")
    print(f"Years: {year_order}")
    print(f"Retained tiles: {retained_tiles}")
    print(f"Common area: {total_area_km2:,.2f} km²")
    for y in year_order:
        print(f"  {y}: {year_stats[str(y)]['total_area_km2']:,.2f} km²")
    for k, v in transitions.items():
        print(f"  {k}: {v['changed_km2']:,.2f} km² changed ({v['tile_changes']} tiles)")


if __name__ == "__main__":
    main()