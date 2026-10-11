import { LuCheck } from 'react-icons/lu'
import { nodeColor } from './model'

/** The mark for one node. Shape encodes kind; colour encodes urgency/status. */
export default function Mark({ n, selected }) {
  const color = nodeColor(n)
  const ring = selected ? { boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 22%, transparent)` } : undefined
  let shape
  if (n.cls === 'conflict') {
    shape = <span className="block size-[11px] rotate-45 rounded-[2px] border-2" style={{ borderColor: color, background: n.ci ? 'var(--surface)' : color, ...ring }} />
  } else if (n.cls === 'missing') {
    shape = <span className="block size-[14px] rounded-full border-2 border-dashed bg-surface" style={{ borderColor: color, ...ring }} />
  } else if (n.kind === 'hearing') {
    shape = (
      <span className="grid size-[15px] place-items-center rounded-full border-2 bg-surface" style={{ borderColor: color, ...ring }}>
        <span className="size-[5px] rounded-full" style={{ background: color }} />
      </span>
    )
  } else {
    shape = <span className="block size-[11px] rounded-full" style={{ background: color, ...ring }} />
  }
  return (
    <span className="relative grid place-items-center transition-transform duration-150 group-hover:scale-125 group-focus-visible:scale-125" style={selected ? { transform: 'scale(1.2)' } : undefined}>
      {n.cls === 'red' && <span className="animate-pulse-ring absolute size-[12px] rounded-full" style={{ background: color }} />}
      {shape}
      {(n.confirmed || n.corrected) && (
        <span className="absolute -top-[7px] -right-[8px] grid size-[11px] place-items-center rounded-full bg-success text-white ring-2 ring-surface">
          <LuCheck className="size-[8px]" strokeWidth={4} />
        </span>
      )}
    </span>
  )
}
