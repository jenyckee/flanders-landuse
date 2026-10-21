import json
from pathlib import Path

import numpy as np

from build_tiles import load_config, summarize_tile

CONFIG = Path(__file__).resolve().parents[1] / "config" / "landuse_classes.json"


def test_config_maps_every_source_class_exactly_once():
    config, lookup, group_ids = load_config(CONFIG)
    source_ids = [int(item["id"]) for item in config["source_classes"]]

    assert len(group_ids) == 9
    assert lookup[0] == -1
    for source_id in source_ids:
        assert lookup[source_id] >= 0
    for source_id in range(1, 20):
        assert lookup[source_id] >= 0


def test_summarize_tile_assigns_largest_group():
    counts = np.array([20, 40, 0, 0, 0, 0, 0, 0, 0])
    dominant, valid = summarize_tile(counts, full_pixel_count=100, min_valid_fraction=0.5)
    assert dominant == 1
    assert valid == 60


def test_summarize_tile_drops_tile_below_threshold():
    counts = np.array([20, 40, 0, 0, 0, 0, 0, 0, 0])
    dominant, valid = summarize_tile(counts, full_pixel_count=100, min_valid_fraction=0.5)
    assert valid == 60
    assert dominant == 1

    dominant, _ = summarize_tile(counts, full_pixel_count=100, min_valid_fraction=0.75)
    assert dominant == -1


def test_stats_output_is_consistent():
    stats_path = Path(__file__).resolve().parents[2] / "frontend" / "public" / "data" / "stats.json"
    tiles_path = stats_path.with_name("tiles.json")
    if not stats_path.exists() or not tiles_path.exists():
        return

    stats = json.loads(stats_path.read_text(encoding="utf-8"))
    tiles = json.loads(tiles_path.read_text(encoding="utf-8"))["tiles"]

    assert len(tiles) == stats["retained_tiles"]
    assert len({tile["id"] for tile in tiles}) == len(tiles)
    assert abs(sum(item["percent"] for item in stats["classes"]) - 100) < 0.01
    assert abs(sum(item["area_km2"] for item in stats["classes"]) - stats["total_area_km2"]) < 0.01

    class_ids = {item["id"] for item in stats["classes"]}
    assert all(tile["class"] in class_ids for tile in tiles)

    counts = {class_id: 0 for class_id in class_ids}
    for tile in tiles:
        counts[tile["class"]] += 1
    assert all(
        counts[item["id"]] == item["raw_tile_count"]
        for item in stats["classes"]
    )
