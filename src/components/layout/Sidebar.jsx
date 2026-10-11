import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { LuCompass, LuChevronsUpDown, LuCheck, LuSun, LuMoon, LuSettings2, LuPanelLeftClose, LuPanelLeftOpen, LuArchive } from 'react-icons/lu'
import { ACTIVE_CASE, ONGOING_CASES, PAST_CASES, REVIEWER } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { useUi } from '../../state/UiStore'
import { issueCounts, upcomingDeadlines } from '../../lib/selectors'
import { daysFrom } from '../../lib/dates'
import { Tooltip } from '../ui/overlay'
import { Switch } from '../ui/controls'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'

function Logo({ collapsed }) {
  return (
    <a href="#/dashboard" className={cn('flex h-14 shrink-0 items-center gap-2.5', collapsed ? 'justify-center' : 'px-4')} aria-label="CaseCompass, go to dashboard">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brass-soft text-brass ring-1 ring-brass/25">
        <LuCompass className="size-[18px]" />
      </span>
      {!collapsed && <span className="text-[15px] font-semibold tracking-[-0.01em]">CaseCompass</span>}
    </a>
  )
}

function CaseSwitcher({ collapsed }) {
  const { toast } = useCase()
  const pick = (c) => {
    if (c.id !== ACTIVE_CASE.id) toast(`Demo data is loaded only for ${ACTIVE_CASE.no}.`)
  }
  const button = (
    <ListboxButton
      aria-label={`Active case: ${ACTIVE_CASE.title}. Switch case`}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg border border-line bg-surface text-left transition-colors hover:bg-surface-2',
        collapsed ? 'size-10 justify-center' : 'px-2.5 py-2',
      )}
    >
      {collapsed ? (
        <span className="text-[11px] font-bold text-primary">MT</span>
      ) : (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{ACTIVE_CASE.short}</span>
            <span className="tabular block truncate text-[11.5px] text-ink-3">{ACTIVE_CASE.no}</span>
          </span>
          <LuChevronsUpDown className="size-4 shrink-0 text-ink-3" />
        </>
      )}
    </ListboxButton>
  )
  return (
    <Listbox value={ONGOING_CASES[0]} onChange={pick}>
      <div className={cn('shrink-0', collapsed ? 'flex justify-center' : 'px-3')}>
        {collapsed ? <Tooltip content={ACTIVE_CASE.short} placement="right">{button}</Tooltip> : button}
      </div>
      <ListboxOptions
        anchor={{ to: collapsed ? 'right start' : 'bottom start', gap: 6 }}
        transition
        className="z-[60] w-[280px] rounded-lg border border-line bg-surface p-1 shadow-float transition duration-100 outline-none data-closed:opacity-0"
      >
        <div className="eyebrow px-2 pt-1.5 pb-1">Ongoing</div>
        {ONGOING_CASES.map((c) => (
          <ListboxOption key={c.id} value={c} className="group flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 data-focus:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{c.title}</span>
              <span className="tabular block text-[11.5px] text-ink-3">{c.no} · {c.type}</span>
            </span>
            {c.active && <LuCheck className="mt-0.5 size-4 text-primary" />}
          </ListboxOption>
        ))}
        <div className="eyebrow mt-1 border-t border-line px-2 pt-2 pb-1">Closed</div>
        {PAST_CASES.map((c) => (
          <ListboxOption key={c.id} value={c} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 data-focus:bg-surface-2">
            <LuArchive className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink-2">{c.title}</span>
              <span className="tabular block text-[11.5px] text-ink-3">{c.no} · read-only</span>
            </span>
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  )
}

function useBadges() {
  const { state } = useCase()
  const counts = issueCounts(state)
  const soon = upcomingDeadlines(state).filter((d) => daysFrom(d.date) <= 7).length
  const processing = state.uploads.filter((u) => u.status === 'processing').length
  return {
    upload: processing ? { n: processing, tone: 'primary', label: 'files processing' } : null,
    review: counts.open ? { n: counts.open, tone: 'danger', label: 'open issues' } : null,
    calendar: soon ? { n: soon, tone: 'warning', label: 'deadlines in the next 7 days' } : null,
  }
}

const TONE = {
  primary: 'bg-primary-soft text-primary',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
}

function Nav({ pages, page, collapsed, onNavigate }) {
  const badges = useBadges()
  return (
    <nav aria-label="Workflow" className="relative">
      {/* workflow connector */}
      <span aria-hidden className={cn('absolute top-5 bottom-5 w-px bg-line', collapsed ? 'left-1/2' : 'left-[27px]')} />
      <ol className="relative grid gap-0.5">
        {pages.map((p, i) => {
          const on = p.path === page.path
          const b = badges[p.path]
          const link = (
            <a
              href={'#/' + p.path}
              onClick={onNavigate}
              aria-current={on ? 'page' : undefined}
              aria-label={collapsed ? `${i + 1}. ${p.title}${b ? `, ${b.n} ${b.label}` : ''}` : undefined}
              className={cn(
                'group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150',
                collapsed ? 'mx-auto size-10 justify-center' : 'h-9 gap-2.5 pr-2 pl-[17px]',
                on ? 'bg-primary-soft text-primary' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              {on && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-primary" />}
              <span className={cn('relative grid size-[22px] shrink-0 place-items-center rounded-md', on ? 'bg-transparent' : 'bg-surface group-hover:bg-transparent')}>
                <p.icon className="size-[17px]" />
                {collapsed && b && <span className={cn('absolute -top-1 -right-1.5 size-2 rounded-full ring-2 ring-surface', b.tone === 'danger' ? 'bg-danger' : b.tone === 'warning' ? 'bg-warning' : 'bg-primary')} />}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate">{p.short || p.title}</span>
                  {b ? (
                    <span className={cn('tabular rounded-full px-1.5 text-[11px] leading-[18px] font-semibold', TONE[b.tone])} title={`${b.n} ${b.label}`}>
                      {b.n}
                    </span>
                  ) : (
                    <span className="tabular text-[11px] text-ink-3/70">{i + 1}</span>
                  )}
                </>
              )}
            </a>
          )
          return (
            <li key={p.path}>
              {collapsed ? (
                <Tooltip content={`${i + 1}. ${p.title}`} placement="right" delay={0}>
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function Settings({ collapsed }) {
  const { state, setSettings } = useCase()
  const s = state.settings
  return (
    <Popover className="relative">
      <Tooltip content="Settings" placement={collapsed ? 'right' : 'top'}>
        <PopoverButton aria-label="Settings" className="grid size-8 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink data-open:bg-surface-2">
          <LuSettings2 className="size-[17px]" />
        </PopoverButton>
      </Tooltip>
      <PopoverPanel anchor={{ to: collapsed ? 'right end' : 'top start', gap: 8 }} transition className="z-[60] w-[280px] rounded-lg border border-line bg-surface p-4 shadow-float transition duration-100 data-closed:opacity-0">
        <h3 className="text-[13px] font-semibold">Settings</h3>
        <p className="mt-0.5 text-[12px] text-ink-3">Urgency colours for stated deadlines.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="label flex items-center gap-1.5"><i className="size-2 rounded-full bg-danger" /> Urgent within</span>
            <span className="flex items-center gap-1.5">
              <input type="number" min={1} max={60} value={s.red} onChange={(e) => setSettings({ red: Math.max(1, +e.target.value || 1) })} className="field tabular w-16" />
              <span className="text-[12px] text-ink-3">days</span>
            </span>
          </label>
          <label className="grid gap-1">
            <span className="label flex items-center gap-1.5"><i className="size-2 rounded-full bg-warning" /> Soon within</span>
            <span className="flex items-center gap-1.5">
              <input type="number" min={2} max={120} value={s.amber} onChange={(e) => setSettings({ amber: Math.max(s.red + 1, +e.target.value || 2) })} className="field tabular w-16" />
              <span className="text-[12px] text-ink-3">days</span>
            </span>
          </label>
        </div>
        <div className="mt-4 flex items-start justify-between gap-3 border-t border-line pt-3">
          <span>
            <b className="block text-[13px] font-medium">Plain-language terms</b>
            <span className="text-[12px] text-ink-3">Underline legal terms and explain them on hover.</span>
          </span>
          <Switch checked={s.showTerms} onChange={(v) => setSettings({ showTerms: v })} label="Show plain-language terms" />
        </div>
      </PopoverPanel>
    </Popover>
  )
}

export function SidebarContent({ pages, page, collapsed, onNavigate, showCollapse = true }) {
  const { theme, toggleTheme, toggleCollapsed, narrow } = useUi()
  const initials = REVIEWER.split(' ').map((w) => w[0]).join('').slice(0, 2)
  return (
    <div className="flex h-full flex-col">
      <Logo collapsed={collapsed} />
      <CaseSwitcher collapsed={collapsed} />
      {!collapsed && <div className="eyebrow mt-5 mb-1.5 px-4">Workflow</div>}
      <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'mt-4 px-2' : 'px-2.5')}>
        <Nav pages={pages} page={page} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      <div className={cn('shrink-0 border-t border-line', collapsed ? 'px-2 py-3' : 'p-3')}>
        <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : 'items-center')}>
          <Tooltip content={theme === 'dark' ? 'Light theme' : 'Dark theme'} placement={collapsed ? 'right' : 'top'}>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {theme === 'dark' ? <LuSun /> : <LuMoon />}
            </Button>
          </Tooltip>
          <Settings collapsed={collapsed} />
          {showCollapse && !narrow && (
            <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement={collapsed ? 'right' : 'top'}>
              <Button variant="ghost" size="icon" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={collapsed ? '' : 'ml-auto'}>
                {collapsed ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
              </Button>
            </Tooltip>
          )}
        </div>
        <div className={cn('mt-2 flex items-center gap-2.5', collapsed && 'justify-center')}>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[11.5px] font-semibold text-primary" title={REVIEWER}>
            {initials}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <b className="block truncate text-[13px] font-medium">{REVIEWER}</b>
              <span className="block truncate text-[11.5px] text-ink-3">Case assistant</span>
            </span>
          )}
        </div>
        {!collapsed && <p className="mt-2.5 text-[11px] leading-snug text-ink-3">Organises the supplied record only. Not legal advice; no outcome predictions.</p>}
      </div>
    </div>
  )
}
