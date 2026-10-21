import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { easeCubicInOut } from 'd3'
import type { Stats, Tile } from '../lib/types'
import type { MapLayout, WaffleLayout } from '../lib/layout'

export type GraphicMode = 'map' | 'waffle'

interface TileCanvasProps {
  tiles: Tile[]
  stats: Stats
  mapLayout: MapLayout
  waffleLayout: WaffleLayout
  mode: GraphicMode
  activeClass: string | null
  width: number
  height: number
}

const TRANSITION_MS = 720
const INACTIVE_ALPHA = 0.14
const STAGGER_MS = 190

export function TileCanvas({
  tiles,
  stats,
  mapLayout,
  waffleLayout,
  mode,
  activeClass,
  width,
  height,
}: TileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({
    tiles,
    stats,
    mapLayout,
    waffleLayout,
    mode,
    activeClass,
    width,
    height,
  })
  propsRef.current = {
    tiles,
    stats,
    mapLayout,
    waffleLayout,
    mode,
    activeClass,
    width,
    height,
  }

  const progressRef = useRef<Float32Array>(new Float32Array(tiles.length))
  const fromRef = useRef<Float32Array>(new Float32Array(tiles.length))
  const targetRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const alphaRef = useRef<Map<string, number>>(
    new Map(stats.classes.map((item) => [item.id, 1])),
  )
  const [reducedMotion, setReducedMotion] = useState(false)

  const delays = useMemo(() => {
    const spanCols = Math.max(1, stats.map.max_col - stats.map.min_col)
    const spanRows = Math.max(1, stats.map.max_row - stats.map.min_row)
    return tiles.map((tile) => {
      const x = (tile.col - stats.map.min_col) / spanCols
      const y = (tile.row - stats.map.min_row) / spanRows
      return (x * 0.35 + y * 0.65) * STAGGER_MS
    })
  }, [stats.map, tiles])

  const colors = useMemo(
    () => new Map(stats.classes.map((item) => [item.id, item.color] as const)),
    [stats.classes],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const current = propsRef.current
    if (current.width <= 0 || current.height <= 0) return

    const context = canvas.getContext('2d')
    if (!context) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, current.width, current.height)

    const drawPass = (activePass: boolean) => {
      for (let index = 0; index < current.tiles.length; index += 1) {
        const tile = current.tiles[index]
        const isActive = tile.class === current.activeClass
        if (current.activeClass && isActive !== activePass) continue

        const from = current.mapLayout.positions[index]
        const to = current.waffleLayout.positions[index]
        if (!from || !to) continue

        const progress = progressRef.current[index] ?? 0
        const x = from.x + (to.x - from.x) * progress
        const y = from.y + (to.y - from.y) * progress
        const size = from.size + (to.size - from.size) * progress
        const color = colors.get(tile.class)
        if (!color) continue

        context.globalAlpha = alphaRef.current.get(tile.class) ?? 1
        context.fillStyle = color
        context.fillRect(x, y, size, size)
      }
    }

    if (current.activeClass) {
      drawPass(false)
      drawPass(true)
    } else {
      drawPass(true)
    }
    context.globalAlpha = 1
  }, [colors])

  const tick = useCallback(
    (now: number) => {
      const current = propsRef.current
      let animating = false

      if (startRef.current !== null) {
        const elapsed = now - startRef.current
        let progressDone = true
        for (let index = 0; index < progressRef.current.length; index += 1) {
          const local = Math.min(
            1,
            Math.max(0, (elapsed - (delays[index] ?? 0)) / TRANSITION_MS),
          )
          if (local < 1) progressDone = false
          const eased = easeCubicInOut(local)
          progressRef.current[index] =
            fromRef.current[index] +
            (targetRef.current - fromRef.current[index]) * eased
        }
        if (progressDone) startRef.current = null
        animating = true
      }

      let alphaAnimating = false
      for (const item of current.stats.classes) {
        const target = current.activeClass
          ? item.id === current.activeClass
            ? 1
            : INACTIVE_ALPHA
          : 1
        const previous = alphaRef.current.get(item.id) ?? 1
        const next = previous + (target - previous) * 0.2
        const settled = Math.abs(next - target) < 0.004
        alphaRef.current.set(item.id, settled ? target : next)
        if (!settled) alphaAnimating = true
      }

      drawFrame()

      if (animating || alphaAnimating) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    },
    [delays, drawFrame],
  )

  const ensureLoop = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    drawFrame()
  }, [width, height, drawFrame])

  useEffect(() => {
    const target = mode === 'waffle' ? 1 : 0
    if (reducedMotion) {
      progressRef.current.fill(target)
      startRef.current = null
      drawFrame()
      return
    }

    const alreadyThere = progressRef.current.every(
      (value) => Math.abs(value - target) < 0.001,
    )
    if (alreadyThere) return

    fromRef.current = progressRef.current.slice()
    targetRef.current = target
    startRef.current = performance.now()
    ensureLoop()
  }, [mode, reducedMotion, drawFrame, ensureLoop])

  useEffect(() => {
    if (reducedMotion) {
      for (const item of stats.classes) {
        alphaRef.current.set(
          item.id,
          activeClass ? (item.id === activeClass ? 1 : INACTIVE_ALPHA) : 1,
        )
      }
      drawFrame()
      return
    }
    ensureLoop()
  }, [activeClass, reducedMotion, stats.classes, drawFrame, ensureLoop])

  useEffect(() => {
    drawFrame()
  }, [mapLayout, waffleLayout, drawFrame])

  useEffect(() => {
    if (progressRef.current.length !== tiles.length) {
      progressRef.current = new Float32Array(tiles.length)
      fromRef.current = new Float32Array(tiles.length)
    }
    alphaRef.current = new Map(stats.classes.map((item) => [item.id, 1]))
    drawFrame()
  }, [tiles.length, stats.classes, drawFrame])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      role="img"
      aria-label={`Tile map of dominant land use in Flanders, ${stats.year}. ${stats.retained_tiles.toLocaleString('en-US')} tiles of ${stats.tile_size_m / 1000} kilometres across.`}
    />
  )
}
