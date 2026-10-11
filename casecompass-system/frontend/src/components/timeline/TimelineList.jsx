import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { LuChevronDown, LuFileSearch, LuArrowRight } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { countdown, daysFrom, fmtShort } from '../../lib/dates'
import { navigate } from '../../lib/router'
import { Citation, EmptyState, StatusDot } from '../ui/display'
import { Button } from '../ui/Button'
import SourceCard from '../shared/SourceCard'
import { kindLabel, nodeColor } from './model'
import { cn } from '../../lib/cn'

/** Group conflict records A and B into one row; everything else is one row per entry. */
function toRows(nodes) {
  const rows = []
  const seen = {}
  nodes.forEach((n) => {
    if (n.cls === 'conflict') {
      if (seen[n.id]) return seen[n.id].records.push(n)
      const r = { key: n.id, date: n.date, records: [n], n }
      seen[n.id] = r
      return rows.push(r)
    }
    rows.push({ key: n.nodeId, date: n.date, records: [n], n })
  })
  return rows
}

function Row({ r }) {
  const { openSource } = useCase()
  const [open, setOpen] = useState(false)
  const n = r.n
  const conflict = n.cls === 'conflict'
  const upcoming = n.kind === 'deadline' && daysFrom(n.date) >= 0
  return (
    <li className={cn('border-b border-line last:border-0', open && 'bg-surface-2/40')}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="grid w-full grid-cols-[64px_14px_minmax(0,1fr)_auto] items-center gap-x-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2/60 sm:grid-cols-[104px_14px_minmax(0,1fr)_150px_110px_16px]">
        <span className="tabular text-[12.5px] text-ink-2">
          {r.records.map((x) => fmtShort(x.date)).join(' / ')}
        </span>
        <span className="flex justify-center">
          <span className={cn('size-2.5', conflict ? 'rotate-45 rounded-[2px]' : 'rounded-full', n.cls === 'missing' && 'border-2 border-dashed bg-transparent')} style={n.cls === 'missing' ? { borderColor: nodeColor(n) } : { background: nodeColor(n) }} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-ink">{n.title}</span>
          <span className="block truncate text-[11.5px] text-ink-3 sm:hidden">{conflict ? 'Date conflict · 2 records' : kindLabel(n)}</span>
        </span>
        <span className="hidden min-w-0 sm:block">
          {conflict ? (
            <span className="flex gap-1.5">{r.records.map((x) => <Citation key={x.nodeId} doc={x.doc} page={x.page} />)}</span>
          ) : (
            <Citation doc={n.doc} page={n.page} />
          )}
        </span>
        <span className="justify-self-end sm:justify-self-start">
          {conflict ? (
            <StatusDot color="danger">2 records</StatusDot>
          ) : n.cls === 'missing' ? (
            <StatusDot color="warning">Not in bundle</StatusDot>
          ) : upcoming ? (
            <span className="tabular text-[12px] font-medium" style={{ color: nodeColor(n) }}>{countdown(n.date)}</span>
          ) : (
            <span className="text-[12px] text-ink-3">{kindLabel(n)}</span>
          )}
        </span>
        <LuChevronDown className={cn('hidden size-4 text-ink-3 transition-transform sm:block', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="animate-fade px-3 pb-3 sm:pl-[144px]">
          <div className={cn('grid gap-2.5', conflict && 'md:grid-cols-2')}>
            {r.records.map((x) => (
              <SourceCard key={x.nodeId} doc={x.doc} page={x.page} quote={x.quote} label={conflict ? `Record ${'ABCDEFGH'[x.ci]} · ${fmtShort(x.date)}` : undefined} />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => openSource(n.nodeId)}><LuFileSearch /> Open source</Button>
            {(conflict || n.cls === 'missing') && (
              <Button variant="ghost" size="sm" onClick={() => navigate(`review?issue=${n.id}`)}>Go to issue <LuArrowRight /></Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export default function TimelineList({ nodes }) {
  const groups = useMemo(() => {
    const g = []
    toRows(nodes).forEach((r) => {
      const key = dayjs(r.date).format('MMMM YYYY')
      if (!g.length || g[g.length - 1].key !== key) g.push({ key, rows: [] })
      g[g.length - 1].rows.push(r)
    })
    return g
  }, [nodes])
  if (!groups.length) return <EmptyState title="Nothing in the record matches these filters." className="m-4" />
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="sticky top-14 z-[2] border-y border-line bg-surface/95 px-3 py-1.5 text-[12px] font-semibold text-ink-2 backdrop-blur">
            {g.key} <span className="tabular font-normal text-ink-3">· {g.rows.length}</span>
          </h3>
          <ul>
            {g.rows.map((r) => <Row key={r.key} r={r} />)}
          </ul>
        </section>
      ))}
    </div>
  )
}
