import dayjs from 'dayjs'
import { LuListChecks, LuFileDown } from 'react-icons/lu'
import { ACTIVE_CASE, ONGOING_CASES, REVIEWER, STAGES } from '../data/caseData'
import { useCase } from '../state/CaseStore'
import { issueCounts, upcomingDeadlines } from '../lib/selectors'
import { daysFrom } from '../lib/dates'
import { Button } from '../components/ui/Button'
import CaseHealth from '../components/dashboard/CaseHealth'
import { CasesList, NeedsAttention, NextDeadlines, RecentActivity } from '../components/dashboard/Panels'
import { cn } from '../lib/cn'

function CaseHeader() {
  const { state } = useCase()
  const c = ONGOING_CASES.find((x) => x.active)
  const stages = STAGES[ACTIVE_CASE.type].list
  const soon = upcomingDeadlines(state).filter((d) => daysFrom(d.date) <= 14).length
  const open = issueCounts(state).open
  const h = dayjs().hour()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return (
    <div className="mb-3">
      <p className="text-[13px] text-ink-3">
        {greet}, {REVIEWER.split(' ')[0]} — {soon} deadline{soon === 1 ? '' : 's'} in the next 14 days, {open} issue{open === 1 ? '' : 's'} to review.
      </p>
      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] sm:text-[24px]">{ACTIVE_CASE.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-2">
            <span className="tabular">{ACTIVE_CASE.no}</span>
            <span className="text-line-strong">·</span>
            <span>{ACTIVE_CASE.court}</span>
            <span className="text-line-strong">·</span>
            <span className="flex items-center gap-2" aria-label={`Stage ${c.stage} of ${stages.length}: ${c.stageName}`}>
              <span className="flex gap-1">
                {stages.map((s, i) => (
                  <span key={s.n} title={`${i + 1}. ${s.n}`} className={cn('h-1.5 w-6 rounded-full', i < c.stage - 1 ? 'bg-primary/55' : i === c.stage - 1 ? 'bg-primary' : 'bg-line-strong/70')} />
                ))}
              </span>
              Stage {c.stage}: <b className="font-medium text-ink">{c.stageName}</b>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button href="#/report" variant="secondary"><LuFileDown /> Export chronology</Button>
          <Button href="#/review" variant="primary"><LuListChecks /> Review issues</Button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="min-w-0">
        <CaseHeader />
        <CaseHealth />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NeedsAttention />
        <NextDeadlines />
        <RecentActivity />
        <CasesList />
      </div>
    </div>
  )
}
