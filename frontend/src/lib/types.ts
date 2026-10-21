export interface LandUseClass {
  id: string
  nl: string
  en: string
  color: string
  area_km2: number
  percent: number
  raw_tile_count: number
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

export interface Stats {
  source: string
  source_crs: string
  year: number
  tile_size_m: number
  tile_area_km2: number
  total_area_km2: number
  valid_pixel_count: number
  retained_tiles: number
  correction: {
    applied: boolean
    method: string
  }
  map: MapMeta
  classes: LandUseClass[]
}

export interface Tile {
  id: string
  col: number
  row: number
  class: string
}

export interface MapData {
  stats: Stats
  tiles: Tile[]
}
