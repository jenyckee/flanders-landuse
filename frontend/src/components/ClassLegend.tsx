import type { LandUseClass, Stats } from '../lib/types'

const number = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

interface LegendProps {
  stats: Stats
}

function LegendRow({ item, totalTiles }: { item: LandUseClass; totalTiles: number }) {
  const tileShare = (item.raw_tile_count / totalTiles) * 100

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 border-b border-ink/10 py-3 last:border-b-0">
      <span
        className="mt-1.5 h-3 w-3 shrink-0 rounded-[2px]"
        style={{ backgroundColor: item.color }}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-tight text-ink">
          {item.en}
        </p>
        <p className="mt-0.5 text-[11px] leading-tight text-ink/50">
          {item.nl}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[13px] font-semibold leading-tight tabular-nums text-ink">
          {decimal.format(item.percent)}%
        </p>
        <p className="mt-0.5 text-[10px] leading-tight tabular-nums text-ink/50">
          {number.format(item.area_km2)} km² · {number.format(item.raw_tile_count)} tiles
        </p>
        <div className="mt-1 ml-auto h-1 w-16 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(1, tileShare)}%`,
              backgroundColor: item.color,
            }}
            title={`${decimal.format(tileShare)}% of map tiles`}
          />
        </div>
      </div>
    </li>
  )
}

export function ClassLegend({ stats }: LegendProps) {
  return (
    <aside className="rounded-2xl border border-ink/10 bg-[#fffdf8] px-4 py-5 sm:px-5">
      <div className="flex items-start justify-between gap-3 border-b border-ink/10 pb-3">
        <div>
          <h2 className="font-serif text-xl leading-none text-ink">Land use</h2>
          <p className="mt-1.5 text-[11px] leading-snug text-ink/50">
            Percentages are true area shares.
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-ink/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink/60">
          Raw dominant
        </span>
      </div>

      <ul className="mt-1">
        {stats.classes.map((item) => (
          <LegendRow
            key={item.id}
            item={item}
            totalTiles={stats.retained_tiles}
          />
        ))}
      </ul>

      <div className="mt-4 flex items-center gap-2 border-t border-ink/10 pt-3 text-[10px] leading-snug text-ink/45">
        <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-ink/10">
          <span className="block h-full w-full bg-ink/35" />
        </span>
        The small bar shows each class&apos;s share of map tiles. Map colours
        use the raw dominant class; no area correction yet.
      </div>
    </aside>
  )
}
