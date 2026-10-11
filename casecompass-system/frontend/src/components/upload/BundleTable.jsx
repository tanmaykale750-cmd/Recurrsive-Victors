import { useMemo, useState } from 'react'
import { LuSearch, LuChevronRight, LuFolderOpen } from 'react-icons/lu'
import { DOCS, ITEMS, QUARANTINE } from '../../data/caseData'
import { fmt } from '../../lib/dates'
import { Card, EmptyState } from '../ui/display'
import { Select } from '../ui/controls'

/** What CaseCompass found in one bundle document. */
export function docExtraction(id) {
  const items = ITEMS.flatMap((i) =>
    i.kind === 'conflict' ? i.dates.filter((d) => d.doc === id).map((d) => ({ ...d, id: i.id, title: i.title, kind: 'conflict' })) : i.doc === id ? [i] : [],
  )
  const quarantined = QUARANTINE.filter((q) => q.doc === id)
  return { items, quarantined, refs: DOCS[id].refs }
}

export default function BundleTable({ onOpen }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return Object.entries(DOCS)
      .map(([id, d]) => ({ id, d, x: docExtraction(id) }))
      .filter(({ id, d }) => (type === 'all' || d.type === type) && (!s || `${id} ${d.name} ${d.type} ${d.format}`.toLowerCase().includes(s)))
  }, [q, type, DOCS]) // DOCS is a live binding that changes with every case bundle
  const TYPES = [...new Set(Object.values(DOCS).map((d) => d.type))].sort()

  return (
    <Card
      title="Case bundle"
      desc={Object.keys(DOCS).length ? `${Object.keys(DOCS).length} processed documents · select one to see what was extracted` : 'Processed documents appear here'}
      actions={
        <div className="flex items-center gap-2">
          <label className="hidden h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-primary sm:flex">
            <LuSearch className="size-3.5 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" className="w-36 bg-transparent text-[12.5px] outline-none placeholder:text-ink-3" aria-label="Search documents" />
          </label>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="h-8 w-[150px] text-[12.5px]" aria-label="Filter by document type">
            <option value="all">All types</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      }
      bodyClassName="px-0 pb-1"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-[13px]">
          <thead className="border-y border-line bg-surface-2/50 text-[11.5px] text-ink-3">
            <tr>
              <th className="py-2 pr-3 pl-4 font-medium">Document</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Added</th>
              <th className="px-3 py-2 font-medium">Extracted</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, d, x }) => {
              const flags = x.items.filter((i) => i.kind === 'conflict').length + x.quarantined.length + x.refs.filter((r) => r.gap).length
              return (
                <tr key={id} onClick={() => onOpen(id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(id)} tabIndex={0} className="group cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/60 focus-visible:bg-surface-2">
                  <td className="py-2.5 pr-3 pl-4">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="tabular rounded border border-line bg-surface-2 px-1 font-mono text-[10.5px] font-semibold text-ink-2">{id}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.name}</span>
                        <span className="tabular block text-[11.5px] text-ink-3">{d.format} · {d.pages} page{d.pages === 1 ? '' : 's'}{d.ocr ? ` · OCR ${Math.round(d.ocr)}%` : ''}{d.ai ? ' · AI-assisted' : ''}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{d.type}</td>
                  <td className="tabular px-3 py-2.5 whitespace-nowrap text-ink-3">{fmt(d.uploaded)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                    <span className="tabular">{x.items.length} dated</span>
                    {flags > 0 && <span className="ml-2 inline-flex items-center gap-1 text-warning"><i className="size-1.5 rounded-full bg-warning" />{flags} flag{flags > 1 ? 's' : ''}</span>}
                  </td>
                  <td className="pr-3"><LuChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && <EmptyState icon={LuFolderOpen} title={Object.keys(DOCS).length ? 'No documents match this search.' : 'No documents yet. Drop files above to start.'} className="mx-4 my-3" />}
      </div>
    </Card>
  )
}
