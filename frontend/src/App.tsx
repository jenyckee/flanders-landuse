import { useEffect, useState } from 'react'
import { ClassLegend } from './components/ClassLegend'
import { TileCanvas } from './components/TileCanvas'
import type { MapData } from './lib/types'

function LoadingState() {
  return (
    <div className="mx-auto flex min-h-svh max-w-7xl items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-ink/70" />
        <p className="mt-4 text-sm text-ink/55">Building the tile map…</p>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-2xl items-center justify-center px-4">
      <div className="rounded-2xl border border-red-900/15 bg-red-50 p-6">
        <h1 className="font-serif text-2xl text-ink">The map could not load</h1>
        <p className="mt-2 text-sm text-ink/65">{message}</p>
        <p className="mt-4 text-xs text-ink/45">
          Run the pipeline first: <code>pipeline/.venv/bin/python pipeline/build_tiles.py</code>
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [data, setData] = useState<MapData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [statsResponse, tilesResponse] = await Promise.all([
          fetch('/data/stats.json', { signal: controller.signal }),
          fetch('/data/tiles.json', { signal: controller.signal }),
        ])

        if (!statsResponse.ok || !tilesResponse.ok) {
          throw new Error('The generated data files are missing or unreadable.')
        }

        const stats = await statsResponse.json()
        const tilePayload = await tilesResponse.json()
        setData({ stats, tiles: tilePayload.tiles })
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') {
          return
        }
        setError(
          loadError instanceof Error ? loadError.message : 'Unknown loading error.',
        )
      }
    }

    void load()
    return () => controller.abort()
  }, [])

  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingState />

  const { stats } = data
  const area = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(stats.total_area_km2)
  const tileSizeKm = stats.tile_size_m / 1000
  const tileArea = stats.tile_area_km2

  return (
    <div className="min-h-svh bg-paper text-ink">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <header className="mb-6 flex flex-col gap-6 border-b border-ink/10 pb-6 lg:mb-8 lg:flex-row lg:items-end lg:justify-between lg:pb-8">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
              Flanders · land use · {stats.year}
            </p>
            <h1 className="mt-2 font-serif text-[clamp(2.2rem,5vw,4.6rem)] leading-[0.95] tracking-[-0.03em]">
              Flanders, tile by tile
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink/65 sm:text-[15px]">
              Every square is a {tileSizeKm} km tile — {tileArea} km² — coloured
              by its dominant land-use class. The grid covers {area} km² of
              Flanders.
            </p>
          </div>

          <dl className="grid w-full grid-cols-3 gap-3 text-right sm:max-w-md lg:w-auto">
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink/40">
                Area mapped
              </dt>
              <dd className="mt-1 font-serif text-lg leading-none sm:text-2xl">
                {area}
                <span className="ml-1 font-sans text-[10px] font-normal text-ink/50">
                  km²
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink/40">
                Tiles
              </dt>
              <dd className="mt-1 font-serif text-lg leading-none tabular-nums sm:text-2xl">
                {stats.retained_tiles.toLocaleString('en-US')}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-ink/40">
                Tile size
              </dt>
              <dd className="mt-1 font-serif text-lg leading-none sm:text-2xl">
                {tileSizeKm}
                <span className="ml-1 font-sans text-[10px] font-normal text-ink/50">
                  km
                </span>
              </dd>
            </div>
          </dl>
        </header>

        <main className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section aria-labelledby="map-heading">
            <h2 id="map-heading" className="sr-only">
              Dominant land-use tile map
            </h2>
            <TileCanvas tiles={data.tiles} stats={stats} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] leading-relaxed text-ink/45">
              <p>
                Each tile is assigned the land-use group with the largest valid
                area inside it.
              </p>
              <p className="tabular-nums">
                {stats.valid_pixel_count.toLocaleString('en-US')} valid source
                pixels
              </p>
            </div>
          </section>

          <ClassLegend stats={stats} />
        </main>

        <footer className="mt-8 flex flex-col gap-2 border-t border-ink/10 pt-4 text-[10px] leading-relaxed text-ink/45 sm:flex-row sm:items-start sm:justify-between">
          <p>
            Source: Departement Omgeving, Landgebruik Vlaanderen {stats.year} v3.
            Grid: {stats.source_crs}, {tileSizeKm} km tiles.
          </p>
          <p className="max-w-md sm:text-right">
            Dominant-class map only. Area-share correction and the scrollytelling
            view are planned next.
          </p>
        </footer>
      </div>
    </div>
  )
}
