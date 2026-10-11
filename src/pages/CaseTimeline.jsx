import { useEffect, useMemo, useState } from 'react'
import { LuSearch, LuFileDown, LuChartGantt, LuList, LuAlarmClock, LuFlag, LuLayers } from 'react-icons/lu'
import { useCase } from '../state/CaseStore'
import { buildNodes, DOC_FILTERS } from '../lib/selectors'
import { daysFrom } from '../lib/dates'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/display'
import { FilterChip, SegmentedControl } from '../components/ui/controls'
import TimelineCanvas from '../components/timeline/TimelineCanvas'
import NodeDetail from '../components/timeline/NodeDetail'
import TimelineList from '../components/timeline/TimelineList'
import { LANES, applyFilters, laneOf } from '../components/timeline/model'
import { cn } from '../lib/cn'

const readView = () => {
  try { return localStorage.getItem('cc-tl-view') || 'timeline' } catch { return 'timeline' }
}

/** Shape key shown under the canvas. */
function ShapeKey() {
  const item = (mark, label) => (
    <span className="inline-flex items-center gap-1.5">{mark}{label}</span>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
      {item(<i className="size-2.5 rounded-full bg-primary" />, 'Event')}
      {item(<i className="grid size-3 place-items-center rounded-full border-2 border-primary"><i className="size-1 rounded-full bg-primary" /></i>, 'Hearing')}
      {item(<i className="size-2.5 rounded-full bg-danger" />, `Due ≤ 7 days`)}
      {item(<i className="size-2.5 rounded-full bg-warning" />, '≤ 30 days')}
      {item(<i className="size-2.5 rounded-full bg-success" />, 'Later')}
      {item(<i className="size-2 rotate-45 rounded-[1px] bg-danger" />, 'Conflicting records')}
      {item(<i className="size-2.5 rounded-full border-2 border-dashed border-warning" />, 'Missing document')}
    </div>
  )
}

export default function CaseTimeline() {
  const { state } = useCase()
  const [view, setViewState] = useState(readView)
  const [slice, setSlice] = useState('all')
  const [types, setTypes] = useState([])
  const [q, setQ] = useState('')
  const [hidden, setHidden] = useState([])
  const [selId, setSelId] = useState(null)

  const setView = (v) => {
    setViewState(v)
    try { localStorage.setItem('cc-tl-view', v) } catch { /* ignore */ }
  }

  const all = useMemo(() => buildNodes(state), [state])
  const nodes = useMemo(() => applyFilters(all, { slice, types, q }), [all, slice, types, q])
  const shown = view === 'timeline' ? nodes.filter((n) => !hidden.includes(laneOf(n))) : nodes
  const selected = shown.find((n) => n.nodeId === selId) || null

  /* default selection: the next upcoming deadline */
  useEffect(() => {
    if (!selId) {
      const next = all.find((n) => n.kind === 'deadline' && daysFrom(n.date) >= 0)
      if (next) setSelId(next.nodeId)
    }
  }, [all, selId])

  const toggleType = (k) => setTypes((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]))
  const toggleLane = (k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))
  const filtered = slice !== 'all' || types.length || q
  const clear = () => { setSlice('all'); setTypes([]); setQ('') }

  return (
    <>
      <PageHeader
        title="Case Timeline"
        desc="Every event, hearing and deadline in date order, each tied to its document and page."
        actions={
          <>
            <SegmentedControl label="View" value={view} onChange={setView} options={[{ value: 'timeline', label: 'Timeline', icon: LuChartGantt }, { value: 'list', label: 'List', icon: LuList }]} />
            <label className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-primary">
              <LuSearch className="size-4 text-ink-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" className="w-32 bg-transparent text-[13px] outline-none placeholder:text-ink-3 sm:w-40" aria-label="Search timeline entries" />
            </label>
            <Button href="#/report" variant="secondary"><LuFileDown /> Export chronology</Button>
          </>
        }
      />

      <section className="card">
        {/* USP 5: multi-filter slices */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-line px-4 py-3">
          <FilterChip active={slice === 'all'} onClick={() => setSlice('all')} icon={LuLayers}>All</FilterChip>
          <FilterChip active={slice === 'deadlines'} onClick={() => setSlice(slice === 'deadlines' ? 'all' : 'deadlines')} icon={LuAlarmClock}>Deadlines only</FilterChip>
          <FilterChip active={slice === 'flagged'} onClick={() => setSlice(slice === 'flagged' ? 'all' : 'flagged')} icon={LuFlag}>Flagged only</FilterChip>
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <span className="text-[12px] text-ink-3">Document type</span>
          {DOC_FILTERS.map((f) => (
            <FilterChip key={f.key} active={types.includes(f.key)} onClick={() => toggleType(f.key)}>{f.label}</FilterChip>
          ))}
          <span className="tabular ml-auto text-[12px] text-ink-3">
            <b className="font-semibold text-ink">{nodes.length}</b> of {all.length} entries
            {filtered && <button onClick={clear} className="ml-2 font-medium text-primary hover:underline">Clear</button>}
          </span>
        </div>

        {view === 'timeline' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 py-3 pr-3">
              <TimelineCanvas nodes={shown} domain={all} selectedId={selId} onSelect={(n) => setSelId(n.nodeId)} hidden={hidden} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pl-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[12px] text-ink-3">Lanes</span>
                  {LANES.map((l) => (
                    <FilterChip key={l.key} active={!hidden.includes(l.key)} onClick={() => toggleLane(l.key)} count={nodes.filter((n) => laneOf(n) === l.key).length}>
                      {l.label}
                    </FilterChip>
                  ))}
                </div>
                <ShapeKey />
              </div>
            </div>
            <aside className={cn('min-h-[300px] border-line max-lg:border-t lg:border-l')} aria-label="Selected entry">
              <NodeDetail node={selected} all={all} onSelect={(n) => setSelId(n.nodeId)} />
            </aside>
          </div>
        ) : (
          <TimelineList nodes={nodes} />
        )}
      </section>
    </>
  )
}
