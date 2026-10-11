import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { LuFileSearch, LuGavel, LuAlarmClock, LuGitCommitHorizontal } from 'react-icons/lu'
import { DOCS } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { TODAY, countdown, daysFrom, fmt } from '../../lib/dates'
import { KIND_COLOR } from '../../lib/kinds'
import { Button } from '../ui/Button'
import { Citation } from '../ui/display'
import { Switch } from '../ui/controls'
import { cn } from '../../lib/cn'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const startOfWeek = (d) => d.subtract((d.day() + 6) % 7, 'day').startOf('day')

export const chipColor = (n) => (n.kind === 'hearing' ? KIND_COLOR.primary : n.kind === 'deadline' ? KIND_COLOR[n.cls] : KIND_COLOR.muted)
const KIND_ICON = { hearing: LuGavel, deadline: LuAlarmClock, event: LuGitCommitHorizontal }

/** Calendar entries keyed by YYYY-MM-DD. */
export function byDate(nodes) {
  const map = {}
  nodes.forEach((n) => (map[n.date] = map[n.date] || []).push(n))
  return map
}

/** Popover body for one calendar entry. */
function EntryCard({ n, close }) {
  const { state, openSource, setReminder } = useCase()
  const rem = state.reminders[n.id]
  const canRemind = n.kind === 'deadline' && daysFrom(n.date) >= 0
  const Icon = KIND_ICON[n.kind] || LuGitCommitHorizontal
  return (
    <div className="w-[290px] p-3.5">
      <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: chipColor(n) }}>
        <Icon className="size-3.5" /> {n.kind === 'deadline' ? 'Deadline' : n.kind === 'hearing' ? 'Hearing' : 'Event'}
        {n.confirmed && <span className="text-success">· confirmed by reviewer</span>}
      </span>
      <h3 className="mt-1 text-[14px] leading-snug font-semibold">{n.title}</h3>
      <p className="tabular mt-0.5 text-[12px] text-ink-2">
        {fmt(n.date)}{canRemind && ` · ${countdown(n.date)}`}{n.party && ` · ${n.party}`}
      </p>
      <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
        <Citation doc={n.doc} page={n.page} />
        <span className="min-w-0 truncate text-[12px] text-ink-3">{DOCS[n.doc].name}</span>
      </div>
      {canRemind && (
        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-md bg-surface-2 px-2.5 py-2">
          <span className="text-[12.5px]">Reminder</span>
          <Switch size="sm" checked={!!rem?.on} onChange={(on) => setReminder(n.id, { on, days: rem?.days?.length ? rem.days : [7, 1] })} label={`Reminder for ${n.title}`} />
        </div>
      )}
      <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => { close(); openSource(n.nodeId) }}>
        <LuFileSearch /> Open source document
      </Button>
    </div>
  )
}

function Chip({ n, block }) {
  return (
    <Popover className="min-w-0">
      <PopoverButton
        style={{ '--c': chipColor(n) }}
        className={cn(
          'bg-c-soft flex w-full min-w-0 items-center gap-1.5 rounded px-1.5 text-left text-[11.5px] text-ink transition-[filter] hover:brightness-95 data-open:ring-2 data-open:ring-[var(--c)]/30',
          block ? 'py-1.5' : 'h-[22px]',
        )}
        title={n.title}
      >
        <span className="bg-c size-1.5 shrink-0 rounded-full" />
        <span className={cn('min-w-0', block ? 'line-clamp-3 leading-snug' : 'truncate')}>{n.title}</span>
      </PopoverButton>
      <PopoverPanel anchor={{ to: 'bottom start', gap: 6 }} transition className="z-50 rounded-lg border border-line bg-surface shadow-float transition duration-100 data-closed:opacity-0">
        {({ close }) => <EntryCard n={n} close={close} />}
      </PopoverPanel>
    </Popover>
  )
}

function More({ list }) {
  return (
    <Popover>
      <PopoverButton className="px-1.5 text-[11px] font-medium text-ink-3 hover:text-primary">+{list.length} more</PopoverButton>
      <PopoverPanel anchor={{ to: 'bottom start', gap: 6 }} transition className="z-50 grid w-[240px] gap-1 rounded-lg border border-line bg-surface p-2 shadow-float transition duration-100 data-closed:opacity-0">
        {list.map((n) => <Chip key={n.nodeId} n={n} />)}
      </PopoverPanel>
    </Popover>
  )
}

export function MonthView({ cursor, entries }) {
  const first = cursor.startOf('month')
  const gridStart = startOfWeek(first)
  const weeks = Math.ceil((((first.day() + 6) % 7) + first.daysInMonth()) / 7)
  const days = Array.from({ length: weeks * 7 }, (_, i) => gridStart.add(i, 'day'))
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="grid grid-cols-7 border-b border-line bg-surface-2/50">
        {DOW.map((d) => <span key={d} className="px-2 py-1.5 text-[11.5px] font-medium text-ink-3">{d}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = d.format('YYYY-MM-DD')
          const list = entries[key] || []
          const inMonth = d.month() === cursor.month()
          const today = d.isSame(TODAY, 'day')
          return (
            <div key={key} className={cn('flex min-h-[64px] min-w-0 flex-col gap-1 border-line p-1.5 sm:min-h-[100px]', i % 7 && 'border-l', i >= 7 && 'border-t', !inMonth && 'bg-surface-2/40')} aria-label={`${d.format('D MMMM')}, ${list.length} entries`}>
              <span className={cn('tabular grid size-6 place-items-center rounded-full text-[12px]', today ? 'bg-primary font-semibold text-on-primary' : inMonth ? 'text-ink-2' : 'text-ink-3')}>{d.date()}</span>
              <div className="hidden min-w-0 flex-col gap-1 sm:flex">
                {list.slice(0, 2).map((n) => <Chip key={n.nodeId} n={n} />)}
                {list.length > 2 && <More list={list.slice(2)} />}
              </div>
              <div className="flex flex-wrap gap-1 sm:hidden">
                {list.map((n) => <span key={n.nodeId} className="size-1.5 rounded-full" style={{ background: chipColor(n) }} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WeekView({ cursor, entries }) {
  const s = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => s.add(i, 'day'))
  return (
    <div className="grid overflow-hidden rounded-lg border border-line sm:grid-cols-7">
      {days.map((d, i) => {
        const list = entries[d.format('YYYY-MM-DD')] || []
        const today = d.isSame(TODAY, 'day')
        return (
          <div key={i} className={cn('flex min-w-0 flex-col border-line sm:min-h-[360px]', i && 'max-sm:border-t sm:border-l', today && 'bg-primary-soft/40')}>
            <div className="flex items-baseline gap-1.5 border-b border-line px-2 py-1.5">
              <span className="text-[11.5px] font-medium text-ink-3">{DOW[i]}</span>
              <span className={cn('tabular grid size-6 place-items-center rounded-full text-[13px] font-medium', today && 'bg-primary text-on-primary')}>{d.date()}</span>
            </div>
            <div className="grid content-start gap-1 p-1.5">
              {list.map((n) => <Chip key={n.nodeId} n={n} block />)}
              {!list.length && <span className="px-1 py-1 text-[11.5px] text-ink-3/70 max-sm:hidden">—</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export const weekTitle = (cursor) => {
  const s = startOfWeek(cursor)
  const e = s.add(6, 'day')
  return s.month() === e.month() ? `${s.format('D')}–${e.format('D MMMM YYYY')}` : `${s.format('D MMM')} – ${e.format('D MMM YYYY')}`
}
