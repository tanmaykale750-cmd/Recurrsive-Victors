import { useMemo, useState } from 'react'
import { LuSearch, LuHistory } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { useUi } from '../../state/UiStore'
import { fmtTime } from '../../lib/dates'
import { navigate } from '../../lib/router'
import { Drawer } from '../ui/overlay'
import { EmptyState } from '../ui/display'
import { FilterChip } from '../ui/controls'

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'correction', label: 'Corrections', test: (h) => h.kind === 'correction' },
  { key: 'status', label: 'Status', test: (h) => h.kind === 'status' },
  { key: 'note', label: 'Notes', test: (h) => h.kind === 'note' },
  { key: 'flags', label: 'Flags', test: (h) => h.action === 'Flagged' || h.action === 'Quarantined' },
  { key: 'uploads', label: 'Uploads', test: (h) => h.action === 'Uploaded' || h.action === 'Extracted' },
]

/** Full case history: every flag, status change, note and correction. Nothing is deleted. */
export default function HistoryDrawer() {
  const { state } = useCase()
  const { history, setHistory } = useUi()
  const [f, setF] = useState('all')
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const test = FILTERS.find((x) => x.key === f).test
    const s = q.trim().toLowerCase()
    return [...state.history]
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter(test)
      .filter((h) => !s || `${h.action} ${h.detail} ${h.who}`.toLowerCase().includes(s))
  }, [state.history, f, q])

  return (
    <Drawer
      open={history}
      onClose={() => setHistory(false)}
      width="max-w-[640px]"
      title="Correction history"
      subtitle="Every flag, status change, note and correction, newest first. Nothing is deleted; reopening restores the original records."
    >
      <div className="sticky -top-4 z-[1] -mx-5 -mt-4 mb-2 grid gap-2.5 border-b border-line bg-surface px-5 pt-4 pb-3">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 focus-within:border-primary">
          <LuSearch className="size-4 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter history" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3" aria-label="Filter history" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((x) => (
            <FilterChip key={x.key} active={f === x.key} onClick={() => setF(x.key)}>{x.label}</FilterChip>
          ))}
        </div>
      </div>
      {list.length ? (
        <table className="w-full text-left text-[12.5px]">
          <thead className="text-[11px] text-ink-3">
            <tr>
              <th className="py-2 pr-3 font-medium">When</th>
              <th className="py-2 pr-3 font-medium">Who</th>
              <th className="py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.id} className="border-t border-line align-top">
                <td className="tabular py-2.5 pr-3 whitespace-nowrap text-ink-3">{fmtTime(h.at)}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap text-ink-2">{h.who}</td>
                <td className="py-2.5">
                  <b className="font-medium text-ink">{h.action}</b> <span className="text-ink-2">{h.detail}</span>
                  {h.issueId && (
                    <button onClick={() => { setHistory(false); navigate(`review?issue=${h.issueId}`) }} className="ml-1.5 text-[11.5px] font-medium text-primary hover:underline">
                      Open issue
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={LuHistory} title="No history matches this filter." />
      )}
    </Drawer>
  )
}
