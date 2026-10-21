import { useEffect, useState } from 'react'
import { Scrollytelling } from './components/Scrollytelling'
import { EvolutionStory } from './components/EvolutionStory'
import type { EvolutionData, MapData } from './lib/types'

type Tab = 'story' | 'evolution'

function LoadingState() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-paper px-4">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink/15 border-t-ink/70" />
        <p className="mt-4 text-sm text-ink/55">Building the tile map…</p>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-paper px-4">
      <div className="max-w-2xl rounded-2xl border border-red-900/15 bg-red-50 p-6">
        <h1 className="font-serif text-2xl text-ink">The map could not load</h1>
        <p className="mt-2 text-sm text-ink/65">{message}</p>
        <p className="mt-4 text-xs text-ink/45">
          Run the pipeline first:{' '}
          <code>pipeline/.venv/bin/python pipeline/build_tiles.py</code>
        </p>
      </div>
    </div>
  )
}

function TabSwitcher({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="fixed right-3 top-3 z-50 rounded-full border border-ink/10 bg-[#fffdf8]/95 p-1 shadow-[0_10px_30px_-16px_rgba(23,32,27,0.5)] backdrop-blur-sm">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onChange('story')}
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
            tab === 'story' ? 'bg-ink text-paper' : 'text-ink/55 hover:bg-ink/5 hover:text-ink/80'
          }`}
        >
          Story
        </button>
        <button
          type="button"
          onClick={() => onChange('evolution')}
          className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
            tab === 'evolution'
              ? 'bg-ink text-paper'
              : 'text-ink/55 hover:bg-ink/5 hover:text-ink/80'
          }`}
        >
          Evolution
        </button>
      </div>
    </nav>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('story')
  const [mapData, setMapData] = useState<MapData | null>(null)
  const [evolution, setEvolution] = useState<EvolutionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [statsResponse, tilesResponse, evolutionResponse] = await Promise.all([
          fetch('/data/stats.json', { signal: controller.signal }),
          fetch('/data/tiles.json', { signal: controller.signal }),
          fetch('/data/evolution.json', { signal: controller.signal }),
        ])

        if (!statsResponse.ok || !tilesResponse.ok || !evolutionResponse.ok) {
          throw new Error('The generated data files are missing or unreadable.')
        }

        const stats = await statsResponse.json()
        const tilePayload = await tilesResponse.json()
        const evolutionPayload = (await evolutionResponse.json()) as EvolutionData
        setMapData({ stats, tiles: tilePayload.tiles })
        setEvolution(evolutionPayload)
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

  const changeTab = (next: Tab) => {
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  if (error) return <ErrorState message={error} />
  if (!mapData || !evolution) return <LoadingState />

  return (
    <div className="min-h-svh bg-paper text-ink">
      <TabSwitcher tab={tab} onChange={changeTab} />
      {tab === 'story' ? (
        <Scrollytelling data={mapData} />
      ) : (
        <EvolutionStory data={evolution} />
      )}
    </div>
  )
}
