import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import scrollama from 'scrollama'
import type { LandUseClass, MapData } from '../lib/types'
import {
  computeMapLayout,
  computeWaffleLayout,
  shortLabel,
  type Box,
} from '../lib/layout'
import { TileCanvas } from './TileCanvas'
import { WaffleLabels } from './WaffleLabels'
import { WaffleLegend } from './WaffleLegend'

interface ScrollytellingProps {
  data: MapData
}

type StepKind = 'intro' | 'class' | 'waffle' | 'closing'

interface Step {
  kind: StepKind
  kicker: string
  title: string
  body: string
  item?: LandUseClass
  tileShare?: number
}

interface Size {
  width: number
  height: number
}

const descriptions: Record<string, string> = {
  cropland:
    'Arable fields dominate the fertile north and central soils. They are the largest class in Flanders, covering just under a third of the area.',
  grassland:
    'Pasture is concentrated in the west and north, often next to cropland. Many mixed squares are counted as grassland once the tile counts are corrected.',
  built: 'Housing, gardens and other built-up land form the second-largest group by true area, clustered around cities and along the coast.',
  forest:
    'Forest is concentrated in the east and south, with large blocks in the Campine and the southern hills.',
  transport:
    'Motorways, railways and airports are linear. They cover a substantial area but rarely dominate a whole 2 km square.',
  nature:
    'Heath, dunes, marshes, quarries and other open land are small and fragmented, so few tiles have them as a majority.',
  industry:
    'Ports, business parks and commercial zones form compact, high-intensity clusters near cities and waterways.',
  recreation:
    'Parks, sports grounds and recreation areas are small relative to the tile grid, so they win few squares outright.',
  water:
    'Rivers, canals, lakes and coastal water cover a small share of the region and rarely dominate a whole tile.',
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function tileShareOf(item: LandUseClass, retainedTiles: number): number {
  return (item.target_tile_count / retainedTiles) * 100
}

function buildSteps(data: MapData): Step[] {
  const { stats } = data
  const cropland = stats.classes.find((item) => item.id === 'cropland')
  const classSteps: Step[] = stats.classes.map((item, index) => ({
    kind: 'class',
    kicker: `${String(index + 1).padStart(2, '0')} / ${String(stats.classes.length).padStart(2, '0')} · ${item.nl}`,
    title: item.en,
    body: descriptions[item.id] ?? '',
    item,
    tileShare: tileShareOf(item, stats.retained_tiles),
  }))

  const waffleBody = cropland
    ? `Every tile moves into its class block. Block size now matches true land area: cropland takes ${decimal.format(cropland.percent)}% of Flanders and the same share of the tiles.`
    : 'Every tile moves into its class block. Block size matches true land area.'

  return [
    {
      kind: 'intro',
      kicker: `Flanders · ${stats.year}`,
      title: 'A region made of squares',
      body: `Every square is a ${stats.tile_size_m / 1000} km tile, coloured by its land use. The grid holds ${number.format(stats.retained_tiles)} tiles and covers ${number.format(stats.total_area_km2)} km². Scroll to isolate each class, then regroup the tiles.`,
    },
    ...classSteps,
    {
      kind: 'waffle',
      kicker: 'Regroup',
      title: 'The same tiles, sorted by class',
      body: waffleBody,
    },
    {
      kind: 'closing',
      kicker: 'How this map works',
      title: 'Dominant is not representative',
      body: 'Small, linear and fragmented classes lose the majority vote inside 2 km squares. A largest-remainder correction reassigns the least confident tiles — those with the smallest dominant-class margin — until every class\'s tile count matches its true area share.',
    },
  ]
}

function useElementSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const rect = element.getBoundingClientRect()
      setSize({ width: rect.width, height: rect.height })
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

function ProgressBar({ value }: { value: number }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
      <span
        className="block h-full rounded-full bg-ink/55 transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </span>
  )
}

