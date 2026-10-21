import type { WaffleLayout } from '../lib/layout'

interface WaffleLegendProps {
  layout: WaffleLayout
  visible: boolean
}

export function WaffleLegend({ layout, visible }: WaffleLegendProps) {
  return (
    <div
      className="pointer-events-none flex flex-wrap items-start gap-x-4 gap-y-1"
      aria-hidden="true"
      style={{
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'opacity 420ms ease 560ms'
          : 'opacity 160ms ease 0ms',
      }}
    >
      {layout.blocks.map((block) => (
        <span
          key={block.id}
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-[9px] leading-none text-ink/55 sm:text-[10px]"
        >
          <span
            className="h-2 w-2 rounded-[1px]"
            style={{ backgroundColor: block.color }}
          />
          <span>{block.shortLabel}</span>
          <span className="tabular-nums text-ink/35">
            {block.tileShare.toFixed(1)}%
          </span>
        </span>
      ))}
    </div>
  )
}
