import { LuArrowRight, LuFileSearch, LuMousePointerClick, LuArrowLeftRight } from 'react-icons/lu'
import { DOCS } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { buildIssues } from '../../lib/selectors'
import { countdown, daysFrom, fmt } from '../../lib/dates'
import { navigate } from '../../lib/router'
import { Button } from '../ui/Button'
import { Badge, Citation, EmptyState } from '../ui/display'
import { Decorated, Quote } from '../ui/JargonTerm'
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
  const d = DOCS[node.doc]
  return (
    <div key={node.nodeId} className="animate-fade flex h-full flex-col p-4">
      <Badge color={node.cls}>{kindLabel(node)}</Badge>
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
          <span className="min-w-0 truncate text-[12px] text-ink-2">{d.name}</span>
        </div>
        <Quote text={node.quote} className="mx-3 my-2.5" />
      </div>

      {sibling && (
        <button onClick={() => onSelect(sibling)} className="mt-3 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-left text-[12.5px] text-ink-2 transition-colors hover:text-ink">
          <LuArrowLeftRight className="size-4 shrink-0 text-danger" />
          <span>
            Record {'AB'[sibling.ci]} gives <b className="font-medium text-ink">{fmt(sibling.date)}</b>. Both are kept; neither is chosen automatically.
          </span>
        </button>
      )}
      {node.cls === 'missing' && <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-ink-2">{node.why}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => openSource(node.nodeId)}>
          <LuFileSearch /> Open source
        </Button>
        {issue && issue.status !== 'resolved' && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`review?issue=${issue.id}`)}>
            Go to issue <LuArrowRight />
          </Button>
        )}
      </div>
      <p className="mt-auto pt-4 text-[11px] text-ink-3">Tip: use ← → to move between entries.</p>
    </div>
  )
}
