import { LuCalendarX2, LuFileQuestion, LuCalendarCheck, LuArrowRight, LuShieldAlert, LuRoute } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { useUi } from '../../state/UiStore'
import { issueCounts, upcomingDeadlines } from '../../lib/selectors'
import { countdown } from '../../lib/dates'
import { KIND_COLOR } from '../../lib/kinds'
import { navigate } from '../../lib/router'
import { CountUp } from '../ui/display'

/** USP 3: the "Red Flag" summary. Structural risks surface the moment the case opens. */
export default function CaseHealth() {
  const { state } = useCase()
  const { setQuarantine } = useUi()
  const counts = issueCounts(state)
  const up = upcomingDeadlines(state)
  const next = up[0]
  const tiles = [
    { key: 'conflict', color: KIND_COLOR.danger, icon: LuCalendarX2, n: counts.conflicts, label: 'Date conflicts', sub: counts.conflicts ? 'Need manual review' : 'None open', to: 'review?tab=conflict' },
    { key: 'missing', color: KIND_COLOR.warning, icon: LuFileQuestion, n: counts.missing, label: 'Missing referenced documents', sub: counts.missing ? 'Gaps in the file bundle' : 'Bundle is complete', to: 'review?tab=missing' },
    { key: 'deadlines', color: KIND_COLOR.success, icon: LuCalendarCheck, n: up.length, label: 'Verified deadlines upcoming', sub: next ? `Next: ${next.title}, ${countdown(next.date)}` : 'None ahead', to: 'calendar' },
  ]
  return (
    <section className="card overflow-hidden" aria-labelledby="health-h">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <h2 id="health-h" className="text-[14px] font-semibold">Case health</h2>
        <span className="text-[12px] text-ink-3">Counts update as you review</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3">
        {tiles.map((t, i) => (
          <button
            key={t.key}
            onClick={() => navigate(t.to)}
            style={{ '--c': t.color }}
            className={`group relative flex items-start gap-3.5 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${i ? 'border-line max-sm:border-t sm:border-l' : ''}`}
          >
            <span className="bg-c-soft text-c grid size-10 shrink-0 place-items-center rounded-lg">
              <t.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <CountUp value={t.n} className="block text-[32px] leading-none font-semibold tracking-[-0.02em] text-ink" />
              <span className="mt-1.5 block text-[13px] font-medium text-ink">{t.label}</span>
              <span className="block truncate text-[12px] text-ink-3">{t.sub}</span>
            </span>
            <LuArrowRight className="text-c mt-1 size-4 shrink-0 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-2/50 px-4 py-2 text-[12.5px]">
        <button onClick={() => setQuarantine(true)} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
          <LuShieldAlert className="size-3.5 text-quarantine" />
          <b className="tabular font-semibold text-ink">{counts.quarantine}</b> dates in quarantine
        </button>
        <span className="text-line-strong">·</span>
        <button onClick={() => navigate('review?tab=gaps')} className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink">
          <LuRoute className="size-3.5 text-ink-3" />
          <b className="tabular font-semibold text-ink">{counts.gaps}</b> other gaps
        </button>
        <span className="ml-auto text-ink-3 max-sm:hidden">Unclear dates are held back, never guessed.</span>
      </div>
    </section>
  )
}
