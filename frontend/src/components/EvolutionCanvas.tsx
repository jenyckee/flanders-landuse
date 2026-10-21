import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { easeCubicInOut } from 'd3'
import type { EvolutionData } from '../lib/types'

interface EvolutionCanvasProps {
  data: EvolutionData
  activeYear: number
  activeClass: string | null
  width: number
  height: number
}

const TRANSITION_MS = 560
const STAGGER_MS = 170
const INACTIVE_ALPHA = 0.1

export function EvolutionCanvas({
  data,
  activeYear,
  activeClass,
  width,
  height,
}: EvolutionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { years, classes, tiles, map } = data
  const yearIdx = Math.max(0, years.indexOf(activeYear))

  const classIndex = useMemo(
    () => new Map(classes.map((item, index) => [item.id, index])),
    [classes],
  )

  const positions = useMemo(() => {
    const spanCols = Math.max(1, map.max_col - map.min_col + 1)
    const spanRows = Math.max(1, map.max_row - map.min_row + 1)
    const padding = 24
    const usableWidth = Math.max(1, width - padding * 2)
    const usableHeight = Math.max(1, height - padding * 2)
    const pitch = Math.min(usableWidth / spanCols, usableHeight / spanRows)
    const gap = Math.max(0.55, pitch * 0.11)
    const size = Math.max(0.4, pitch - gap)
    const offsetX = (width - spanCols * pitch) / 2
    const offsetY = (height - spanRows * pitch) / 2

    return tiles.map((tile) => ({
      x: offsetX + (tile.col - map.min_col) * pitch,
      y: offsetY + (tile.row - map.min_row) * pitch,
      size,
    }))
  }, [tiles, map, width, height])

  const delays = useMemo(() => {
    const spanCols = Math.max(1, map.max_col - map.min_col)
    const spanRows = Math.max(1, map.max_row - map.min_row)
    return tiles.map((tile) => {
      const x = (tile.col - map.min_col) / spanCols
      const y = (tile.row - map.min_row) / spanRows
      return (x * 0.35 + y * 0.65) * STAGGER_MS
    })
  }, [map, tiles])

  const fromRef = useRef<Int32Array | null>(null)
  const toRef = useRef<Int32Array | null>(null)
  const progressRef = useRef<Float32Array | null>(null)
  const prevYearRef = useRef(yearIdx)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  if (!fromRef.current || fromRef.current.length !== tiles.length) {
    const from = new Int32Array(tiles.length)
    const to = new Int32Array(tiles.length)
    const progress = new Float32Array(tiles.length)
    for (let i = 0; i < tiles.length; i += 1) {
      const idx = tiles[i].classes[yearIdx] ?? 0
      from[i] = idx
      to[i] = idx
      progress[i] = 1
    }
    fromRef.current = from
    toRef.current = to
    progressRef.current = progress
  }

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
    const from = fromRef.current
    const to = toRef.current
    const progress = progressRef.current
    if (!from || !to || !progress) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const activeIdx = activeClass ? classIndex.get(activeClass) : undefined

    for (let i = 0; i < tiles.length; i += 1) {
      const pos = positions[i]
      const fromIdx = from[i]
      const toIdx = to[i]
      const p = Math.min(1, Math.max(0, progress[i]))
      const fromColor = classes[fromIdx]?.color
      const toColor = classes[toIdx]?.color
      if (!fromColor || !toColor || pos.size <= 0) continue

      const highlighted =
        activeIdx === undefined || fromIdx === activeIdx || toIdx === activeIdx
      const alpha = highlighted ? 1 : INACTIVE_ALPHA

      if (fromIdx === toIdx) {
        ctx.globalAlpha = alpha
        ctx.fillStyle = toColor
        ctx.fillRect(pos.x, pos.y, pos.size, pos.size)
      } else {
        if (p < 1) {
          ctx.globalAlpha = alpha * (1 - p)
          ctx.fillStyle = fromColor
          ctx.fillRect(pos.x, pos.y, pos.size, pos.size)
        }
        if (p > 0) {
          ctx.globalAlpha = alpha * p
          ctx.fillStyle = toColor
          ctx.fillRect(pos.x, pos.y, pos.size, pos.size)
        }
      }
    }
    ctx.globalAlpha = 1
  }, [activeClass, classIndex, classes, positions, tiles, width, height])

  const tick = useCallback(
    (now: number) => {
      const from = fromRef.current
      const progress = progressRef.current
      if (!from || !progress) return
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      let animating = false

      for (let i = 0; i < progress.length; i += 1) {
        const local = Math.min(
          1,
          Math.max(0, (elapsed - (delays[i] ?? 0)) / TRANSITION_MS),
        )
        if (local < 1) animating = true
        progress[i] = easeCubicInOut(local)
      }

      drawFrame()

      if (animating) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
        startRef.current = null
      }
    },
    [delays, drawFrame],
  )

  useEffect(() => {
    const from = fromRef.current
    const to = toRef.current
    const progress = progressRef.current
    if (!from || !to || !progress) return

    const previousYear = prevYearRef.current
    if (yearIdx === previousYear) return

    for (let i = 0; i < tiles.length; i += 1) {
      from[i] = tiles[i].classes[previousYear] ?? 0
      to[i] = tiles[i].classes[yearIdx] ?? 0
      progress[i] = reducedMotion || from[i] === to[i] ? 1 : 0
    }

    prevYearRef.current = yearIdx
    startRef.current = null

    if (reducedMotion) {
      drawFrame()
      return
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [yearIdx, tiles, reducedMotion, drawFrame, tick])

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
    drawFrame()
  }, [drawFrame])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  return <canvas ref={canvasRef} className="absolute inset-0 block" />
}
