export interface EvolutionClass {
  id: string
  nl: string
  en: string
  color: string
}

export interface EvolutionClassStat extends ClassStat {
  target_tile_count: number
}

export interface EvolutionYearStats {
  total_area_km2: number
  valid_pixel_count: number
  retained_tiles: number
  tile_size_m: number
  tile_area_km2: number
  classes: EvolutionClassStat[]
}

export interface EvolutionTransition {
  matrix_km2: number[][]
  changed_km2: number
  tile_changes: number
  net_changes: Record<string, { gained_km2: number; lost_km2: number }>
}

export interface EvolutionMapMeta {
  origin_x: number
  origin_y: number
  cols: number
  rows: number
  min_col: number
  max_col: number
  min_row: number
  max_row: number
}

export interface EvolutionData {
  years: number[]
  default_year: number
  tile_size_m: number
  tile_area_km2: number
  common_area_km2: number
  valid_pixel_count: number
  retained_tiles: number
  map: EvolutionMapMeta
  classes: EvolutionClass[]
  year_stats: Record<string, EvolutionYearStats>
  tiles: Array<{ id: string; col: number; row: number; classes: number[] }>
  transitions: Record<string, EvolutionTransition>
}

export interface ClassStat {
  id: string
  nl: string
  en: string
  color: string
  area_km2: number
  percent: number
  raw_tile_count: number
  target_tile_count: number
}

export type LandUseClass = ClassStat

export interface Stats extends StatsBase {
  classes: ClassStat[]
}

export interface StatsBase {
  source: string
  source_crs: string
  year: number
  tile_size_m: number
  tile_area_km2: number
  total_area_km2: number
  valid_pixel_count: number
  retained_tiles: number
  correction: { applied: boolean; method: string; reassigned_tiles?: number }
  map: MapMeta
}

export interface MapMeta {
  origin_x: number
  origin_y: number
  cols: number
  rows: number
  min_col: number
  max_col: number
  min_row: number
  max_row: number
}

export interface Tile {
  id: string
  col: number
  row: number
  class: string
  dominant_class: string
  margin: number
}

export interface MapData {
  stats: Stats
  tiles: Tile[]
}
