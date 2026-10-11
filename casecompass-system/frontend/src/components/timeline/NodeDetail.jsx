import { LuArrowRight, LuFileSearch, LuMousePointerClick, LuArrowLeftRight, LuCircleCheck, LuSparkles } from 'react-icons/lu'
import { DOCS, RECORD } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { buildIssues, findEntity } from '../../lib/selectors'
import { countdown, daysFrom, fmt } from '../../lib/dates'
import { navigate } from '../../lib/router'
import { Button } from '../ui/Button'
import { Badge, Citation, EmptyState } from '../ui/display'
import { Decorated, Quote } from '../ui/JargonTerm'
import { CorrectDateForm, CorrectionSummary, ReviewTrail } from '../shared/ReviewTrail'
import { kindLabel } from './model'

/** Right-hand panel for the selected timeline entry (not a modal). */
export default function NodeDetail({ node, all, onSelect }) {
  const { state, openSource } = useCase()
  if (!node)
    return (
      <div className="grid h-full place-items-center p-4">
        <EmptyState icon={LuMousePointerClick} title="Select a point on the timeline to read its source sentence." className="border-0" />
      </div>
    )
  const issue = buildIssues(state).find((i) => i.id === node.id)
  const sibling = node.cls === 'conflict' ? all.find((n) => n.id === node.id && n.nodeId !== node.nodeId) : null
  const stated = findEntity(node.id)?.kind === 'item'
  const d = DOCS[node.doc]
  return (
    <div key={node.nodeId} className="animate-fade flex h-full flex-col p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge color={node.cls}>{kindLabel(node)}</Badge>
        {node.fulfilled && <Badge color="success" icon={LuCircleCheck}>Completed on record</Badge>}
        {node.method === 'ai' && <Badge color="brass" icon={LuSparkles}>AI title</Badge>}
      </div>
      <h3 className="mt-2 text-[15px] leading-snug font-semibold">
        <Decorated text={node.title} />
      </h3>
      <p className="tabular mt-1 text-[12.5px] text-ink-2">
        {fmt(node.date)}
        {node.kind === 'deadline' && daysFrom(node.date) >= 0 && <span className="text-ink-3"> · {countdown(node.date)}</span>}
        {node.party && <span className="text-ink-3"> · {node.party}</span>}
      </p>

      <div className="mt-4 rounded-lg border border-line">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Citation doc={node.doc} page={node.page} />
          <span className="min-w-0 truncate text-[12px] text-ink-2">{d?.name}</span>
        </div>
        <Quote text={node.quote} className="mx-3 my-2.5" />
      </div>

      {node.corrected && (
        <div className="mt-3">
          <CorrectionSummary id={node.id} title={node.title} originalDates={node.originalDates} labels={node.originalDates?.length > 1 ? node.originalDates.map((_, i) => `Record ${RECORD[i]}`) : undefined} />
        </div>
      )}
      {node.sources?.length > 0 && <p className="mt-2 text-[11.5px] text-ink-3">Also stated in {node.sources.map((x) => `${x.doc} p.${x.page}`).join(', ')}</p>}
      {node.fulfilled && <p className="mt-1 text-[11.5px] text-ink-3">{node.fulfilled.title} on {fmt(node.fulfilled.date)} ({node.fulfilled.doc}).</p>}
      {node.dateSource === 'order_date' && <p className="mt-1 text-[11.5px] text-ink-3">Date taken from the order this sentence appears in.</p>}

      {sibling && (
        <button onClick={() => onSelect(sibling)} className="mt-3 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-left text-[12.5px] text-ink-2 transition-colors hover:text-ink">
          <LuArrowLeftRight className="size-4 shrink-0 text-danger" />
          <span>
            Record {RECORD[sibling.ci]} gives <b className="font-medium text-ink">{fmt(sibling.date)}</b>. Both are kept; neither is chosen automatically.
          </span>
        </button>
      )}
      {node.cls === 'missing' && <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-ink-2">{node.why}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => openSource(node.nodeId)}>
          <LuFileSearch /> Open source
        </Button>
        {issue && issue.status !== 'resolved' && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`review?issue=${issue.id}`)}>
            Go to issue <LuArrowRight />
          </Button>
        )}
        {stated && !node.corrected && <CorrectDateForm key={node.id} item={findEntity(node.id).entity} />}
      </div>

      <ReviewTrail key={node.id} id={node.id} title={node.title} compact className="mt-4 border-t border-line pt-3" />
      <p className="mt-auto pt-4 text-[11px] text-ink-3">Tip: use ← → to move between entries.</p>
    </div>
  )
}
