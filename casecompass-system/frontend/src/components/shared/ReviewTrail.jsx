import { useId, useState } from 'react'
import { LuPencilLine, LuRotateCcw, LuUserCheck, LuX, LuMessageSquareText, LuArrowRight } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { fmt, fmtNum, fmtTime, relTime } from '../../lib/dates'
import { Button } from '../ui/Button'
import { Tabs } from '../ui/controls'
import { ReasonInput } from './forms'
import { cn } from '../../lib/cn'

const NOTE_STARTERS = ['Date not confirmed: ', 'Records disagree: ', 'Checked against original: ']

/** Reviewer notes on any entry: a timeline event, a conflict, a gap or a quarantined date. */
export function NotesThread({ id, title, compact }) {
  const { state, addNote } = useCase()
  const [text, setText] = useState('')
  const list = state.notes[id] || []
  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    addNote(id, text.trim(), title)
    setText('')
  }
  return (
    <div className="grid gap-2">
      {list.map((n, i) => (
        <div key={i} className="animate-fade rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed">
          {n.text}
          <small className="mt-0.5 block text-[11px] text-ink-3">{n.who} · {relTime(n.at)}</small>
        </div>
      ))}
      {!list.length && <p className="text-[12.5px] text-ink-3">No notes yet. Notes are kept with the entry and shown to other reviewers.</p>}
      <form onSubmit={submit} className="grid gap-1.5">
        <div className="flex gap-2">
          <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a reviewer note" aria-label={`Add a reviewer note to ${title}`} />
          <Button type="submit" variant="secondary" disabled={!text.trim()}>Add</Button>
        </div>
        {!compact && !text && (
          <div className="flex flex-wrap gap-1">
            {NOTE_STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => setText(s)} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink-3 transition-colors hover:border-line-strong hover:text-ink-2">
                {s.replace(': ', '…')}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}

/** Everything logged against one entry: flags, notes, corrections, reopenings. */
export function EntryHistory({ id }) {
  const { state } = useCase()
  const list = state.history.filter((h) => h.issueId === id).sort((a, b) => b.at.localeCompare(a.at))
  if (!list.length) return <p className="text-[12.5px] text-ink-3">No changes yet. The extracted record is untouched.</p>
  return (
    <ol className="grid gap-2.5 border-l border-line pl-4">
      {list.map((h) => (
        <li key={h.id} className="relative text-[12.5px]">
          <span className={cn('absolute top-[5px] -left-[20.5px] size-2 rounded-full ring-2 ring-surface', h.kind === 'correction' ? 'bg-success' : h.kind === 'note' ? 'bg-primary' : 'bg-ink-3')} />
          <b className="font-medium">{h.action}</b> <span className="text-ink-2">{h.detail}</span>
          <small className="tabular block text-[11px] text-ink-3">{h.who} · {fmtTime(h.at)}</small>
        </li>
      ))}
    </ol>
  )
}

/** Notes + history tabs for one entry. `extra` adds tabs (e.g. glossary terms on the review page). */
export function ReviewTrail({ id, title, compact, extra = [], className }) {
  const { state } = useCase()
  const [tab, setTab] = useState('notes')
  const notes = (state.notes[id] || []).length
  const changes = state.history.filter((h) => h.issueId === id).length
  const tabs = [{ value: 'notes', label: 'Notes', count: notes }, ...extra.map((x) => ({ value: x.value, label: x.label, count: x.count })), { value: 'history', label: 'History', count: changes }]
  const ex = extra.find((x) => x.value === tab)
  return (
    <div className={className}>
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      <div className="pt-3">
        {tab === 'notes' && <NotesThread id={id} title={title} compact={compact} />}
        {ex && ex.render()}
        {tab === 'history' && <EntryHistory id={id} />}
      </div>
    </div>
  )
}

/** Original extracted date(s) next to the reviewer's correction. Nothing is overwritten. */
export function CorrectionSummary({ id, title, originalDates, labels }) {
  const { state, reopen } = useCase()
  const r = state.resolutions[id]
  if (!r || !originalDates?.length) return null
  return (
    <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-[12.5px]">
      <div className="flex items-center gap-1.5 font-medium text-ink">
        <LuUserCheck className="size-4 text-success" /> Corrected by reviewer
      </div>
      <div className="tabular mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-ink-3">Extracted</span>
        {originalDates.map((d, i) => (
          <span key={i} className="text-ink-2 line-through decoration-ink-3/60">{fmtNum(d)}{labels?.[i] ? ` (${labels[i]})` : ''}</span>
        ))}
        <LuArrowRight className="size-3.5 text-ink-3" />
        <b className="font-semibold text-ink">{fmtNum(r.date)}</b>
      </div>
      <p className="mt-1.5 text-ink-2">Reason: {r.reason}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <small className="text-[11px] text-ink-3">{r.who} · {relTime(r.at)} · original record kept</small>
        <Button variant="ghost" size="sm" onClick={() => reopen(id, title)}><LuRotateCcw /> Undo correction</Button>
      </div>
    </div>
  )
}

/** Correct the date of a stated entry (event, hearing, deadline). Requires a reason; keeps the original. */
export function CorrectDateForm({ item }) {
  const { resolve } = useCase()
  const fid = useId()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(item.date)
  const [reason, setReason] = useState('')
  const ready = date && date !== item.date && reason.trim()
  if (!open)
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <LuPencilLine /> Correct date
      </Button>
    )
  const submit = () =>
    resolve(item.id, { type: 'corrected', date, basis: 'reviewer', reason: reason.trim() }, {
      action: 'Correction recorded',
      detail: `${item.title}: date changed from ${fmt(item.date)} to ${fmt(date)}. Reason: ${reason.trim()}`,
      message: 'Correction recorded. The extracted date is kept alongside.',
    })
  return (
    <div className="animate-fade grid w-full gap-2.5 rounded-lg border border-line bg-surface-2/40 p-3">
      <div className="flex items-center justify-between">
        <b className="text-[12.5px] font-medium">Correct the date</b>
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Cancel correction"><LuX /></Button>
      </div>
      <p className="tabular text-[12px] text-ink-3">Extracted from the record: <span className="text-ink-2">{fmt(item.date)}</span>. It stays on file.</p>
      <div className="grid gap-1.5">
        <label htmlFor={`${fid}-d`} className="label">Corrected date <span className="text-danger">*</span></label>
        <input id={`${fid}-d`} type="date" className="field tabular" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <ReasonInput id={`${fid}-r`} value={reason} onChange={setReason} placeholder="e.g. OCR misread; the original shows a different date" suggestions={['OCR misread the date', 'Corrected by a later order']} />
      <Button variant="primary" size="sm" onClick={submit} disabled={!ready} className="justify-self-end">
        <LuUserCheck /> Record correction
      </Button>
    </div>
  )
}

export function NoteCount({ id, className }) {
  const { state } = useCase()
  const n = (state.notes[id] || []).length
  if (!n) return null
  return (
    <span title={`${n} reviewer note${n > 1 ? 's' : ''}`} className={cn('tabular inline-flex items-center gap-0.5 text-[11px] text-ink-3', className)}>
      <LuMessageSquareText className="size-3.5" />
      {n}
    </span>
  )
}
