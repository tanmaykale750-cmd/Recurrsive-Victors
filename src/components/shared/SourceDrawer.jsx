import { useRef } from 'react'
import { LuAlarmClock, LuCalendarX2, LuFileQuestion, LuShieldAlert, LuUserCheck, LuArrowRight, LuCopy, LuExternalLink, LuCircleCheck, LuBookOpenText } from 'react-icons/lu'
import { DOCS } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { buildIssues, findEntity, termsIn } from '../../lib/selectors'
import { countdown, daysFrom, fmt, urgency } from '../../lib/dates'
import { navigate } from '../../lib/router'
import { Drawer } from '../ui/overlay'
import { Badge, Callout, ConfidenceMeter, IssueStatus } from '../ui/display'
import { Switch } from '../ui/controls'
import { Button } from '../ui/Button'
import SourceCard from './SourceCard'

/** Describe any entity (item, conflict, gap, quarantined date) for the drawer. */
function describe(found, state) {
  const e = found.entity
  const res = state.resolutions[e.id]
  if (found.kind === 'conflict') {
    return {
      label: res ? 'Date corrected' : 'Date conflict',
      color: res ? 'corrected' : 'conflict',
      when: res ? `${fmt(res.date)} · reviewer correction` : e.dates.map((d) => fmt(d.date)).join('  or  '),
      sources: e.dates.map((d, i) => ({ ...d, label: `Record ${'AB'[i]} · ${fmt(d.date)}` })),
      callout: res
        ? { color: 'success', icon: LuUserCheck, text: `${res.who} recorded ${fmt(res.date)} based on ${res.basis === 'other' ? 'another source' : `Record ${res.basis}`}. Reason: ${res.reason}` }
        : { color: 'danger', icon: LuCalendarX2, text: 'Two records give different dates. Both are kept with their sources; CaseCompass does not pick one.' },
    }
  }
  if (found.kind === 'gap') {
    const label = e.type === 'missing' ? 'Missing document' : e.type === 'undated' ? 'Undated event' : 'Skipped step'
    return {
      label,
      color: e.type === 'missing' ? 'missing' : 'muted',
      when: e.date ? `Referred to as ${fmt(e.date)}` : res?.date ? `${fmt(res.date)} · confirmed by reviewer` : 'No date in the record',
      sources: [{ doc: e.doc, page: e.page, quote: e.quote, label: 'Referring sentence' }],
      callout: { color: e.type === 'missing' ? 'warning' : 'muted', icon: LuFileQuestion, text: e.why },
    }
  }
  if (found.kind === 'quarantine') {
    const ok = res?.type === 'confirmed'
    return {
      label: ok ? 'Confirmed by reviewer' : 'Quarantined date',
      color: ok ? 'confirmed' : 'quarantine',
      when: ok ? `${fmt(res.date)} · confirmed by ${res.who}` : 'Not confirmed',
      sources: [{ doc: e.doc, page: e.page, quote: e.quote }],
      confidence: e.confidence,
      callout: ok ? { color: 'success', icon: LuUserCheck, text: `Basis given: ${res.reason}` } : { color: 'quarantine', icon: LuShieldAlert, text: `${e.reason}. ${e.note}` },
    }
  }
  const isDeadline = e.kind === 'deadline'
  return {
    label: isDeadline ? 'Deadline' : e.kind === 'hearing' ? 'Hearing' : 'Event',
    color: isDeadline ? urgency(e.date, state.settings) : 'event',
    when: fmt(e.date) + (isDeadline ? ` · ${countdown(e.date)}` : ''),
    sources: [{ doc: e.doc, page: e.page, quote: e.quote }],
    callout: isDeadline
      ? { color: urgency(e.date, state.settings), icon: LuAlarmClock, text: `Stated in the record in these words; not calculated.${e.party ? ` Applies to ${e.party}.` : ''}` }
      : null,
  }
}

