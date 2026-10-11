import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { LuBell, LuMenu, LuSearch, LuUpload, LuChevronRight } from 'react-icons/lu'
import { ACTIVE_CASE, DOCS } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { useUi } from '../../state/UiStore'
import { issueCounts, upcomingDeadlines } from '../../lib/selectors'
import { countdown, relTime } from '../../lib/dates'
import { KIND_COLOR } from '../../lib/kinds'
import { navigate } from '../../lib/router'
import { Button } from '../ui/Button'
import { Kbd, StatusDot } from '../ui/display'

function Notifications() {
  const { state, openSource } = useCase()
  const counts = issueCounts(state)
  const next = upcomingDeadlines(state).slice(0, 2)
  const flags = state.history.filter((h) => h.action === 'Flagged' || h.action === 'Quarantined').sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3)
  return (
    <Popover className="relative">
      <PopoverButton aria-label={`Notifications, ${counts.open} open issues`} className="relative grid size-9 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink data-open:bg-surface-2">
        <LuBell className="size-[18px]" />
        {counts.open > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-danger ring-2 ring-canvas" />}
      </PopoverButton>
      <PopoverPanel anchor={{ to: 'bottom end', gap: 8 }} transition className="z-50 w-[340px] rounded-lg border border-line bg-surface p-1.5 shadow-float transition duration-100 data-closed:opacity-0">
        {({ close }) => (
          <>
            <div className="eyebrow px-2.5 pt-2 pb-1">Due soon</div>
            {next.map((d) => (
              <button key={d.nodeId} onClick={() => { openSource(d.nodeId); close() }} className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-2">
                <StatusDot color={d.cls} className="mt-1" />
                <span className="min-w-0 text-[13px]">
                  <span className="block truncate">{d.title}</span>
                  <small className="block text-[11.5px] text-ink-3">{countdown(d.date)} · {DOCS[d.doc].name}</small>
                </span>
              </button>
            ))}
            <div className="eyebrow mt-1 border-t border-line px-2.5 pt-2.5 pb-1">Recent flags</div>
            {flags.map((h) => (
              <button key={h.id} onClick={() => { navigate(h.issueId ? `review?issue=${h.issueId}` : 'review'); close() }} className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-surface-2">
                <span className="mt-[7px] size-[7px] shrink-0 rounded-full" style={{ background: h.action === 'Quarantined' ? KIND_COLOR.quarantine : KIND_COLOR.danger }} />
                <span className="min-w-0 text-[13px]">
                  <span className="line-clamp-2">{h.detail}</span>
                  <small className="block text-[11.5px] text-ink-3">{h.action} · {relTime(h.at)}</small>
                </span>
              </button>
            ))}
            <button onClick={() => { navigate('review'); close() }} className="mt-1 w-full rounded-md border-t border-line px-2.5 py-2 text-left text-[12.5px] font-medium text-primary hover:bg-surface-2">
              Open all {counts.open} issues
            </button>
          </>
        )}
      </PopoverPanel>
    </Popover>
  )
}

export default function Topbar({ page }) {
  const { setPalette, setMobileNav } = useUi()
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:gap-3 sm:px-6">
      <Button variant="ghost" size="icon" onClick={() => setMobileNav(true)} aria-label="Open navigation" className="md:hidden">
        <LuMenu />
      </Button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
        <span className="tabular hidden truncate text-ink-3 sm:inline">{ACTIVE_CASE.no}</span>
        <LuChevronRight className="hidden size-3.5 shrink-0 text-ink-3 sm:inline" />
        <span className="truncate font-medium text-ink">{page.title}</span>
      </nav>
      <button
        onClick={() => setPalette(true)}
        className="hidden h-8 w-[min(300px,28vw)] items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong md:flex"
      >
        <LuSearch className="size-4" />
        <span className="flex-1 truncate">Search events, documents, terms…</span>
        <Kbd>{mac ? '⌘K' : 'Ctrl K'}</Kbd>
      </button>
      <Button variant="ghost" size="icon" onClick={() => setPalette(true)} aria-label="Search" className="md:hidden">
        <LuSearch />
      </Button>
      <Notifications />
      <Button href="#/upload" variant="secondary" size="sm" className="max-sm:hidden">
        <LuUpload /> Upload
      </Button>
    </header>
  )
}
