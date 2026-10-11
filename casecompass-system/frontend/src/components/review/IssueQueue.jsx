import { useRef } from 'react'
import { LuListChecks } from 'react-icons/lu'
import { ISSUE_META } from '../../lib/kinds'
import { Tabs, SegmentedControl } from '../ui/controls'
import { EmptyState, IssueStatus } from '../ui/display'
import { TYPE_ICON } from './IssueDetail'
import { cn } from '../../lib/cn'

export const TABS = [
  { value: 'conflict', label: 'Conflicts', match: (i) => i.type === 'conflict' },
  { value: 'missing', label: 'Missing', match: (i) => i.type === 'missing' },
  { value: 'quarantine', label: 'Quarantined', match: (i) => i.type === 'quarantine' },
  { value: 'gaps', label: 'Gaps', match: (i) => i.type === 'undated' || i.type === 'sequence' },
]
export const tabOf = (issue) => TABS.find((t) => t.match(issue))?.value || 'conflict'

const STATUS_FILTERS = [
  { value: 'active', label: 'Needs action', test: (i) => i.status !== 'resolved' },
  { value: 'in_review', label: 'In review', test: (i) => i.status === 'in_review' },
  { value: 'resolved', label: 'Resolved', test: (i) => i.status === 'resolved' },
  { value: 'all', label: 'All', test: () => true },
]

/** Left pane: issue tabs, status filter and a keyboard-navigable list. */
export default function IssueQueue({ issues, tab, setTab, statusF, setStatusF, selectedId, onSelect }) {
  const refs = useRef({})
  const tabDef = TABS.find((t) => t.value === tab) || TABS[0]
  const test = STATUS_FILTERS.find((s) => s.value === statusF).test
  const list = issues.filter(tabDef.match).filter(test)

  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const i = list.findIndex((x) => x.id === selectedId)
    const j = Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
    if (list[j]) {
      onSelect(list[j].id)
      refs.current[list[j].id]?.focus()
    }
  }

  return (
    <div className="card flex min-h-0 flex-col">
      <div className="px-4 pt-3">
        <Tabs value={tab} onChange={setTab} tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: issues.filter(t.match).filter((i) => i.status !== 'resolved').length }))} />
      </div>
      <div className="px-4 pt-3 pb-2">
        <SegmentedControl size="sm" label="Status filter" value={statusF} onChange={setStatusF} options={STATUS_FILTERS} className="w-full [&>button]:flex-1 [&>button]:justify-center" />
      </div>
      <ul onKeyDown={onKey} className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto px-2 pb-2" aria-label="Issues">
        {list.map((i) => {
          const Icon = TYPE_ICON[i.type]
          const on = i.id === selectedId
          return (
            <li key={i.id}>
              <button
                ref={(el) => (refs.current[i.id] = el)}
                onClick={() => onSelect(i.id)}
                tabIndex={on || (!selectedId && i === list[0]) ? 0 : -1}
                aria-current={on ? 'true' : undefined}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors', on ? 'bg-primary-soft' : 'hover:bg-surface-2')}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in srgb, ${ISSUE_META[i.type].color} 11%, var(--surface))`, color: ISSUE_META[i.type].color }}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px]', on ? 'font-semibold text-ink' : 'font-medium')}>{i.title}</span>
                  <span className="block truncate text-[11.5px] text-ink-3">{ISSUE_META[i.type].label}</span>
                </span>
                <IssueStatus status={i.status} />
              </button>
            </li>
          )
        })}
        {!list.length && (
          <EmptyState icon={LuListChecks} title={statusF === 'active' ? 'Nothing left to act on here. Switch to Resolved or All to see past decisions.' : 'No issues match this filter.'} className="m-2" />
        )}
      </ul>
    </div>
  )
}
