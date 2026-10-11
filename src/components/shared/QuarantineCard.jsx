import { useId, useState } from 'react'
import { LuShieldAlert, LuCheck, LuUserCheck, LuRotateCcw } from 'react-icons/lu'
import { DOCS } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { fmt, relTime } from '../../lib/dates'
import { Button } from '../ui/Button'
import { Badge, ConfidenceMeter } from '../ui/display'
import { Select } from '../ui/controls'
import { ReasonInput, splitUnclear, useShake } from './forms'
import { cn } from '../../lib/cn'

const SUGGEST = ['Checked the original document', 'Confirmed with the court registry', 'Confirmed by counsel']

/** Snippet with its unclear wording highlighted. */
export function UnclearSnippet({ quote }) {
  const [a, b, c] = splitUnclear(quote)
  return (
    <blockquote className="border-l-2 border-quarantine/50 pl-3 text-[13.5px] leading-relaxed text-ink">
      “{a}
      {b && <mark className="rounded-[3px] bg-quarantine-soft px-0.5 font-semibold text-quarantine underline decoration-quarantine/50 decoration-dotted underline-offset-2">{b}</mark>}
      {c}”
    </blockquote>
  )
}

/**
 * A quarantined date: the parser refused to guess. The reviewer assigns or
 * confirms the date (with a basis) in one step, or dismisses the snippet.
 */
export default function QuarantineCard({ issue, compact = false }) {
  const { resolve, reopen, toast } = useCase()
  const q = issue.item
  const r = issue.resolution
  const relative = /relative/i.test(q.reason)
  const [kind, setKind] = useState(/deadline/i.test(q.reason) ? 'deadline' : 'event')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [shake, doShake, key] = useShake()
  const id = useId()

  const confirm = () => {
    if (!date || !reason.trim()) {
      doShake()
      toast(!date ? 'Pick the date you verified first.' : 'Say how you verified this date.')
      return
    }
    resolve(issue.id, { type: 'confirmed', kind, date, reason: reason.trim() }, {
      action: 'Date confirmed',
      detail: `${q.title}: ${fmt(date)} entered as ${kind}. Basis: ${reason.trim()}`,
      message: 'Date confirmed. It now appears on the timeline, marked as confirmed by you.',
    })
  }
  const dismiss = () => {
    if (!reason.trim()) { doShake(); toast('Say why this snippet should be dismissed.'); return }
    resolve(issue.id, { type: 'dismissed', reason: reason.trim() }, { action: 'Dismissed', detail: `${q.title}: ${reason.trim()}`, message: 'Dismissed. The snippet stays in its source document.' })
  }

  return (
    <div className={cn('rounded-lg border border-line bg-surface', compact ? 'p-3.5' : 'p-4')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block text-[13.5px] font-semibold">{q.title}</b>
          <span className="tabular text-[11.5px] text-ink-3">{q.doc} · {DOCS[q.doc].name}, p. {q.page}</span>
        </div>
        <Badge color="quarantine" icon={LuShieldAlert}>{q.reason}</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_150px] sm:items-start">
        <UnclearSnippet quote={q.quote} />
        <ConfidenceMeter value={q.confidence} label="OCR confidence" />
      </div>
      <p className="mt-2.5 text-[12px] text-ink-3">
        {q.note} <span className="text-ink-2">CaseCompass will not guess this date.</span>
      </p>

      {r ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-success-soft px-3 py-2.5 text-[12.5px]">
          <LuUserCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <span className="min-w-0 flex-1 text-ink-2">
            <b className="font-medium text-ink">{r.type === 'confirmed' ? `Confirmed as ${r.kind} on ${fmt(r.date)}` : 'Dismissed'}</b> · {r.reason}
            <small className="block text-[11px] text-ink-3">{r.who}, {relTime(r.at)}</small>
          </span>
          <Button variant="ghost" size="sm" onClick={() => reopen(issue.id, issue.title)}><LuRotateCcw /> Reopen</Button>
        </div>
      ) : (
        <div key={key} className={cn('mt-3 grid gap-3 border-t border-line pt-3', shake)}>
          <div className="grid grid-cols-[1fr_1fr] gap-2.5">
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-d`} className="label">Verified date <span className="text-danger">*</span></label>
              <input id={`${id}-d`} type="date" className="field tabular" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${id}-k`} className="label">Place on timeline as</label>
              <Select id={`${id}-k`} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="event">Event</option>
                <option value="deadline">Deadline</option>
                <option value="hearing">Hearing</option>
              </Select>
            </div>
          </div>
          <ReasonInput
            id={`${id}-r`}
            label={relative ? 'Base date and how you verified it' : 'How you verified it'}
            value={reason}
            onChange={setReason}
            placeholder={relative ? 'e.g. Notice received 16.01.2026 per postal receipt; 15 days counted by counsel' : 'e.g. Checked the original stamp at the registry'}
            suggestions={relative ? [] : SUGGEST}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>Dismiss snippet</Button>
            <Button variant="primary" size="sm" onClick={confirm}><LuCheck /> Confirm date</Button>
          </div>
        </div>
      )}
    </div>
  )
}
