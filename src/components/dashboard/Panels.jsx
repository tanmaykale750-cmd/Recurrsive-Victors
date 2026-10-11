import { useState } from 'react'
import {
  LuBellRing, LuCloudUpload, LuScanText, LuFlag, LuShieldAlert, LuMessageSquareText, LuHistory, LuUserCheck, LuRotateCcw, LuCircleCheck,
} from 'react-icons/lu'
import { ONGOING_CASES, PAST_CASES, ACTIVE_CASE } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { useUi } from '../../state/UiStore'
import { buildIssues, upcomingDeadlines } from '../../lib/selectors'
import { countdown, fmt, fmtShort, relTime } from '../../lib/dates'
import { ISSUE_META } from '../../lib/kinds'
import { navigate } from '../../lib/router'
import { Button } from '../ui/Button'
import { Card, Citation, DateBlock, EmptyState, IssueStatus } from '../ui/display'
import { SegmentedControl } from '../ui/controls'
import { cn } from '../../lib/cn'

const rowCls = 'group flex h-9 w-full items-center gap-3 rounded-md px-2 text-left transition-colors hover:bg-surface-2'

export function NeedsAttention() {
  const { state } = useCase()
  const open = buildIssues(state).filter((i) => i.status !== 'resolved')
  return (
    <Card title="Needs attention" desc="Flagged issues waiting for a decision" actions={<Button href="#/review" variant="link" size="sm">View all {open.length}</Button>} bodyClassName="px-2 pb-2">
      {open.length ? (
        <ul>
          {open.slice(0, 5).map((i) => (
            <li key={i.id}>
              <button onClick={() => navigate(`review?issue=${i.id}`)} className={rowCls}>
                <span className="size-2 shrink-0 rounded-full" style={{ background: ISSUE_META[i.type].color }} />
                <span className="min-w-0 flex-1 truncate text-[13px]">{i.title}</span>
                <span className="hidden w-[118px] shrink-0 truncate text-[12px] text-ink-3 lg:block">{ISSUE_META[i.type].label}</span>
                <IssueStatus status={i.status} className="w-[74px] shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={LuCircleCheck} title="Everything flagged has been reviewed." className="mx-2" />
      )}
    </Card>
  )
}

export function NextDeadlines() {
  const { state, openSource } = useCase()
  const list = upcomingDeadlines(state).slice(0, 3)
  return (
    <Card title="Next deadlines" desc="Verified, stated in the record" actions={<Button href="#/calendar" variant="link" size="sm">Calendar</Button>} bodyClassName="px-2 pb-2">
      <ul className="grid gap-0.5">
        {list.map((d) => (
          <li key={d.nodeId}>
            <button onClick={() => openSource(d.nodeId)} className="flex w-full items-center gap-3 rounded-md px-2 py-[7px] text-left transition-colors hover:bg-surface-2">
              <DateBlock date={d.date} color={d.cls} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{d.title}</span>
                <span className="flex items-center gap-2">
                  <Citation doc={d.doc} page={d.page} />
                  {state.reminders[d.id]?.on && <LuBellRing className="size-3.5 text-primary" aria-label="Reminder on" />}
                </span>
              </span>
              <span className="tabular shrink-0 text-[12px] font-semibold" style={{ color: `var(--${d.cls === 'red' ? 'danger' : d.cls === 'amber' ? 'warning' : 'success'})` }}>
                {countdown(d.date)}
              </span>
            </button>
          </li>
        ))}
        {!list.length && <EmptyState title="No upcoming deadlines are stated in the record." className="mx-2" />}
      </ul>
    </Card>
  )
}

const ACT_ICON = {
  Uploaded: LuCloudUpload, Extracted: LuScanText, Flagged: LuFlag, Quarantined: LuShieldAlert, 'Note added': LuMessageSquareText,
  'Status changed': LuHistory, Reopened: LuRotateCcw,
}

export function RecentActivity() {
  const { state } = useCase()
  const { setHistory } = useUi()
  const list = [...state.history].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5)
  return (
    <Card title="Recent activity" desc="Uploads, flags and reviewer changes" actions={<Button variant="link" size="sm" onClick={() => setHistory(true)}>Full history</Button>} bodyClassName="px-2 pb-2">
      <ul>
        {list.map((h) => {
          const Icon = ACT_ICON[h.action] || LuUserCheck
          return (
            <li key={h.id} className="flex h-9 items-center gap-3 px-2">
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-md', h.who === 'CaseCompass' ? 'bg-surface-2 text-ink-3' : 'bg-primary-soft text-primary')}>
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]" title={`${h.action}: ${h.detail}`}>
                <span className="font-medium">{h.action}</span> <span className="text-ink-2">{h.detail}</span>
              </span>
              <span className="tabular shrink-0 text-[11.5px] text-ink-3">{relTime(h.at)}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Stages({ n, total = 5 }) {
  return (
    <span className="flex gap-0.5" aria-label={`Stage ${n} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-1 w-4 rounded-full', i < n ? 'bg-primary' : 'bg-line')} />
      ))}
    </span>
  )
}

export function CasesList() {
  const { toast } = useCase()
  const [tab, setTab] = useState('ongoing')
  return (
    <Card
      title="Cases"
      desc={tab === 'ongoing' ? 'Matters you are organising' : 'Closed matters, read-only'}
      actions={<SegmentedControl size="sm" value={tab} onChange={setTab} label="Case list" options={[{ value: 'ongoing', label: 'Ongoing', count: ONGOING_CASES.length }, { value: 'closed', label: 'Closed', count: PAST_CASES.length }]} />}
      bodyClassName="px-2 pb-2"
    >
      <ul>
        {tab === 'ongoing'
          ? ONGOING_CASES.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => (c.active ? navigate('timeline') : toast(`Demo data is loaded only for ${ACTIVE_CASE.no}.`))}
                  className={cn('flex w-full items-center gap-3 rounded-md px-2 py-[9px] text-left transition-colors hover:bg-surface-2', c.active && 'bg-primary-soft/60')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{c.title}</span>
                      {c.active && <span className="shrink-0 rounded bg-primary-soft px-1 text-[10.5px] font-semibold text-primary">Open</span>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-3">
                      <Stages n={c.stage} />
                      <span className="truncate">{c.stageName}</span>
                    </span>
                  </span>
                  <span className="tabular flex shrink-0 items-center gap-3 text-[11.5px] text-ink-3">
                    <span title="Date conflicts"><b className={cn('font-semibold', c.conflicts ? 'text-danger' : 'text-ink-3')}>{c.conflicts}</b> conf.</span>
                    <span title="Missing documents"><b className={cn('font-semibold', c.missing ? 'text-warning' : 'text-ink-3')}>{c.missing}</b> miss.</span>
                    <span className="hidden w-[52px] text-right xl:inline" title="Next deadline">{fmtShort(c.next)}</span>
                  </span>
                </button>
              </li>
            ))
          : PAST_CASES.map((c) => (
              <li key={c.id}>
                <button onClick={() => toast(`Archived chronology for ${c.no} opens here.`)} className="flex w-full items-center gap-3 rounded-md px-2 py-[9px] text-left transition-colors hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{c.title}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{c.no} · {c.last}</span>
                  </span>
                  <span className="tabular shrink-0 text-[11.5px] text-ink-3">Closed {fmt(c.closed)}</span>
                </button>
              </li>
            ))}
      </ul>
    </Card>
  )
}

