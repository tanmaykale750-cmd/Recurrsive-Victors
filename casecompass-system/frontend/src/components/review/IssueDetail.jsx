import { LuArrowLeft, LuCalendarX2, LuFileQuestion, LuShieldAlert, LuCalendarOff, LuRoute, LuInfo } from 'react-icons/lu'
import { DOCS, RECORD } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { termsIn } from '../../lib/selectors'
import { ISSUE_META, STATUS_META } from '../../lib/kinds'
import { Badge, Callout, EmptyState } from '../ui/display'
import { SegmentedControl } from '../ui/controls'
import QuarantineCard from '../shared/QuarantineCard'
import SourceCard from '../shared/SourceCard'
import { ConflictForm, GapForm, MissingForm, ResolutionCard } from './IssueForms'
import { ReviewTrail } from '../shared/ReviewTrail'

export const TYPE_ICON = { conflict: LuCalendarX2, missing: LuFileQuestion, quarantine: LuShieldAlert, undated: LuCalendarOff, sequence: LuRoute }

const WHY = {
  conflict: 'Two records give different dates for the same event. Both are shown; CaseCompass does not choose.',
  quarantine: 'This date could not be read with confidence, so it was kept off the timeline instead of being guessed.',
}

function Terms({ terms }) {
  if (!terms.length) return <p className="text-[12.5px] text-ink-3">No glossary terms appear in this issue’s sentences.</p>
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {terms.map((t) => (
        <div key={t.term} className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]">
          <dt className="font-medium text-ink">{t.term}</dt>
          <dd className="text-ink-2">{t.def}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function IssueDetail({ issue, onBack }) {
  const { setStatus, toast } = useCase()
  if (!issue) return <EmptyState title="Select an issue from the list." className="h-full min-h-[300px]" />
  const meta = ISSUE_META[issue.type]
  const Icon = TYPE_ICON[issue.type]
  const it = issue.item
  const terms = termsIn(it.dates ? it.dates.map((d) => d.quote).join(' ') : it.quote)
  const resolved = issue.status === 'resolved' && issue.resolution
  const Form = { conflict: ConflictForm, missing: MissingForm, undated: GapForm, sequence: GapForm }[issue.type]
  const changeStatus = (v) => {
    if (v === issue.status) return
    if (v === 'resolved') return toast('Record a decision below to resolve this issue. Every resolution needs a reason.')
    setStatus(issue.id, v, issue.title, STATUS_META[v].label)
  }

  return (
    <article key={issue.id} className="card p-4 sm:p-5">
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary lg:hidden">
        <LuArrowLeft className="size-3.5" /> All issues
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Badge color={meta.color} icon={Icon}>{meta.label}</Badge>
          <h2 className="mt-2 text-[18px] leading-snug">{issue.title}</h2>
          {(it.doc || it.dates) && (
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              Found in {it.dates ? it.dates.map((d) => `${DOCS[d.doc]?.name || d.doc}, p. ${d.page}`).join(' and ') : `${DOCS[it.doc]?.name || it.doc}, p. ${it.page}`}
            </p>
          )}
        </div>
        {resolved ? (
          <span className="text-[12px] text-ink-3">Resolved · reopen to change status</span>
        ) : (
          <SegmentedControl size="sm" label="Review status" value={issue.status} onChange={changeStatus} options={[{ value: 'open', label: 'Open' }, { value: 'in_review', label: 'In review' }, { value: 'resolved', label: 'Resolved' }]} />
        )}
      </div>

      <Callout icon={LuInfo} color="primary" className="mt-3">{WHY[issue.type] || it.why}</Callout>

      <div className="mt-4">
        {issue.type === 'quarantine' ? (
          <QuarantineCard issue={issue} />
        ) : resolved ? (
          <div className="grid gap-3">
            <ResolutionCard issue={issue} />
            {issue.type === 'conflict' ? (
              <div className="grid gap-3 md:grid-cols-2">
                {it.dates.map((d, i) => <SourceCard key={i} {...d} label={`Original record ${RECORD[i]}`} />)}
              </div>
            ) : (
              <SourceCard doc={it.doc} page={it.page} quote={it.quote} label="Referred to here" />
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {issue.resolution?.type === 'requested' && <ResolutionCard issue={issue} />}
            <Form issue={issue} />
          </div>
        )}
      </div>

      <ReviewTrail
        key={issue.id}
        id={issue.id}
        title={issue.title}
        className="mt-5"
        extra={[{ value: 'terms', label: 'Terms in this issue', count: terms.length, render: () => <Terms terms={terms} /> }]}
      />
    </article>
  )
}