/** Slide-over that shows where any entry came from: document, page and exact sentence. */
export default function SourceDrawer() {
  const { state, closeSource, setReminder, toast } = useCase()
  const lastId = useRef(null)
  if (state.drawer) lastId.current = state.drawer
  const found = lastId.current ? findEntity(lastId.current) : null
  if (!found) return <Drawer open={false} onClose={closeSource} title="" />

  const e = found.entity
  const info = describe(found, state)
  const issue = buildIssues(state).find((i) => i.id === e.id)
  const terms = termsIn(info.sources.map((s) => s.quote).join(' '))
  const rem = state.reminders[e.id]
  const showReminder = e.kind === 'deadline' && daysFrom(e.date) >= 0
  const first = info.sources[0]
  const cite = `${DOCS[first.doc].name}, p. ${first.page}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${e.title}. ${info.sources.map((s) => `${DOCS[s.doc].name}, p. ${s.page}`).join('; ')}.`)
      toast('Citation copied', 'ok')
    } catch {
      toast(`Citation: ${cite}`)
    }
  }

  return (
    <Drawer
      open={!!state.drawer}
      onClose={closeSource}
      width={info.sources.length > 1 ? 'max-w-[640px]' : 'max-w-[480px]'}
      eyebrow={<Badge color={info.color}>{info.label}</Badge>}
      title={e.title}
      subtitle={<span className="tabular">{info.when}</span>}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => toast('The document viewer opens here once a backend is connected.')}>
            <LuExternalLink /> Open document
          </Button>
          <Button variant="secondary" size="sm" onClick={copy}><LuCopy /> Copy citation</Button>
          <span className="flex-1" />
          {issue ? (
            <Button variant="primary" size="sm" onClick={() => { closeSource(); navigate(`review?issue=${e.id}`) }}>
              Go to issue <LuArrowRight />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => { closeSource(); navigate('timeline') }}>
              See on timeline <LuArrowRight />
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-5">
        {info.callout && <Callout color={info.callout.color} icon={info.callout.icon}>{info.callout.text}</Callout>}

        <div>
          <div className="eyebrow mb-2">{info.sources.length > 1 ? 'Sources, side by side' : 'Source'}</div>
          <div className={info.sources.length > 1 ? 'grid gap-2.5 sm:grid-cols-2' : 'grid gap-2.5'}>
            {info.sources.map((s, i) => (
              <SourceCard key={i} {...s} />
            ))}
          </div>
          <div className="mt-2.5">
            {info.confidence !== undefined ? (
              <ConfidenceMeter value={info.confidence} label="OCR confidence for this snippet" className="max-w-[260px]" />
            ) : (
              <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
                <LuCircleCheck className="size-3.5 text-success" /> Exact sentence matched in the source document
              </p>
            )}
          </div>
        </div>

        {showReminder && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-3.5 py-3">
            <div>
              <b className="block text-[13px] font-medium">Reminder</b>
              <span className="text-[12px] text-ink-3">{rem?.on ? `${(rem.days || []).join(' and ')} day(s) before` : 'Off. Only verified deadlines can have reminders.'}</span>
            </div>
            <Switch checked={!!rem?.on} onChange={(on) => setReminder(e.id, { on, days: rem?.days?.length ? rem.days : [7, 1] })} label={`Reminder for ${e.title}`} />
          </div>
        )}

        {issue && (
          <button onClick={() => { closeSource(); navigate(`review?issue=${e.id}`) }} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-3 text-left transition-colors hover:bg-surface-2">
            <span className="text-[13px]">
              <span className="block font-medium">Related issue</span>
              <span className="text-[12px] text-ink-3">{(state.notes[e.id] || []).length} reviewer notes</span>
            </span>
            <IssueStatus status={issue.status} />
          </button>
        )}

        {terms.length > 0 && state.settings.showTerms && (
          <div>
            <div className="eyebrow mb-2 flex items-center gap-1.5"><LuBookOpenText className="size-3.5" /> Terms in plain language</div>
            <dl className="grid gap-2">
              {terms.map((t) => (
                <div key={t.term} className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]">
                  <dt className="font-medium text-ink">{t.term}</dt>
                  <dd className="text-ink-2">{t.def}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </Drawer>
  )
}