function DataTable({ data }: { data: MapData }) {
  const { stats } = data
  return (
    <details className="group mt-5 border-t border-ink/10 pt-3">
      <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45 transition-colors hover:text-ink/70">
        View the data
        <span className="float-right transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[10px] tabular-nums">
          <thead>
            <tr className="border-b border-ink/15 text-[9px] uppercase tracking-wide text-ink/40">
              <th className="py-1.5 pr-2 font-medium">Class</th>
              <th className="py-1.5 pr-2 text-right font-medium">Area</th>
              <th className="py-1.5 pr-2 text-right font-medium">Area %</th>
              <th className="py-1.5 text-right font-medium">Tiles</th>
            </tr>
          </thead>
          <tbody>
            {stats.classes.map((item) => (
              <tr key={item.id} className="border-b border-ink/5 last:border-0">
                <td className="py-1.5 pr-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-[1px]"
                      style={{ backgroundColor: item.color }}
                    />
                    {shortLabel(item.en)}
                  </span>
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {number.format(item.area_km2)} km²
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {decimal.format(item.percent)}%
                </td>
                <td className="py-1.5 text-right">
                  {number.format(item.target_tile_count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function StepCard({
  step,
  index,
  total,
  data,
  active,
}: {
  step: Step
  index: number
  total: number
  data: MapData
  active: boolean
}) {
  const item = step.item
  const isClass = step.kind === 'class'

  return (
    <article
      className="scrolly-step flex min-h-[62svh] w-full items-start py-4 lg:min-h-[86vh] lg:w-[400px] lg:items-center lg:py-10"
      data-step={index}
      aria-label={`${index + 1} of ${total}: ${step.title}`}
    >
      <div
        className={`pointer-events-auto sticky top-[56svh] z-20 max-h-[calc(44svh-12px)] w-full overflow-y-auto overscroll-contain rounded-2xl border border-ink/10 border-t-[3px] bg-[#fffdf8]/95 p-5 shadow-[0_18px_50px_-24px_rgba(23,32,27,0.4)] backdrop-blur-sm transition-opacity duration-300 sm:p-6 lg:static lg:max-h-none lg:overflow-visible lg:opacity-100 ${
          active
            ? 'opacity-100'
            : 'pointer-events-none opacity-0 lg:pointer-events-auto'
        }`}
        style={{ borderTopColor: item?.color ?? '#17201b' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink/45">
            {step.kicker}
          </p>
          <span className="shrink-0 text-[9px] tabular-nums text-ink/30">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>

        <h2 className="mt-2 font-serif text-[clamp(1.7rem,3.6vw,2.35rem)] leading-[1.02] tracking-[-0.02em]">
          {step.title}
        </h2>

        {isClass && item ? (
          <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-x-4 border-y border-ink/10 py-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink/40">
                True area
              </p>
              <p className="mt-0.5 font-serif text-3xl leading-none tabular-nums">
                {decimal.format(item.percent)}
                <span className="ml-0.5 font-sans text-sm font-normal text-ink/45">
                  %
                </span>
              </p>
              <p className="mt-1 text-[10px] tabular-nums text-ink/45">
                {number.format(item.area_km2)} km²
              </p>
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-[10px]">
                <span className="text-ink/45">Share of map tiles</span>
                <span className="font-semibold tabular-nums">
                  {decimal.format(step.tileShare ?? 0)}%
                </span>
              </div>
              <div className="mt-1.5">
                <ProgressBar value={step.tileShare ?? 0} />
              </div>
              <p className="mt-1.5 text-right text-[10px] tabular-nums text-ink/40">
                {number.format(item.target_tile_count)} of{' '}
                {number.format(data.stats.retained_tiles)} tiles
              </p>
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-[13px] leading-relaxed text-ink/65 sm:text-sm">
          {step.body}
        </p>

        {step.kind === 'intro' ? (
          <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/40">
            <span className="inline-block h-5 w-px bg-ink/20" />
            Scroll to begin
          </div>
        ) : null}

        {step.kind === 'closing' ? (
          <>
            <DataTable data={data} />
            <p className="mt-4 text-[9px] leading-relaxed text-ink/40">
              Source: Departement Omgeving, Landgebruik Vlaanderen{' '}
              {data.stats.year} v3. {data.stats.source_crs}, 2 km tiles.
              Percentages are true area shares; map colours show the dominant
              class after largest-remainder correction.
            </p>
          </>
        ) : null}
      </div>
    </article>
  )
}

export function Scrollytelling({ data }: ScrollytellingProps) {
  const { stats, tiles } = data
  const graphicRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(graphicRef)
  const [stepIndex, setStepIndex] = useState(0)
  const steps = useMemo(() => buildSteps(data), [data])
  const currentStep = steps[stepIndex] ?? steps[0]
  const mode = currentStep.kind === 'waffle' || currentStep.kind === 'closing'
    ? 'waffle'
    : 'map'
  const activeClass = currentStep.kind === 'class' ? currentStep.item?.id ?? null : null

  const isDesktop = size.width >= 1024
  const graphicBox = useMemo<Box>(() => {
    if (isDesktop) {
      return {
        x: 28,
        y: 88,
        width: Math.max(320, size.width - 470),
        height: Math.max(320, size.height - 132),
      }
    }
    return {
      x: 14,
      y: 56,
      width: Math.max(280, size.width - 28),
      height: Math.max(260, size.height - 92),
    }
  }, [isDesktop, size])

  const legendHeight = isDesktop ? 30 : 46
  const waffleBox = useMemo<Box>(
    () => ({
      ...graphicBox,
      height: Math.max(240, graphicBox.height - legendHeight),
    }),
    [graphicBox, legendHeight],
  )

  const layouts = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return null
    return {
      map: computeMapLayout(tiles, stats, graphicBox),
      waffle: computeWaffleLayout(tiles, stats, waffleBox),
    }
  }, [graphicBox, size.height, size.width, stats, tiles, waffleBox])

  useEffect(() => {
    const scroller = scrollama()
    scroller
      .setup({
        step: '.scrolly-step',
        offset: 0.6,
        once: false,
        progress: false,
      })
      .onStepEnter(({ index }) => {
        setStepIndex(index)
      })

    const handleResize = () => scroller.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      scroller.destroy()
    }
  }, [])

  return (
    <section className="relative bg-paper">
      <div className="sticky top-0 h-[56svh] overflow-hidden bg-paper lg:h-[100svh]">
        <div ref={graphicRef} className="absolute inset-0">
          {layouts ? (
            <TileCanvas
              tiles={tiles}
              stats={stats}
              mapLayout={layouts.map}
              waffleLayout={layouts.waffle}
              mode={mode}
              activeClass={activeClass}
              width={size.width}
              height={size.height}
            />
          ) : null}

          <WaffleLabels
            layout={layouts?.waffle ?? { positions: [], blocks: [], pitch: 0 }}
            visible={mode === 'waffle'}
            containerWidth={size.width}
          />

          {layouts ? (
            <div
              className="pointer-events-none absolute"
              style={{
                left: graphicBox.x,
                top: graphicBox.y + graphicBox.height - legendHeight + 4,
                width: graphicBox.width,
                height: legendHeight,
              }}
            >
              <WaffleLegend
                layout={layouts.waffle}
                visible={mode === 'waffle'}
              />
            </div>
          ) : null}

          <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45">
              Flanders · land use · {stats.year}
            </p>
            <p className="mt-1 font-serif text-lg leading-none text-ink/90 sm:text-xl">
              {mode === 'waffle' ? 'Regrouped by class' : 'Land use'}
            </p>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex items-end justify-between gap-4 text-[9px] leading-tight text-ink/40 sm:left-6 sm:right-6">
            <span>
              {number.format(stats.retained_tiles)} tiles ·{' '}
              {number.format(stats.total_area_km2)} km²
            </span>
            <span className="hidden text-right sm:block">
              {stats.source_crs} · {stats.tile_size_m / 1000} km grid
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 lg:-mt-[100svh]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col pb-[20vh] pt-3 lg:items-end lg:pb-[20vh] lg:pt-[10vh]">
            {steps.map((step, index) => (
              <StepCard
                key={`${step.kind}-${step.item?.id ?? index}`}
                step={step}
                index={index}
                total={steps.length}
                data={data}
                active={index === stepIndex}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
