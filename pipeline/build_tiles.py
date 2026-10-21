"""Build a square-tile land-use map for Flanders.

The source raster is aggregated into square tiles in EPSG:31370. Each retained
tile is assigned the grouped land-use class with the most valid source pixels.
No largest-remainder correction is applied in this milestone.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "lu_landgebruik_vlaa_2025_v3.tiff"
DEFAULT_OUTPUT_DIR = ROOT / "frontend" / "public" / "data"
DEFAULT_CONFIG = Path(__file__).resolve().parent / "config" / "landuse_classes.json"

TILE_SIZE_M = 2000
MIN_VALID_FRACTION = 0.5


def load_config(path: Path) -> tuple[dict, np.ndarray, list[str]]:
    with path.open(encoding="utf-8") as handle:
        config = json.load(handle)

    source_classes = config["source_classes"]
    groups = config["groups"]

    source_ids = [int(item["id"]) for item in source_classes]
    if len(source_ids) != len(set(source_ids)):
        raise ValueError("Duplicate source class IDs in config")

    max_source_id = max(source_ids)
    lookup = np.full(max_source_id + 1, -1, dtype=np.int16)
    group_ids: list[str] = []
    seen_groups: set[str] = set()

    for group_index, group in enumerate(groups):
        group_id = group["id"]
        if group_id in seen_groups:
            raise ValueError(f"Duplicate group ID: {group_id}")
        seen_groups.add(group_id)
        group_ids.append(group_id)

        for source_id in group["source_classes"]:
            source_id = int(source_id)
            if source_id < 1 or source_id > max_source_id:
                raise ValueError(f"Source class {source_id} is out of range")
            if lookup[source_id] != -1:
                raise ValueError(
                    f"Source class {source_id} is mapped to more than one group"
                )
            lookup[source_id] = group_index

    unmapped = [
        source_id
        for source_id in source_ids
        if lookup[source_id] == -1
    ]
    if unmapped:
        raise ValueError(f"Unmapped source classes: {unmapped}")

    return config, lookup, group_ids


def summarize_tile(
    group_counts: np.ndarray,
    full_pixel_count: int,
    min_valid_fraction: float,
) -> tuple[int, int]:
    """Return (dominant group index, valid pixel count), or (-1, 0)."""
    valid_count = int(group_counts.sum())
    if valid_count == 0 or valid_count / full_pixel_count < min_valid_fraction:
        return -1, valid_count
    return int(np.argmax(group_counts)), valid_count


def build_tiles(
    input_path: Path,
    output_dir: Path,
    config_path: Path,
    tile_size_m: int,
    min_valid_fraction: float,
) -> dict:
    config, lookup, group_ids = load_config(config_path)
    group_count = len(group_ids)

    with rasterio.open(input_path) as src:
        if src.crs is None or src.crs.to_epsg() != 31370:
            raise ValueError(f"Expected EPSG:31370, found {src.crs}")

        transform = src.transform
        res_x = abs(transform.a)
        res_y = abs(transform.e)
        pixel_area_km2 = (res_x * res_y) / 1_000_000

        tile_px_x = tile_size_m / res_x
        tile_px_y = tile_size_m / res_y
        if not math.isclose(tile_px_x, round(tile_px_x), abs_tol=1e-6):
            raise ValueError("Tile size must be a whole number of pixels in x")
        if not math.isclose(tile_px_y, round(tile_px_y), abs_tol=1e-6):
            raise ValueError("Tile size must be a whole number of pixels in y")
        tile_px_x = int(round(tile_px_x))
        tile_px_y = int(round(tile_px_y))
        if tile_px_x != tile_px_y:
            raise ValueError("Source pixels must be square")

        full_tile_pixels = tile_px_x * tile_px_y
        origin_x = src.bounds.left
        origin_y = src.bounds.top
        cols = math.ceil(src.width / tile_px_x)
        rows = math.ceil(src.height / tile_px_y)

        source_pixel_counts = np.zeros(20, dtype=np.int64)
        raw_group_counts = np.zeros(group_count, dtype=np.int64)
        tiles: list[dict] = []
        retained = 0

        for row in range(rows):
            row_top_m = origin_y - row * tile_size_m
            row_bottom_m = row_top_m - tile_size_m
            row_start = max(
                0, int(round((origin_y - row_top_m) / res_y))
            )
            row_end = min(
                src.height,
                int(round((origin_y - row_bottom_m) / res_y)),
            )
            if row_end <= row_start:
                continue

            strip = src.read(
                1,
                window=Window(
                    col_off=0,
                    row_off=row_start,
                    width=src.width,
                    height=row_end - row_start,
                ),
            )
            valid_strip = (strip >= 1) & (strip <= 19)
            source_pixel_counts += np.bincount(
                strip[valid_strip], minlength=20
            )

            for col in range(cols):
                col_start = col * tile_px_x
                if col_start >= src.width:
                    continue
                col_end = min(src.width, col_start + tile_px_x)
                tile_pixels = strip[:, col_start:col_end]
                valid_mask = (tile_pixels >= 1) & (tile_pixels <= 19)
                valid_values = tile_pixels[valid_mask]

                group_counts = np.bincount(
                    lookup[valid_values], minlength=group_count
                )
                dominant_index, valid_count = summarize_tile(
                    group_counts, full_tile_pixels, min_valid_fraction
                )
                if dominant_index < 0:
                    continue

                retained += 1
                raw_group_counts[dominant_index] += 1
                tiles.append(
                    {
                        "id": f"r{row:03d}c{col:03d}",
                        "col": col,
                        "row": row,
                        "class": group_ids[dominant_index],
                    }
                )

    total_pixels = int(source_pixel_counts.sum())
    total_area_km2 = total_pixels * pixel_area_km2

    source_class_areas = {
        int(source_id): float(count * pixel_area_km2)
        for source_id, count in enumerate(source_pixel_counts)
        if source_id > 0
    }

    group_area_by_id = {
        group["id"]: sum(
            source_class_areas[int(source_id)]
            for source_id in group["source_classes"]
        )
        for group in config["groups"]
    }

    classes = []
    for group_index, group in enumerate(config["groups"]):
        area_km2 = group_area_by_id[group["id"]]
        classes.append(
            {
                "id": group["id"],
                "nl": group["nl"],
                "en": group["en"],
                "color": group["color"],
                "area_km2": round(area_km2, 4),
                "percent": round(100 * area_km2 / total_area_km2, 4),
                "raw_tile_count": int(raw_group_counts[group_index]),
            }
        )
    classes.sort(key=lambda item: item["area_km2"], reverse=True)

    stats = {
        "source": input_path.name,
        "source_crs": "EPSG:31370",
        "year": 2025,
        "tile_size_m": tile_size_m,
        "tile_area_km2": round(tile_size_m * tile_size_m / 1_000_000, 4),
        "total_area_km2": round(total_area_km2, 4),
        "valid_pixel_count": total_pixels,
        "retained_tiles": retained,
        "correction": {
            "applied": False,
            "method": "raw dominant class",
        },
        "map": {
            "origin_x": float(origin_x),
            "origin_y": float(origin_y),
            "cols": cols,
            "rows": rows,
            "min_col": min(tile["col"] for tile in tiles),
            "max_col": max(tile["col"] for tile in tiles),
            "min_row": min(tile["row"] for tile in tiles),
            "max_row": max(tile["row"] for tile in tiles),
        },
        "classes": classes,
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "tiles.json").open("w", encoding="utf-8") as handle:
        json.dump({"tiles": tiles}, handle, ensure_ascii=False, separators=(",", ":"))
    with (output_dir / "stats.json").open("w", encoding="utf-8") as handle:
        json.dump(stats, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--tile-size-m", type=int, default=TILE_SIZE_M)
    parser.add_argument(
        "--min-valid-fraction", type=float, default=MIN_VALID_FRACTION
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    stats = build_tiles(
        input_path=args.input,
        output_dir=args.output_dir,
        config_path=args.config,
        tile_size_m=args.tile_size_m,
        min_valid_fraction=args.min_valid_fraction,
    )

    print(
        f"Wrote {stats['retained_tiles']:,} tiles at "
        f"{stats['tile_size_m'] / 1000:g} km to {args.output_dir}"
    )
    print(f"Total valid area: {stats['total_area_km2']:,.2f} km²")
    for item in stats["classes"]:
        print(
            f"  {item['en']:<30} {item['area_km2']:>10,.2f} km² "
            f"{item['percent']:>6.2f}%  {item['raw_tile_count']:>5,} tiles"
        )


if __name__ == "__main__":
    main()
