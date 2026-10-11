import { useId, useState } from 'react'
import { LuCheck, LuUserCheck, LuRotateCcw, LuSend, LuLink, LuBan } from 'react-icons/lu'
import { DOCS } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { fmt, relTime } from '../../lib/dates'
import { Button } from '../ui/Button'
import { Select, SegmentedControl } from '../ui/controls'
import SourceCard from '../shared/SourceCard'
import { ReasonInput } from '../shared/forms'
import { cn } from '../../lib/cn'

const panel = 'grid gap-3 rounded-lg border border-line bg-surface-2/40 p-3.5'

/** Date conflict: both records side by side; the reviewer, not the tool, picks. */
export function ConflictForm({ issue }) {
  const { resolve } = useCase()
  const it = issue.item
  const id = useId()
  const [basis, setBasis] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const pick = (i) => { setBasis('AB'[i]); setDate(it.dates[i].date) }
  const ready = basis && date && reason.trim()
  const submit = () =>
    resolve(issue.id, { type: 'corrected', date, basis, reason: reason.trim() }, {
      action: 'Correction recorded',
      detail: `${it.title}: date set to ${fmt(date)} based on ${basis === 'other' ? 'another source' : `Record ${basis}`}. Reason: ${reason.trim()}`,
      message: 'Correction recorded. Both original records stay on file.',
    })
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        {it.dates.map((d, i) => {
          const on = basis === 'AB'[i]
          return (
            <SourceCard key={i} {...d} label={`Record ${'AB'[i]}`} selected={on}>
              <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                <span className="tabular text-[17px] font-semibold text-danger">{fmt(d.date)}</span>
                <Button size="sm" variant={on ? 'primary' : 'secondary'} onClick={() => pick(i)} aria-pressed={on}>
                  {on ? <><LuCheck /> Selected</> : 'Use this date'}
                </Button>
              </div>
            </SourceCard>
          )
        })}
      </div>
      <div className={panel}>
        <div className="grid gap-3 sm:grid-cols-[160px_170px_1fr]">
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${id}-d`} className="label">Corrected date <span className="text-danger">*</span></label>
            <input id={`${id}-d`} type="date" className="field tabular" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid content-start gap-1.5">
            <label htmlFor={`${id}-b`} className="label">Based on <span className="text-danger">*</span></label>
            <Select id={`${id}-b`} value={basis} onChange={(e) => setBasis(e.target.value)}>
              <option value="" disabled>Choose…</option>
              <option value="A">Record A</option>
              <option value="B">Record B</option>
              <option value="other">Another source</option>
            </Select>
          </div>
          <ReasonInput id={`${id}-r`} value={reason} onChange={setReason} placeholder="e.g. Matches the process server's signed report" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12px] text-ink-3">Original records stay unchanged; your correction is logged with your name.</span>
          <Button variant="primary" onClick={submit} disabled={!ready} title={ready ? undefined : 'Choose a date and basis, and give a reason'}>
            <LuUserCheck /> Record correction
          </Button>
        </div>
      </div>
    </div>
  )
}

const MISSING_ACTIONS = [
  { value: 'requested', label: 'Mark as requested' },
  { value: 'linked', label: 'Uploaded — link a file' },
  { value: 'not_required', label: 'Not needed' },
]

/** Missing referenced document: where it is referred to, and what the reviewer did about it. */
export function MissingForm({ issue }) {
  const { state, resolve } = useCase()
  const g = issue.item
  const id = useId()
  const [act, setAct] = useState('requested')
  const [doc, setDoc] = useState('')
  const [reason, setReason] = useState('')
  const files = [...Object.entries(DOCS).map(([k, d]) => ({ id: k, name: `${k} · ${d.name}` })), ...state.uploads.filter((u) => u.status === 'done').map((u) => ({ id: u.name, name: `New upload · ${u.name}` }))]
  const ready = reason.trim() && (act !== 'linked' || doc)
  const submit = () => {
    const r = reason.trim()
    if (act === 'requested')
      resolve(issue.id, { type: 'requested', reason: r }, { action: 'Requested', status: 'in_review', detail: `${g.title}: ${r}`, message: 'Marked as requested. The gap stays flagged until the document arrives.' })
    if (act === 'linked')
      resolve(issue.id, { type: 'linked', doc, reason: r }, { action: 'Document linked', status: 'resolved', detail: `${g.title}: linked to ${doc}. ${r}`, message: 'Linked. The gap is closed and the link is logged.' })
    if (act === 'not_required')
      resolve(issue.id, { type: 'not_required', reason: r }, { action: 'Marked not needed', status: 'resolved', detail: `${g.title}: ${r}`, message: 'Marked not needed for this chronology.' })
  }
  return (
    <div className="grid gap-3">
      <SourceCard doc={g.doc} page={g.page} quote={g.quote} label="Referred to here" />
      <div className={panel}>
        <SegmentedControl size="sm" label="What happened" value={act} onChange={setAct} options={MISSING_ACTIONS} className="max-w-full overflow-x-auto" />
        <div className={cn('grid gap-3', act === 'linked' && 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
          {act === 'linked' && (
            <div className="grid content-start gap-1.5">
              <label htmlFor={`${id}-f`} className="label">File in the bundle <span className="text-danger">*</span></label>
              <Select id={`${id}-f`} value={doc} onChange={(e) => setDoc(e.target.value)}>
                <option value="" disabled>Choose a file…</option>
                {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </Select>
            </div>
          )}
          <ReasonInput
            id={`${id}-r`}
            label={act === 'requested' ? 'Requested from / note' : 'Reason'}
            value={reason}
            onChange={setReason}
            placeholder={act === 'requested' ? 'e.g. Asked counsel for a certified copy' : act === 'linked' ? 'e.g. Certified copy received from the registry' : 'e.g. Order is not relied on in this chronology'}
          />
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={submit} disabled={!ready}>
            {act === 'requested' ? <LuSend /> : act === 'linked' ? <LuLink /> : <LuBan />}
            {MISSING_ACTIONS.find((a) => a.value === act).label.replace(' — link a file', ' · link file')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Undated event or skipped step. */
export function GapForm({ issue }) {
  const { resolve } = useCase()
  const g = issue.item
  const id = useId()
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const undated = g.type === 'undated'
  const go = (withDate) => {
    const r = reason.trim()
    if (withDate)
      resolve(issue.id, { type: 'dated', date, reason: r }, { action: 'Date recorded', detail: `${g.title}: ${fmt(date)}. Source: ${r}`, message: 'Date recorded and added to the timeline as confirmed by you.' })
    else resolve(issue.id, { type: 'acknowledged', reason: r }, { action: 'Acknowledged', detail: `${g.title}: ${r}`, message: 'Acknowledged and noted.' })
  }
  return (
    <div className="grid gap-3">
      <SourceCard doc={g.doc} page={g.page} quote={g.quote} label="Related sentence" />
      <div className={panel}>
        <div className={cn('grid gap-3', undated && 'sm:grid-cols-[170px_1fr]')}>
          {undated && (
            <div className="grid content-start gap-1.5">
              <label htmlFor={`${id}-d`} className="label">Date, if a source states it</label>
              <input id={`${id}-d`} type="date" className="field tabular" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          <ReasonInput
            id={`${id}-r`}
            label={undated ? 'Source or note' : 'Note'}
            value={reason}
            onChange={setReason}
            placeholder={undated ? 'e.g. Mediation report dated 02.09.2026, received from counsel' : 'e.g. Reply to counter-claim requested from counsel'}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant={undated ? 'secondary' : 'primary'} onClick={() => go(false)} disabled={!reason.trim()}><LuCheck /> Mark acknowledged</Button>
          {undated && <Button variant="primary" onClick={() => go(true)} disabled={!reason.trim() || !date}><LuUserCheck /> Assign date</Button>}
        </div>
      </div>
    </div>
  )
}

/** The recorded decision, with a way to withdraw it. */
export function ResolutionCard({ issue }) {
  const { reopen } = useCase()
  const r = issue.resolution
  const text = {
    corrected: `Date corrected to ${r.date && fmt(r.date)}, based on ${r.basis === 'other' ? 'another source' : `Record ${r.basis}`}.`,
    confirmed: `Confirmed as ${r.kind} on ${r.date && fmt(r.date)}.`,
    dismissed: 'Dismissed. Not placed on the timeline.',
    requested: 'Requested. Waiting for the document.',
    linked: `Linked to ${r.doc}.`,
    not_required: 'Marked not needed for this chronology.',
    dated: `Date recorded as ${r.date && fmt(r.date)}.`,
    acknowledged: 'Acknowledged.',
  }[r.type]
  const pending = r.type === 'requested'
  return (
    <div className={cn('animate-fade flex flex-wrap items-start gap-3 rounded-lg p-3.5', pending ? 'bg-warning-soft' : 'bg-success-soft')}>
      <LuUserCheck className={cn('mt-0.5 size-[18px] shrink-0', pending ? 'text-warning' : 'text-success')} />
      <div className="min-w-0 flex-1 text-[13px]">
        <b className="block font-medium">{text}</b>
        <span className="text-ink-2">Reason: {r.reason}</span>
        <small className="mt-0.5 block text-[11.5px] text-ink-3">{r.who} · {relTime(r.at)}</small>
      </div>
      <Button variant="secondary" size="sm" onClick={() => reopen(issue.id, issue.title)}>
        <LuRotateCcw /> Reopen
      </Button>
    </div>
  )
}
