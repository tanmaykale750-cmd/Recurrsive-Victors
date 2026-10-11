import { LuBellRing, LuBellOff } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { countdown } from '../../lib/dates'
import { Card, Citation, DateBlock, EmptyState } from '../ui/display'
import { Switch } from '../ui/controls'
import { cn } from '../../lib/cn'

const LEADS = [7, 3, 1]

function Row({ d }) {
  const { state, setReminder, toast, openSource } = useCase()
  const r = state.reminders[d.id] || { on: false, days: [7, 1] }
  const toggleLead = (n) => {
    const days = r.days.includes(n) ? r.days.filter((x) => x !== n) : [...r.days, n].sort((a, b) => b - a)
    setReminder(d.id, { days })
  }
  return (
    <li className="py-2.5">
      <div className="flex items-start gap-3">
        <button onClick={() => openSource(d.nodeId)} aria-label={`Open source for ${d.title}`}>
          <DateBlock date={d.date} color={d.cls} size="sm" />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => openSource(d.nodeId)} className="block w-full truncate text-left text-[13px] font-medium hover:text-primary" title={d.title}>{d.title}</button>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="tabular text-[11.5px] font-medium" style={{ color: `var(--${d.cls === 'red' ? 'danger' : d.cls === 'amber' ? 'warning' : 'success'})` }}>{countdown(d.date)}</span>
            <Citation doc={d.doc} page={d.page} />
          </div>
        </div>
        <Switch
          size="sm"
          className="mt-1"
          checked={r.on}
          onChange={(on) => { setReminder(d.id, { on }); toast(on ? `Reminder on for ${d.title}` : 'Reminder off') }}
          label={`Reminder for ${d.title}`}
        />
      </div>
      {r.on && (
        <div className="animate-fade mt-2 ml-12 flex flex-wrap items-center gap-1 text-[11.5px] text-ink-3">
          <LuBellRing className="mr-0.5 size-3.5 text-primary" />
          {LEADS.map((n) => (
            <button
              key={n}
              onClick={() => toggleLead(n)}
              aria-pressed={r.days.includes(n)}
              className={cn('tabular rounded-full border px-2 leading-[20px] font-medium transition-colors', r.days.includes(n) ? 'border-primary bg-primary-soft text-primary' : 'border-line hover:border-line-strong')}
            >
              {n}d
            </button>
          ))}
          <span>before</span>
        </div>
      )}
    </li>
  )
}

/** Right rail: verified deadlines with optional reminders. */
export default function UpcomingRail({ deadlines }) {
  return (
    <Card title="Upcoming" desc="Verified deadlines · reminders are optional" bodyClassName="pb-2">
      {deadlines.length ? (
        <ul className="divide-y divide-line">{deadlines.map((d) => <Row key={d.nodeId} d={d} />)}</ul>
      ) : (
        <EmptyState title="No upcoming deadlines are stated in the record." />
      )}
      <p className="mt-2 flex items-start gap-2 border-t border-line pt-2.5 text-[11.5px] text-ink-3">
        <LuBellOff className="mt-px size-3.5 shrink-0" /> Relative deadlines such as “within two weeks” never appear here until a reviewer confirms a date.
      </p>
    </Card>
  )
}
