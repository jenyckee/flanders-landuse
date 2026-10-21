import { useEffect, useRef, useState } from 'react'
import { scaleLinear } from 'd3'
import type { Stats, Tile } from '../lib/types'

interface TileCanvasProps {
  tiles: Tile[]
  stats: Stats
}

interface Size {
  width: number
  height: number
}

const FALLBACK_SIZE: Size = { width: 960, height: 420 }

export function TileCanvas({ tiles, stats }: TileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<Size>(FALLBACK_SIZE)

  useEffect(() => {
    const element = frameRef.current
    if (!element) return

    const update = () => {
      const rect = element.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height })
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width <= 0 || size.height <= 0) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
    canvas.style.width = `${size.width}px`
    canvas.style.height = `${size.height}px`

    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, size.width, size.height)

    const padding = size.width < 640 ? 10 : 18
    const spanCols = stats.map.max_col - stats.map.min_col + 1
    const spanRows = stats.map.max_row - stats.map.min_row + 1
    const pitch = Math.min(
      (size.width - padding * 2) / spanCols,
      (size.height - padding * 2) / spanRows,
    )
    if (pitch <= 0) return

    const mapWidth = spanCols * pitch
    const mapHeight = spanRows * pitch
    const offsetX = (size.width - mapWidth) / 2
    const offsetY = (size.height - mapHeight) / 2

    const x = scaleLinear()
      .domain([stats.map.min_col, stats.map.max_col + 1])
      .range([offsetX, offsetX + mapWidth])
    const y = scaleLinear()
      .domain([stats.map.min_row, stats.map.max_row + 1])
      .range([offsetY, offsetY + mapHeight])

    const gap = Math.max(0.55, pitch * 0.11)
    const tileSize = Math.max(0.5, pitch - gap)
    const colors = new Map(
      stats.classes.map((item) => [item.id, item.color] as const),
    )

    for (const tile of tiles) {
      const color = colors.get(tile.class)
      if (!color) continue
      context.fillStyle = color
      context.fillRect(x(tile.col), y(tile.row), tileSize, tileSize)
    }
  }, [size, stats, tiles])

  return (
    <div
      ref={frameRef}
      className="relative h-[48svh] min-h-[300px] w-full overflow-hidden rounded-2xl bg-[#efeadf] sm:h-[56svh] lg:h-[64svh]"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        role="img"
        aria-label={`Tile map of dominant land use in Flanders, ${stats.year}. ${stats.retained_tiles.toLocaleString('en-US')} tiles of ${stats.tile_size_m / 1000} kilometres across.`}
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-ink/5" />
    </div>
  )
}
