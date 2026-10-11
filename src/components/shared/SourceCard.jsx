import { DOCS } from '../../data/caseData'
import { Quote } from '../ui/JargonTerm'
import { cn } from '../../lib/cn'

/** Document + page + the exact sentence. Every item in the app carries one of these. */
export default function SourceCard({ doc, page, quote, label, children, className, selected }) {
  const d = DOCS[doc]
  return (
    <div className={cn('overflow-hidden rounded-lg border bg-surface transition-colors', selected ? 'border-primary ring-2 ring-primary/15' : 'border-line', className)}>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
        <span className="tabular rounded border border-line bg-surface px-1 font-mono text-[10.5px] font-semibold text-ink-2">{doc}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">{d?.name}</span>
          <span className="tabular block text-[11px] text-ink-3">
            {label ? `${label} · ` : ''}p. {page} of {d?.pages} · {d?.type}
          </span>
        </span>
      </div>
      <div className="px-3 py-2.5">
        <Quote text={quote} />
      </div>
      {children}
    </div>
  )
}
