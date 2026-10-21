import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import scrollama from 'scrollama'
import type { EvolutionData, EvolutionTransition } from '../lib/types'
import { EvolutionCanvas } from './EvolutionCanvas'

interface EvolutionStoryProps {
  data: EvolutionData
}

interface Size {
  width: number
  height: number
}

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

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

function topShift(
  transition: EvolutionTransition | undefined,
  classes: EvolutionData['classes'],
): { label: string; delta: number } | null {
  if (!transition) return null
  let best: { label: string; delta: number } | null = null
  for (const item of classes) {
    const net = transition.net_changes[item.id]
    if (!net) continue
    const delta = net.gained_km2 - net.lost_km2
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { label: item.en, delta }
    }
  }
  return best
}

export function EvolutionStory({ data }: EvolutionStoryProps) {
  const { years, classes, year_stats, transitions } = data
  const fallbackYear = years[0] ?? data.default_year ?? 2013
  const [activeYear, setActiveYear] = useState(fallbackYear)
  const [activeClass, setActiveClass] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const stepRefs = useRef<Record<number, HTMLElement | null>>({})
  const size = useElementSize(stageRef)

  const yearStats = year_stats[String(activeYear)]

  const composition = useMemo(() => {
    if (!yearStats) return []
    return [...yearStats.classes]
      .sort((a, b) => b.area_km2 - a.area_km2)
      .map((item) => ({
        id: item.id,
        label: item.en,
        color: item.color,
        percent: item.percent,
        area: item.area_km2,
      }))
  }, [yearStats])

  useEffect(() => {
    const scroller = scrollama()
    scroller
      .setup({
        step: '.evo-step',
        offset: 0.6,
        once: false,
        progress: false,
      })
      .onStepEnter(({ index }) => {
        const year = years[index]
        if (typeof year === 'number') setActiveYear(year)
      })

    const handleResize = () => scroller.resize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      scroller.destroy()
    }
  }, [years])

  const jumpToYear = (year: number) => {
    setActiveYear(year)
    stepRefs.current[year]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <section className="relative bg-paper">
      <div className="sticky top-0 z-0 h-[58svh] overflow-hidden bg-paper lg:h-[100svh]">
        <div ref={stageRef} className="absolute inset-0">
          {size.width > 0 && size.height > 0 ? (
            <EvolutionCanvas
              data={data}
              activeYear={activeYear}
              activeClass={activeClass}
              width={size.width}
              height={size.height}
            />
          ) : null}

          <div className="pointer-events-none absolute left-4 top-4 z-10 sm:left-6 sm:top-5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/45">
              Flanders ·<span className="hidden sm:inline"> land use ·</span> evolution
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-4xl leading-none text-ink/90 sm:text-5xl">
                {activeYear}
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/40">
                dominant class
              </span>
            </p>
          </div>

          <div className="absolute left-1/2 top-14 z-20 flex -translate-x-1/2 gap-1 rounded-full border border-ink/10 bg-[#fffdf8]/90 p-1 shadow-sm backdrop-blur-sm sm:top-4">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => jumpToYear(year)}
                className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums transition-colors ${
                  activeYear === year
                    ? 'bg-ink text-paper'
                    : 'text-ink/55 hover:bg-ink/5 hover:text-ink/80'
                }`}
              >
                {year}
              </button>
            ))}
          </div>

          <div className="absolute bottom-3 left-3 right-3 z-20 max-w-[720px] rounded-xl border border-ink/10 bg-[#fffdf8]/92 p-3 shadow-sm backdrop-blur-sm sm:left-4 sm:right-auto sm:bottom-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink/45">
                True area share · {activeYear}
              </p>
              <p className="text-[9px] tabular-nums text-ink/40">
                {number.format(yearStats?.total_area_km2 ?? 0)} km²
              </p>
            </div>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-ink/5">
              {composition.map((item) => (
                <span
                  key={item.id}
                  className="h-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${item.percent}%`,
                    backgroundColor: item.color,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
              {composition.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setActiveClass((current) => (current === item.id ? null : item.id))
                  }
                  className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-[10px] transition-colors ${
                    activeClass === item.id ? 'bg-ink/10 text-ink' : 'text-ink/60 hover:bg-ink/5'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-[1px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto tabular-nums text-ink/40">
                    {decimal.format(item.percent)}%
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-4 right-4 z-10 hidden text-right text-[9px] leading-tight text-ink/35 sm:block">
            {number.format(data.retained_tiles)} tiles ·{' '}
            {number.format(data.common_area_km2)} km² common area
          </div>
        </div>
      </div>

      <div className="relative z-10 lg:-mt-[100svh]">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col pb-[18vh] pt-4 lg:items-end lg:pb-[20vh] lg:pt-[12vh]">
            {years.map((year, index) => {
              const previousYear = index > 0 ? years[index - 1] : null
              const transition = previousYear
                ? transitions[`${previousYear}-${year}`]
                : undefined
              const shift = topShift(transition, classes)
              const isActive = activeYear === year

              return (
                <article
                  key={year}
                  ref={(node) => {
                    stepRefs.current[year] = node
                  }}
                  className="evo-step flex min-h-[56svh] w-full items-start py-3 lg:min-h-[80vh] lg:w-[390px] lg:items-center lg:py-8"
                  aria-label={`Year ${year}`}
                >
                  <div
                    className={`pointer-events-auto w-full rounded-2xl border border-ink/10 border-t-[3px] bg-[#fffdf8]/95 p-5 shadow-[0_18px_50px_-24px_rgba(23,32,27,0.4)] backdrop-blur-sm transition-opacity duration-300 sm:p-6 ${
                      isActive ? 'opacity-100' : 'opacity-70 lg:opacity-100'
                    }`}
                    style={{ borderTopColor: shift && shift.delta < 0 ? '#8a5a44' : '#17201b' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink/45">
                        {index === 0 ? 'Baseline' : `Change since ${previousYear}`}
                      </p>
                      <span className="shrink-0 font-serif text-xl tabular-nums text-ink/80">
                        {year}
                      </span>
                    </div>

                    <h2 className="mt-2 font-serif text-[clamp(1.6rem,3.2vw,2.15rem)] leading-[1.03] tracking-[-0.02em]">
                      {index === 0
                        ? 'Where Flanders starts'
                        : shift && shift.delta !== 0
                          ? `${shift.delta > 0 ? 'More' : 'Less'} ${shift.label.toLowerCase()}`
                          : 'A quiet year for land use'}
                    </h2>

                    <p className="mt-3 text-[13px] leading-relaxed text-ink/65 sm:text-sm">
                      {index === 0
                        ? `In ${year}, every 2 km square is coloured by its dominant land use. ${number.format(data.retained_tiles)} tiles cover ${number.format(data.common_area_km2)} km² that are present in all ${years.length} snapshots.`
                        : transition
                          ? `${decimal.format(transition.changed_km2)} km² changed between ${previousYear} and ${year}, affecting ${number.format(transition.tile_changes)} tiles. The map crossfades each square from its old dominant class to its new one.`
                          : `The map crossfades between ${previousYear} and ${year}.`}
                    </p>

                    {index > 0 && shift ? (
                      <div className="mt-4 grid grid-cols-[auto_1fr] items-end gap-x-4 border-y border-ink/10 py-3">
                        <div>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink/40">
                            Largest shift
                          </p>
                          <p className="mt-0.5 font-serif text-2xl leading-none tabular-nums">
                            {shift.delta > 0 ? '+' : ''}
                            {decimal.format(shift.delta)}
                            <span className="ml-0.5 font-sans text-sm font-normal text-ink/45">
                              km²
                            </span>
                          </p>
                        </div>
                        <p className="text-right text-[11px] leading-tight text-ink/55">
                          {shift.delta > 0 ? 'net gain for' : 'net loss for'}{' '}
                          <span className="font-semibold text-ink/75">{shift.label}</span>
                        </p>
                      </div>
                    ) : null}

                    <p className="mt-3 text-[10px] leading-relaxed text-ink/40">
                      {index === 0
                        ? 'Scroll to step through the years.'
                        : 'Colours show the raw dominant class. Area shares are true pixel areas and stay visible below the map.'}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
