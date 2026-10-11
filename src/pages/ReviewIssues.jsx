import { useEffect, useMemo, useState } from 'react'
import { LuHistory, LuShieldAlert } from 'react-icons/lu'
import { useCase } from '../state/CaseStore'
import { useUi } from '../state/UiStore'
import { buildIssues } from '../lib/selectors'
import { useRoute } from '../lib/router'
import { Button } from '../components/ui/Button'
import { PageHeader, Progress, StatusDot } from '../components/ui/display'
import IssueQueue, { TABS, tabOf } from '../components/review/IssueQueue'
import IssueDetail from '../components/review/IssueDetail'
import { cn } from '../lib/cn'

export default function ReviewIssues() {
  const { state } = useCase()
  const { setHistory, setQuarantine } = useUi()
  const { query } = useRoute()
  const issues = useMemo(() => buildIssues(state), [state])

  const initialTab = () => {
    const t = query.get('tab')
    if (t) return t === 'undated' || t === 'sequence' ? 'gaps' : t
    const i = issues.find((x) => x.id === query.get('issue'))
    if (i) return tabOf(i)
    return TABS.find((tb) => issues.some((x) => tb.match(x) && x.status !== 'resolved'))?.value || 'conflict'
  }
  const [tab, setTab] = useState(initialTab)
  const [statusF, setStatusF] = useState(query.get('issue') ? 'all' : 'active')
  const [selId, setSelId] = useState(query.get('issue'))
  const [mobileDetail, setMobileDetail] = useState(!!query.get('issue'))

  /* deep links: ?tab= and ?issue= */
  useEffect(() => {
    const i = issues.find((x) => x.id === query.get('issue'))
    const t = query.get('tab')
    if (i) { setTab(tabOf(i)); setSelId(i.id); setStatusF('all'); setMobileDetail(true) }
    else if (t) { setTab(t === 'undated' || t === 'sequence' ? 'gaps' : t); setSelId(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.toString()])

  /* keep a sensible selection within the current tab (but don't jump away after resolving) */
  const inTab = issues.filter((TABS.find((t) => t.value === tab) || TABS[0]).match)
  useEffect(() => {
    if (!selId || !inTab.some((i) => i.id === selId)) {
      const next = inTab.find((i) => i.status !== 'resolved') || inTab[0]
      setSelId(next?.id || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const selected = issues.find((i) => i.id === selId) || null
  const done = issues.filter((i) => i.status === 'resolved').length
  const by = (s) => issues.filter((i) => i.status === s).length
  const qOpen = issues.filter((i) => i.type === 'quarantine' && i.status !== 'resolved').length

  return (
    <>
      <PageHeader
        title="Review & Resolve Issues"
        desc="Decide on conflicts, missing documents and unclear dates. Every decision needs a reason and can be reopened."
        actions={
          <>
            <Button variant="secondary" onClick={() => setQuarantine(true)}>
              <LuShieldAlert className="text-quarantine" /> Quarantined dates
              <span className="tabular rounded-full bg-quarantine-soft px-1.5 text-[11px] leading-[18px] font-semibold text-quarantine">{qOpen}</span>
            </Button>
            <Button variant="secondary" onClick={() => setHistory(true)}><LuHistory /> History</Button>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
            <Progress value={(done / issues.length) * 100} color="var(--success)" className="w-40 sm:w-56" label="Issues resolved" />
            <span className="tabular text-[12.5px] text-ink-2"><b className="font-semibold text-ink">{done} of {issues.length}</b> resolved</span>
          </div>
          <span className="flex gap-3">
            <StatusDot color="danger"><span className="tabular">{by('open')}</span> open</StatusDot>
            <StatusDot color="warning"><span className="tabular">{by('in_review')}</span> in review</StatusDot>
            <StatusDot color="success"><span className="tabular">{done}</span> resolved</StatusDot>
          </span>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        <div className={cn('lg:sticky lg:top-[72px] lg:h-[calc(100dvh-88px)] lg:max-h-[720px]', mobileDetail && 'max-lg:hidden')}>
          <IssueQueue
            issues={issues}
            tab={tab}
            setTab={(t) => { setTab(t); if (statusF === 'all' && query.get('issue')) setStatusF('active') }}
            statusF={statusF}
            setStatusF={setStatusF}
            selectedId={selId}
            onSelect={(id) => { setSelId(id); setMobileDetail(true) }}
          />
        </div>
        <div className={cn('min-w-0', !mobileDetail && 'max-lg:hidden')}>
          <IssueDetail issue={selected} onBack={() => setMobileDetail(false)} />
        </div>
      </div>
    </>
  )
}
