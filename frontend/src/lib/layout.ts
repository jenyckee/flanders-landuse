import type { LandUseClass, Stats, Tile } from './types'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface TilePosition {
  x: number
  y: number
  size: number
}

export interface MapLayout {
  positions: TilePosition[]
  pitch: number
}

export interface WaffleBlock {
  id: string
  color: string
  nl: string
  en: string
  shortLabel: string
  count: number
  tileShare: number
  x: number
  y: number
  width: number
  height: number
  labelHeight: number
}

export interface WaffleLayout {
  positions: TilePosition[]
  blocks: WaffleBlock[]
  pitch: number
}

interface GridSize {
  cols: number
  rows: number
}

interface GroupBucket {
  item: LandUseClass
  tileIndices: number[]
  grid: GridSize
}

interface PlacedBlock extends GroupBucket {
  x: number
  y: number
  width: number
  height: number
  labelHeight: number
}

interface Shelf {
  blocks: PlacedBlock[]
  width: number
  height: number
}

export function shortLabel(label: string): string {
  return label.split(/[,&]/)[0].trim()
}

function chooseGrid(n: number): GridSize {
  let best: GridSize = { cols: Math.ceil(Math.sqrt(n)), rows: Math.ceil(n / Math.ceil(Math.sqrt(n))) }
  let bestScore = Number.POSITIVE_INFINITY
  const maxCols = Math.max(1, Math.ceil(Math.sqrt(n * 3)))

  for (let cols = 1; cols <= maxCols; cols += 1) {
    const rows = Math.ceil(n / cols)
    const waste = cols * rows - n
    const aspectPenalty = Math.abs(Math.log(cols / rows)) * Math.min(n, 400) * 0.08
    const score = waste * 2 + aspectPenalty
    if (score < bestScore) {
      bestScore = score
      best = { cols, rows }
    }
  }

  return best
}

export function computeMapLayout(
  tiles: Tile[],
  stats: Stats,
  box: Box,
  padding = 20,
): MapLayout {
  const spanCols = stats.map.max_col - stats.map.min_col + 1
  const spanRows = stats.map.max_row - stats.map.min_row + 1
  const usableWidth = Math.max(1, box.width - padding * 2)
  const usableHeight = Math.max(1, box.height - padding * 2)
  const pitch = Math.min(usableWidth / spanCols, usableHeight / spanRows)
  const gap = Math.max(0.55, pitch * 0.11)
  const size = Math.max(0.4, pitch - gap)

  const mapWidth = spanCols * pitch
  const mapHeight = spanRows * pitch
  const offsetX = box.x + (box.width - mapWidth) / 2
  const offsetY = box.y + (box.height - mapHeight) / 2

  const positions = tiles.map((tile) => ({
    x: offsetX + (tile.col - stats.map.min_col) * pitch,
    y: offsetY + (tile.row - stats.map.min_row) * pitch,
    size,
  }))

  return { positions, pitch }
}

function makeBuckets(tiles: Tile[], stats: Stats): GroupBucket[] {
  const buckets = new Map<string, GroupBucket>()
  for (const item of stats.classes) {
    buckets.set(item.id, {
      item,
      tileIndices: [],
      grid: chooseGrid(item.target_tile_count),
    })
  }

  tiles.forEach((tile, index) => {
    buckets.get(tile.class)?.tileIndices.push(index)
  })

  return stats.classes
    .map((item) => buckets.get(item.id))
    .filter((bucket): bucket is GroupBucket => Boolean(bucket))
    .sort((a, b) => b.item.target_tile_count - a.item.target_tile_count)
}

function shelfPack(
  buckets: GroupBucket[],
  box: Box,
  pitch: number,
): { blocks: PlacedBlock[]; totalHeight: number; maxWidth: number } | null {
  const labelHeight = box.width < 640 ? 26 : 30
  const gapX = 14
  const gapY = 16

  const shelves: Shelf[] = []
  let current: Shelf = { blocks: [], width: 0, height: 0 }

  for (const bucket of buckets) {
    const width = bucket.grid.cols * pitch
    const height = bucket.grid.rows * pitch + labelHeight
    if (width > box.width) return null

    const nextWidth = current.blocks.length > 0 ? current.width + gapX + width : width
    if (nextWidth > box.width && current.blocks.length > 0) {
      shelves.push(current)
      current = { blocks: [], width: 0, height: 0 }
    }

    const placed: PlacedBlock = {
      ...bucket,
      x: 0,
      y: 0,
      width,
      height,
      labelHeight,
    }
    current.blocks.push(placed)
    current.width = current.blocks.length > 1 ? current.width + gapX + width : width
    current.height = Math.max(current.height, height)
  }

  if (current.blocks.length > 0) shelves.push(current)

  const totalHeight =
    shelves.reduce((sum, shelf) => sum + shelf.height, 0) +
    Math.max(0, shelves.length - 1) * gapY
  if (totalHeight > box.height) return null

  const maxWidth = Math.max(...shelves.map((shelf) => shelf.width))
  const startY = box.y + (box.height - totalHeight) / 2
  const blocks: PlacedBlock[] = []
  let y = startY

  for (const shelf of shelves) {
    let x = box.x + (box.width - shelf.width) / 2
    for (const block of shelf.blocks) {
      block.x = x
      block.y = y
      blocks.push(block)
      x += block.width + gapX
    }
    y += shelf.height + gapY
  }

  return { blocks, totalHeight, maxWidth }
}

export function computeWaffleLayout(
  tiles: Tile[],
  stats: Stats,
  box: Box,
): WaffleLayout {
  const buckets = makeBuckets(tiles, stats)
  let low = 1
  let high = 64
  let best = shelfPack(buckets, box, low)
  let bestPitch = low

  for (let iteration = 0; iteration < 26; iteration += 1) {
    const mid = (low + high) / 2
    const candidate = shelfPack(buckets, box, mid)
    if (candidate) {
      best = candidate
      bestPitch = mid
      low = mid
    } else {
      high = mid
    }
  }

  if (!best) {
    throw new Error('Could not fit the waffle layout into the graphic area')
  }

  const pitch = bestPitch
  const gap = Math.max(0.55, pitch * 0.1)
  const size = Math.max(0.4, pitch - gap)
  const positions: TilePosition[] = new Array(tiles.length)
    .fill(null)
    .map(() => ({ x: 0, y: 0, size: 0 }))
  const blocks: WaffleBlock[] = []

  for (const block of best.blocks) {
    const tileShare = (block.item.target_tile_count / stats.retained_tiles) * 100
    const labelHeight = block.labelHeight

    block.tileIndices.forEach((tileIndex, slot) => {
      const col = slot % block.grid.cols
      const row = Math.floor(slot / block.grid.cols)
      positions[tileIndex] = {
        x: block.x + col * pitch,
        y: block.y + labelHeight + row * pitch,
        size,
      }
    })

    blocks.push({
      id: block.item.id,
      color: block.item.color,
      nl: block.item.nl,
      en: block.item.en,
      shortLabel: shortLabel(block.item.en),
      count: block.item.target_tile_count,
      tileShare,
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      labelHeight,
    })
  }

  return { positions, blocks, pitch }
}
