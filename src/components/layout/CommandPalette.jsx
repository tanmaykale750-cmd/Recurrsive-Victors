import { useMemo, useState } from 'react'
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { LuSearch, LuGitCommitHorizontal, LuFileText, LuBookOpenText, LuListChecks, LuCornerDownLeft } from 'react-icons/lu'
import { DOCS, GLOSSARY } from '../../data/caseData'
import { useCase } from '../../state/CaseStore'
import { useUi } from '../../state/UiStore'
import { buildIssues, buildNodes } from '../../lib/selectors'
import { ISSUE_META } from '../../lib/kinds'
import { fmt } from '../../lib/dates'
import { navigate } from '../../lib/router'
import { Kbd } from '../ui/display'

/** ⌘K / Ctrl+K: jump to pages, events, issues, documents and glossary terms. */
export default function CommandPalette({ pages }) {
  const { state, openSource } = useCase()
  const { palette, setPalette } = useUi()
  const [q, setQ] = useState('')
  const [term, setTerm] = useState(null)

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    const pageItems = pages
      .filter((p) => !s || p.title.toLowerCase().includes(s))
      .map((p, i) => ({ key: 'p' + p.path, icon: p.icon, title: p.title, sub: `Step ${i + 1}`, go: () => navigate(p.path) }))
    if (!s) return [{ label: 'Go to', items: pageItems }]
    const seen = new Set()
    const events = buildNodes(state)
      .filter((n) => `${n.title} ${n.quote || ''}`.toLowerCase().includes(s))
      .filter((n) => (seen.has(n.id) ? false : seen.add(n.id)))
      .slice(0, 5)
      .map((n) => ({ key: 'n' + n.nodeId, icon: LuGitCommitHorizontal, title: n.title, sub: `${fmt(n.date)} · ${n.doc}, p.${n.page}`, go: () => openSource(n.nodeId) }))
    const issues = buildIssues(state)
      .filter((i) => i.title.toLowerCase().includes(s))
      .slice(0, 4)
      .map((i) => ({ key: 'i' + i.id, icon: LuListChecks, title: i.title, sub: ISSUE_META[i.type].label, go: () => navigate(`review?issue=${i.id}`) }))
    const docs = Object.entries(DOCS)
      .filter(([id, d]) => `${id} ${d.name} ${d.type}`.toLowerCase().includes(s))
      .slice(0, 4)
      .map(([id, d]) => ({ key: 'd' + id, icon: LuFileText, title: d.name, sub: `${id} · ${d.type}, ${d.pages} pages`, go: () => navigate(`upload?doc=${id}`) }))
    const terms = GLOSSARY.filter((g) => `${g.term} ${g.alias.join(' ')}`.toLowerCase().includes(s))
      .slice(0, 4)
      .map((g) => ({ key: 'g' + g.term, icon: LuBookOpenText, title: g.term, sub: g.def, keep: true, go: () => setTerm(g) }))
    return [
      { label: 'Pages', items: pageItems },
      { label: 'Timeline entries', items: events },
      { label: 'Issues', items: issues },
      { label: 'Documents', items: docs },
      { label: 'Glossary', items: terms },
    ].filter((g) => g.items.length)
  }, [q, state, pages, openSource])

  const close = () => {
    setPalette(false)
    setTimeout(() => { setQ(''); setTerm(null) }, 150)
  }
  const choose = (item) => {
    if (!item) return
    item.go()
    if (!item.keep) close()
  }
  const empty = !groups.length

  return (
    <Dialog open={palette} onClose={close} className="relative z-[70]">
      <DialogBackdrop transition className="fixed inset-0 bg-[var(--overlay)] transition-opacity duration-150 data-closed:opacity-0" />
      <div className="fixed inset-0 flex items-start justify-center p-4 pt-[12vh]">
        <DialogPanel transition className="w-full max-w-[580px] overflow-hidden rounded-xl border border-line bg-surface shadow-float transition duration-150 data-closed:scale-[0.98] data-closed:opacity-0">
          <Combobox onChange={choose}>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <LuSearch className="size-[18px] text-ink-3" />
              <ComboboxInput
                autoFocus
                value={q}
                onChange={(e) => { setQ(e.target.value); setTerm(null) }}
                placeholder="Search events, issues, documents, legal terms…"
                className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
                aria-label="Search the case"
              />
              <Kbd>Esc</Kbd>
            </div>
            {term ? (
              <div className="p-4">
                <div className="eyebrow">Glossary</div>
                <h3 className="mt-1 text-[16px]">{term.term}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{term.def}</p>
                <p className="mt-3 text-[11.5px] text-ink-3">Definition from the case glossary. Not legal advice.</p>
              </div>
            ) : (
              <ComboboxOptions static className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
                {groups.map((g) => (
                  <div key={g.label} className="mb-1">
                    <div className="eyebrow px-2.5 pt-2 pb-1">{g.label}</div>
                    {g.items.map((it) => (
                      <ComboboxOption key={it.key} value={it} className="group flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 data-focus:bg-surface-2">
                        <it.icon className="size-4 shrink-0 text-ink-3 group-data-focus:text-primary" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink">{it.title}</span>
                          <span className="block truncate text-[11.5px] text-ink-3">{it.sub}</span>
                        </span>
                        <LuCornerDownLeft className="size-3.5 text-ink-3 opacity-0 group-data-focus:opacity-100" />
                      </ComboboxOption>
                    ))}
                  </div>
                ))}
                {empty && <p className="px-3 py-8 text-center text-[13px] text-ink-3">Nothing in this case matches “{q}”. Try a party, a document or a legal term.</p>}
              </ComboboxOptions>
            )}
          </Combobox>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
