import { useEffect, useState } from 'react'
import { Scrollytelling } from './components/Scrollytelling'
import type { MapData } from './lib/types'

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

  return (
    <div className="min-h-svh bg-paper text-ink">
      <Scrollytelling data={data} />
    </div>
  )
}
