import json
from pathlib import Path

import numpy as np
import pytest

from build_tiles import apply_correction, largest_remainder, load_config, summarize_tile

CONFIG = Path(__file__).resolve().parents[1] / "config" / "landuse_classes.json"


def _scene(tiles, G=3):
    rows = max(t[0] for t in tiles) + 1
    cols = max(t[1] for t in tiles) + 1
    group_counts = np.zeros((rows, cols, G), dtype=np.int64)
    dominant = np.full((rows, cols), -1, dtype=np.int16)
    for r, c, counts, dom in tiles:
        group_counts[r, c] = counts
        dominant[r, c] = dom
    rows_idx, cols_idx = np.where(dominant >= 0)
    return group_counts, dominant, rows_idx, cols_idx


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


def test_largest_remainder_breaks_ties_stably():
    assert largest_remainder([2.5, 1.5, 1.0], 5).tolist() == [3, 1, 1]
    assert largest_remainder([1.2, 2.2, 0.6], 4).tolist() == [1, 2, 1]


def test_apply_correction_reassigns_lowest_margin_tiles():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [3, 2, 1], 0),
        (0, 1, [4, 2, 1], 0),
        (1, 0, [0, 4, 0], 1),
        (1, 1, [0, 3, 0], 1),
    ])
    targets = np.array([1, 2, 1])

    corrected, margins, reassignments = apply_correction(group_counts, dominant, rows_idx, cols_idx, targets)

    assert reassignments == [(0, 0, 0, 2, 1)]
    counts = np.bincount(corrected[rows_idx, cols_idx], minlength=3)
    assert counts.tolist() == [1, 2, 1]
    assert margins.tolist() == [1, 2, 4, 3]


def test_apply_correction_prefers_more_pixels_of_receiving_class_on_margin_ties():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [3, 2, 1], 0),
        (0, 1, [3, 1, 2], 0),
        (1, 0, [0, 4, 0], 1),
    ])
    targets = np.array([1, 1, 1])

    corrected, _, reassignments = apply_correction(group_counts, dominant, rows_idx, cols_idx, targets)

    assert reassignments == [(0, 1, 0, 2, 1)]
    counts = np.bincount(corrected[rows_idx, cols_idx], minlength=3)
    assert counts.tolist() == [1, 1, 1]


def test_apply_correction_breaks_full_ties_by_position():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [3, 1, 1], 0),
        (0, 1, [3, 1, 1], 0),
        (1, 0, [0, 4, 0], 1),
    ])
    targets = np.array([1, 1, 1])

    corrected, _, reassignments = apply_correction(group_counts, dominant, rows_idx, cols_idx, targets)

    assert reassignments == [(0, 0, 0, 2, 2)]
    counts = np.bincount(corrected[rows_idx, cols_idx], minlength=3)
    assert counts.tolist() == [1, 1, 1]


def test_apply_correction_prefers_previously_corrected_tiles():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [4, 1, 1], 0),
        (0, 1, [3, 2, 2], 0),
        (1, 0, [0, 4, 0], 1),
        (1, 1, [0, 3, 0], 1),
    ])
    previous = dominant.copy()
    previous[0, 0] = 2
    targets = np.array([1, 2, 1])

    corrected, _, reassignments = apply_correction(group_counts, dominant, rows_idx, cols_idx, targets, previous)

    assert reassignments == [(0, 0, 0, 2, 3)]
    counts = np.bincount(corrected[rows_idx, cols_idx], minlength=3)
    assert counts.tolist() == [1, 2, 1]


def test_apply_correction_anchor_requires_pixels_of_receiving_class():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [4, 2, 0], 0),
        (0, 1, [3, 3, 1], 0),
        (1, 0, [0, 4, 0], 1),
        (1, 1, [0, 3, 0], 1),
    ])
    previous = dominant.copy()
    previous[0, 0] = 2
    targets = np.array([1, 2, 1])

    corrected, _, reassignments = apply_correction(group_counts, dominant, rows_idx, cols_idx, targets, previous)

    assert reassignments == [(0, 1, 0, 2, 0)]
    counts = np.bincount(corrected[rows_idx, cols_idx], minlength=3)
    assert counts.tolist() == [1, 2, 1]


def test_apply_correction_is_noop_when_counts_match_targets():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [5, 1, 0], 0),
        (0, 1, [0, 4, 0], 1),
    ])
    targets = np.array([1, 1, 0])

    corrected, _, reassignments = apply_correction(group_counts, dominant, rows_idx, cols_idx, targets)

    assert reassignments == []
    assert np.array_equal(corrected, dominant)


def test_apply_correction_falls_back_when_no_surplus_tile_holds_deficit_class():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [3, 2, 0], 0),
        (0, 1, [0, 2, 1], 1),
        (1, 0, [0, 3, 0], 1),
    ])
    targets = np.array([2, 0, 1])

    corrected, _, reassignments = apply_correction(group_counts, dominant, rows_idx, cols_idx, targets)

    counts = np.bincount(corrected[rows_idx, cols_idx], minlength=3)
    assert counts.tolist() == [2, 0, 1]
    assert reassignments == [(0, 1, 1, 2, 1), (1, 0, 1, 0, 3)]


def test_apply_correction_rejects_inconsistent_targets():
    group_counts, dominant, rows_idx, cols_idx = _scene([
        (0, 0, [3, 2, 0], 0),
        (0, 1, [0, 4, 0], 1),
    ])

    with pytest.raises(ValueError):
        apply_correction(group_counts, dominant, rows_idx, cols_idx, np.array([1, 1, 1]))


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
    assert stats["correction"]["applied"] is True

    class_ids = {item["id"] for item in stats["classes"]}
    assert all(tile["class"] in class_ids for tile in tiles)
    assert all(tile["dominant_class"] in class_ids for tile in tiles)
    assert all(tile["margin"] >= 0 for tile in tiles)

    counts = {class_id: 0 for class_id in class_ids}
    for tile in tiles:
        counts[tile["class"]] += 1
    assert all(
        counts[item["id"]] == item["target_tile_count"]
        for item in stats["classes"]
    )
    assert sum(item["target_tile_count"] for item in stats["classes"]) == stats["retained_tiles"]
