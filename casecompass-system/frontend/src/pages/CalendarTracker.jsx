import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { LuChevronLeft, LuChevronRight, LuDownload, LuShieldAlert, LuArrowRight } from 'react-icons/lu'
import { useCase } from '../state/CaseStore'
import { buildIssues, buildNodes } from '../lib/selectors'
import { TODAY, daysFrom } from '../lib/dates'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/display'
import { FilterChip, SegmentedControl } from '../components/ui/controls'
import { MonthView, WeekView, byDate, startOfWeek, weekTitle } from '../components/calendar/CalendarParts'
import UpcomingRail from '../components/calendar/UpcomingRail'

export default function CalendarTracker() {
  const { state, toast, downloadIcs } = useCase()
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(TODAY)
  const [showEvents, setShowEvents] = useState(false)

  const nodes = useMemo(() => buildNodes(state), [state])
  /* verified only: never unresolved conflicts, missing documents or quarantined dates */
  const verified = nodes.filter((n) => n.cls !== 'conflict' && n.cls !== 'missing')
  const shown = verified.filter((n) => n.kind === 'deadline' || n.kind === 'hearing' || showEvents)
  const entries = useMemo(() => byDate(shown), [shown])
  const upcoming = verified.filter((n) => n.kind === 'deadline' && daysFrom(n.date) >= 0 && !n.fulfilled)
  const unverified = buildIssues(state).filter((i) => i.status !== 'resolved' && (i.type === 'conflict' || i.type === 'quarantine' || (i.type === 'missing' && i.item.date))).length
  const step = view === 'month' ? 'month' : 'week'

  const switchView = (v) => {
    setView(v)
    if (v === 'week') {
      const s0 = startOfWeek(cursor).format('YYYY-MM-DD')
      const s6 = startOfWeek(cursor).add(6, 'day').format('YYYY-MM-DD')
      const keys = Object.keys(entries).sort()
      const next = keys.find((k) => k >= TODAY.format('YYYY-MM-DD'))
      if (!keys.some((k) => k >= s0 && k <= s6) && next) setCursor(dayjs(next))
    }
  }
  const exportIcs = async () => {
    try {
      await downloadIcs()
      toast('Calendar file downloaded. Reminders you turned on are included as alarms.', 'ok')
    } catch (e) {
      toast(e.message)
    }
  }

  return (
    <>
      <PageHeader
        title="Calendar & Deadline Tracker"
        desc="Verified deadlines and hearings, each linked to the document that states it."
        actions={<Button variant="secondary" onClick={exportIcs}><LuDownload /> Export .ics</Button>}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <section className="card min-w-0 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="tabular mr-auto text-[16px] font-semibold">{view === 'month' ? cursor.format('MMMM YYYY') : weekTitle(cursor)}</h2>
            <FilterChip active={showEvents} onClick={() => setShowEvents((s) => !s)}>Show verified events</FilterChip>
            <SegmentedControl size="sm" label="Calendar view" value={view} onChange={switchView} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]} />
            <div className="flex items-center">
              <Button variant="ghost" size="icon" aria-label={`Previous ${step}`} onClick={() => setCursor((c) => c.subtract(1, step))}><LuChevronLeft /></Button>
              <Button variant="secondary" size="sm" onClick={() => setCursor(TODAY)}>Today</Button>
              <Button variant="ghost" size="icon" aria-label={`Next ${step}`} onClick={() => setCursor((c) => c.add(1, step))}><LuChevronRight /></Button>
            </div>
          </div>
          <div key={view + (view === 'month' ? cursor.format('YYYY-MM') : startOfWeek(cursor).format('YYYY-MM-DD'))} className="animate-fade">
            {view === 'month' ? <MonthView cursor={cursor} entries={entries} /> : <WeekView cursor={cursor} entries={entries} />}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-danger" /> Due within {state.settings.red} days</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-warning" /> Within {state.settings.amber} days</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-success" /> Later</span>
              <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" /> Hearing</span>
            </div>
            {unverified > 0 && (
              <a href="#/review" className="group inline-flex items-center gap-1.5 text-[12px] text-ink-2 hover:text-ink">
                <LuShieldAlert className="size-3.5 text-quarantine" />
                <span className="tabular">{unverified} unverified dates are not shown</span>
                <span className="inline-flex items-center gap-0.5 font-medium text-primary">Review <LuArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" /></span>
              </a>
            )}
          </div>
        </section>
        <UpcomingRail deadlines={upcoming} />
      </div>
    </>
  )
}
