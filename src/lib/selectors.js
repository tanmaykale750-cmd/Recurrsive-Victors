import { DOCS, ITEMS, GAPS, QUARANTINE, GLOSSARY } from '../data/caseData'
import { urgency, daysFrom } from './dates'

/** Group a document type into the filter buckets shown on the timeline. */
export function docCat(type) {
  if (type === 'Pleading') return 'pleadings'
  if (type === 'Court order' || type === 'Court record') return 'orders'
  if (type === 'Notice') return 'notices'
  if (type === 'Application' || type === 'Affidavit') return 'applications'
  return 'exhibits'
}

export const DOC_FILTERS = [
  { key: 'pleadings', label: 'Pleadings' },
  { key: 'orders', label: 'Court orders' },
  { key: 'notices', label: 'Notices' },
  { key: 'applications', label: 'Applications' },
]

function clsOf(n, th) {
  if (n.kind === 'deadline') return urgency(n.date, th)
  if (n.confirmed) return 'confirmed'
  return n.kind === 'hearing' ? 'hearing' : 'event'
}

/**
 * Everything that can be placed on the timeline, after applying the reviewer's
 * corrections. Unresolved conflicts appear once per record (never merged).
 */
export function buildNodes(state) {
  const { resolutions, status, settings } = state
  const out = []
  for (const it of ITEMS) {
    if (it.kind === 'conflict') {
      const r = resolutions[it.id]
      if (r?.type === 'corrected') {
        const src = it.dates[r.basis === 'B' ? 1 : 0]
        out.push({ ...it, nodeId: it.id, kind: 'event', date: r.date, doc: src.doc, page: src.page, quote: src.quote, cls: 'corrected', corrected: true })
      } else {
        it.dates.forEach((d, i) =>
          out.push({ ...it, nodeId: `${it.id}-${i}`, date: d.date, doc: d.doc, page: d.page, quote: d.quote, ci: i, ghost: i > 0, cls: 'conflict' }),
        )
      }
    } else out.push({ ...it, nodeId: it.id })
  }
  for (const g of GAPS) {
    const r = resolutions[g.id]
    if (g.type === 'missing' && g.date && status[g.id] !== 'resolved')
      out.push({ ...g, nodeId: g.id, kind: 'missing', cls: 'missing' })
    if (g.type === 'undated' && r?.type === 'dated')
      out.push({ ...g, nodeId: g.id, kind: 'event', date: r.date, confirmed: true })
  }
  for (const q of QUARANTINE) {
    const r = resolutions[q.id]
    if (r?.type === 'confirmed') out.push({ ...q, nodeId: q.id, kind: r.kind, date: r.date, confirmed: true })
  }
  return out
    .map((n) => ({ ...n, cls: n.cls || clsOf(n, settings) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.nodeId.localeCompare(b.nodeId))
}

export function filterNodes(nodes, filter, q = '') {
  const query = q.trim().toLowerCase()
  return nodes.filter((n) => {
    if (query && !(`${n.title} ${n.quote || ''} ${DOCS[n.doc]?.name || ''}`.toLowerCase().includes(query))) return false
    if (filter === 'all') return true
    if (filter === 'deadlines') return n.kind === 'deadline' && daysFrom(n.date) >= 0
    if (filter === 'flagged') return ['conflict', 'missing', 'corrected'].includes(n.cls) || n.confirmed
    return docCat(DOCS[n.doc].type) === filter
  })
}

export function nodeLabel(n) {
  if (n.cls === 'conflict') return `Record ${'AB'[n.ci]}`
  if (n.cls === 'corrected') return 'Corrected'
  if (n.cls === 'missing') return 'Missing'
  if (n.confirmed) return n.kind === 'deadline' ? 'Deadline, confirmed' : 'Confirmed'
  return { event: 'Event', hearing: 'Hearing', deadline: 'Deadline' }[n.kind]
}

/** Every issue that needs a human: conflicts, gaps and quarantined dates. */
export function buildIssues(state) {
  return [
    ...ITEMS.filter((i) => i.kind === 'conflict').map((c) => ({ id: c.id, type: 'conflict', title: c.title, item: c })),
    ...GAPS.map((g) => ({ id: g.id, type: g.type, title: g.title, item: g })),
    ...QUARANTINE.map((q) => ({ id: q.id, type: 'quarantine', title: q.title, item: q })),
  ].map((i) => ({ ...i, status: state.status[i.id] || 'open', resolution: state.resolutions[i.id] }))
}

export function issueCounts(state) {
  const open = buildIssues(state).filter((i) => i.status !== 'resolved')
  const by = (t) => open.filter((i) => i.type === t).length
  return { conflicts: by('conflict'), missing: by('missing'), quarantine: by('quarantine'), gaps: by('undated') + by('sequence'), open: open.length }
}

export function deadlines(state) {
  return buildNodes(state).filter((n) => n.kind === 'deadline')
}
export function upcomingDeadlines(state) {
  return deadlines(state).filter((n) => daysFrom(n.date) >= 0)
}

/** Look up anything by id so the source drawer can show it. */
export function findEntity(id) {
  const base = id.replace(/-\d$/, '')
  const item = ITEMS.find((i) => i.id === base)
  if (item) return { kind: item.kind === 'conflict' ? 'conflict' : 'item', entity: item }
  const gap = GAPS.find((g) => g.id === base)
  if (gap) return { kind: 'gap', entity: gap }
  const q = QUARANTINE.find((x) => x.id === base)
  if (q) return { kind: 'quarantine', entity: q }
  return null
}

/* ---------- legal terms ---------- */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const TERM_RE = new RegExp(
  '\\b(' + GLOSSARY.flatMap((g) => g.alias).sort((a, b) => b.length - a.length).map(escapeRe).join('|') + ')\\b',
  'gi',
)
export const glossFor = (m) => GLOSSARY.find((g) => g.alias.some((a) => a.toLowerCase() === m.toLowerCase()))
export function termsIn(text) {
  const found = new Map()
  for (const m of text.match(TERM_RE) || []) {
    const g = glossFor(m)
    if (g) found.set(g.term, g)
  }
  return [...found.values()]
}
