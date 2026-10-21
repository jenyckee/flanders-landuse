import type { WaffleBlock, WaffleLayout } from '../lib/layout'

interface WaffleLabelsProps {
  layout: WaffleLayout
  visible: boolean
  containerWidth: number
}

function Label({ block, containerWidth }: { block: WaffleBlock; containerWidth: number }) {
  const width = Math.max(block.width, 70)
  const left = Math.min(block.x, Math.max(0, containerWidth - width - 8))

  return (
    <div
      className="absolute"
      style={{
        left,
        top: block.y,
        width,
        height: block.labelHeight,
      }}
    >
      <div className="flex h-full items-center gap-1.5 overflow-hidden">
        <span
          className="h-2 w-2 shrink-0 rounded-[1px]"
          style={{ backgroundColor: block.color }}
        />
        <span className="truncate text-[10px] font-semibold leading-none text-ink/80 sm:text-[11px]">
          {block.shortLabel}
        </span>
        <span className="ml-auto shrink-0 text-[9px] font-medium leading-none tabular-nums text-ink/45 sm:text-[10px]">
          {block.tileShare.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

export function WaffleLabels({
  layout,
  visible,
  containerWidth,
}: WaffleLabelsProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{
        opacity: visible ? 1 : 0,
        transition: visible
          ? 'opacity 420ms ease 480ms'
          : 'opacity 180ms ease 0ms',
      }}
    >
      {layout.blocks
        .filter((block) => block.width >= 84)
        .map((block) => (
          <Label key={block.id} block={block} containerWidth={containerWidth} />
        ))}
    </div>
  )
}
