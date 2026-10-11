import { ACTIVE_CASE, DOCS, REVIEWER } from '../data/caseData'
import { fmt, fmtNum, fmtTime } from './dates'
import { buildIssues, buildNodes } from './selectors'
import { ISSUE_META, STATUS_META } from './kinds'
import { TODAY_STR } from '../data/caseData'

export const DEFAULT_REPORT_OPTIONS = {
  citations: true,
  conflicts: true,
  quarantine: true,
  gaps: true,
  missingAppendix: true,
  correctionLog: true,
}

const src = (doc, page, cite) => (cite ? `${DOCS[doc].name}, p. ${page}` : DOCS[doc].name)

/** One structure feeds the on-screen preview, the PDF and the Word export. */
export function buildReport(state, opts = DEFAULT_REPORT_OPTIONS) {
  const nodes = buildNodes(state)
  const verified = nodes
    .filter((n) => n.cls !== 'conflict' && n.cls !== 'missing')
    .map((n, i) => ({
      no: i + 1,
      date: fmtNum(n.date),
      particulars: n.title + (n.kind === 'deadline' ? ' (deadline as stated in the record)' : ''),
      source: src(n.doc, n.page, opts.citations),
      note: n.corrected ? 'Date corrected by reviewer' : n.confirmed ? 'Date confirmed by reviewer' : '',
    }))

  const allowed = { conflict: opts.conflicts, quarantine: opts.quarantine, missing: opts.gaps, undated: opts.gaps, sequence: opts.gaps }
  const unresolved = buildIssues(state)
    .filter((i) => i.status !== 'resolved' && allowed[i.type])
    .map((i, k) => {
      const it = i.item
      let date = 'Not stated'
      let source = src(it.doc || it.dates?.[0].doc, it.page || it.dates?.[0].page, opts.citations)
      let particulars = i.title
      if (i.type === 'conflict') {
        date = it.dates.map((d, j) => `${fmtNum(d.date)} (Record ${'AB'[j]})`).join(' / ')
        source = it.dates.map((d) => src(d.doc, d.page, opts.citations)).join('; ')
        particulars += ': records give different dates'
      } else if (i.type === 'quarantine') {
        date = 'Not confirmed'
        particulars += `: ${it.reason.toLowerCase()}`
      } else if (i.type === 'missing') {
        date = it.date ? fmtNum(it.date) : 'Not stated'
        particulars = `${it.title}: referred to, not in bundle`
      } else particulars += `: ${it.why}`
      return { no: k + 1, type: ISSUE_META[i.type].label, date, particulars, source, status: STATUS_META[i.status].label }
    })

  const missing = buildIssues(state)
    .filter((i) => i.type === 'missing')
    .map((i) => ({ title: i.title, referredIn: src(i.item.doc, i.item.page, true), status: STATUS_META[i.status].label, note: i.resolution?.reason || '' }))

  const corrections = state.history
    .filter((h) => h.kind === 'correction')
    .map((h) => ({ at: fmtTime(h.at), who: h.who, detail: `${h.action}. ${h.detail}` }))

  return {
    meta: {
      heading: 'CHRONOLOGY OF EVENTS AND LIST OF DATES',
      matter: `In the matter of ${ACTIVE_CASE.no}`,
      parties: ACTIVE_CASE.title,
      prepared: `Prepared from the supplied record with CaseCompass on ${fmt(TODAY_STR)} by ${REVIEWER}`,
      disclaimer: 'This document organises the supplied record. It is not legal advice and makes no prediction about the outcome.',
    },
    verified,
    unresolved,
    missing: opts.missingAppendix ? missing : [],
    corrections: opts.correctionLog ? corrections : [],
    opts,
  }
}

export const VERIFIED_COLS = (cite) => [
  { key: 'no', label: 'No.', w: 0.06 },
  { key: 'date', label: 'Date', w: 0.14 },
  { key: 'particulars', label: 'Particulars', w: cite ? 0.38 : 0.6 },
  ...(cite ? [{ key: 'source', label: 'Source (document, page)', w: 0.26 }] : []),
  { key: 'note', label: 'Note', w: cite ? 0.16 : 0.2 },
]
export const UNRESOLVED_COLS = (cite) => [
  { key: 'no', label: 'No.', w: 0.06 },
  { key: 'type', label: 'Issue', w: 0.14 },
  { key: 'date', label: 'Date(s) in record', w: 0.18 },
  { key: 'particulars', label: 'Particulars', w: cite ? 0.3 : 0.5 },
  ...(cite ? [{ key: 'source', label: 'Source', w: 0.2 }] : []),
  { key: 'status', label: 'Status', w: 0.12 },
]

export function download(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
