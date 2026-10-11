import { useEffect, useRef, useState } from 'react'
import { DOCS } from '../../data/caseData'
import { KIND_COLOR, STATUS_META } from '../../lib/kinds'
import { cn } from '../../lib/cn'

/** Card with an optional header row (title, one-line description, actions). */
export function Card({ title, desc, actions, children, className, bodyClassName, as: Tag = 'section' }) {
  return (
    <Tag className={cn('card flex min-w-0 flex-col', className)}>
      {(title || actions) && (
        <header className="flex min-h-12 items-center justify-between gap-3 px-4 pt-3 pb-1">
          <div className="min-w-0">
            {title && <h2 className="truncate text-[14px] font-semibold">{title}</h2>}
            {desc && <p className="truncate text-[12px] text-ink-3">{desc}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 px-4 pb-4', !title && !actions && 'pt-4', bodyClassName)}>{children}</div>
    </Tag>
  )
}

/** Page heading: one H1 and one line of description. */
export function PageHeader({ title, desc, actions, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] sm:text-[24px]">{title}</h1>
        {desc && <p className="mt-0.5 text-[13.5px] text-ink-2">{desc}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Small dot + label. `color` is a KIND_COLOR key or CSS colour. */
export function StatusDot({ color, children, className, pulse }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap text-ink-2', className)} style={{ '--c': KIND_COLOR[color] || color }}>
      <span className="relative inline-flex size-[7px] shrink-0">
        {pulse && <span className="bg-c animate-pulse-ring absolute inset-0 rounded-full" />}
        <span className="bg-c relative size-[7px] rounded-full" />
      </span>
      {children}
    </span>
  )
}

export function IssueStatus({ status, className }) {
  const m = STATUS_META[status] || STATUS_META.open
  return (
    <StatusDot color={m.color} className={className}>
      {m.label}
    </StatusDot>
  )
}

/** Neutral or tinted badge. Use sparingly; prefer StatusDot in lists. */
export function Badge({ color, children, className, icon: Icon }) {
  const tinted = !!color
  return (
    <span
      style={tinted ? { '--c': KIND_COLOR[color] || color } : undefined}
      className={cn(
        'inline-flex h-[22px] items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium whitespace-nowrap',
        tinted ? 'bg-c-soft text-c' : 'bg-surface-2 text-ink-2',
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
    </span>
  )
}

/** Compact citation: document id and page, with the document name on hover. */
export function Citation({ doc, page, className, full }) {
  const d = DOCS[doc]
  return (
    <span title={d ? `${d.name}, page ${page}` : undefined} className={cn('inline-flex min-w-0 items-center gap-1 text-[11.5px] text-ink-3', className)}>
      <span className="tabular rounded border border-line bg-surface-2 px-1 py-px font-mono text-[10.5px] font-semibold text-ink-2">{doc}</span>
      <span className="tabular whitespace-nowrap">p.{page}</span>
      {full && d && <span className="truncate">· {d.name}</span>}
    </span>
  )
}

/** Quiet tinted banner with an icon. */
export function Callout({ color = 'primary', icon: Icon, children, className }) {
  return (
    <div style={{ '--c': KIND_COLOR[color] || color }} className={cn('bg-c-soft flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-2', className)}>
      {Icon && <Icon className="text-c mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Progress({ value, className, color = 'var(--primary)', label = 'Progress' }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-surface-2', className)} role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}

/** OCR / extraction confidence as a labelled meter. Below 60% reads as low. */
export function ConfidenceMeter({ value, className, label = 'Confidence' }) {
  const color = value < 60 ? 'var(--danger)' : value < 85 ? 'var(--warning)' : 'var(--success)'
  return (
    <div className={cn('grid gap-1', className)}>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="text-ink-3">{label}</span>
        <b className="tabular font-semibold" style={{ color }}>{value}%</b>
      </div>
      <Progress value={value} color={color} className="h-1" label={label} />
    </div>
  )
}

export function EmptyState({ icon: Icon, title, action, className }) {
  return (
    <div className={cn('grid place-items-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center', className)}>
      {Icon && (
        <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-ink-3">
          <Icon className="size-[18px]" />
        </span>
      )}
      <p className="max-w-[40ch] text-[13px] text-ink-2">{title}</p>
      {action}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} />
}

export function Kbd({ children, className }) {
  return <kbd className={cn('rounded border border-line bg-surface px-1.5 font-sans text-[10.5px] font-medium text-ink-3', className)}>{children}</kbd>
}

/** Animated number that counts up once on mount. */
export function CountUp({ value, className, duration = 650 }) {
  const [n, setN] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (!first.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(value)
      return
    }
    first.current = false
    let raf
    const t0 = performance.now()
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={cn('tabular', className)}>{n}</span>
}

/** Day + month block used in deadline rows. */
export function DateBlock({ date, color = 'primary', size = 'md' }) {
  const d = new Date(date + 'T00:00:00')
  return (
    <span
      style={{ '--c': KIND_COLOR[color] || color }}
      className={cn('bg-c-soft text-c grid shrink-0 place-items-center content-center rounded-lg leading-none', size === 'sm' ? 'h-10 w-9' : 'h-11 w-10')}
    >
      <b className="tabular text-[16px] font-semibold">{d.getDate()}</b>
      <small className="mt-0.5 text-[10px] font-semibold uppercase">{d.toLocaleString('en-GB', { month: 'short' })}</small>
    </span>
  )
}
