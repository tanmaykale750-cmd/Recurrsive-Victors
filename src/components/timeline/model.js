import { DOCS } from '../../data/caseData'
import { docCat, filterNodes } from '../../lib/selectors'
import { KIND_COLOR } from '../../lib/kinds'

export const LANES = [
  { key: 'event', label: 'Events' },
  { key: 'hearing', label: 'Hearings' },
  { key: 'deadline', label: 'Deadlines' },
  { key: 'issue', label: 'Issues' },
]

export function laneOf(n) {
  if (n.cls === 'conflict' || n.cls === 'missing') return 'issue'
  if (n.kind === 'deadline') return 'deadline'
  if (n.kind === 'hearing') return 'hearing'
  return 'event'
}

export const nodeColor = (n) => KIND_COLOR[n.cls] || KIND_COLOR.event

/** Slice filter (all / deadlines / flagged) + optional document types + words. */
export function applyFilters(nodes, { slice, types, q }) {
  const base = filterNodes(nodes, slice, q)
  if (!types.length) return base
  return base.filter((n) => types.includes(docCat(DOCS[n.doc].type)))
}

/** Human label for a node's kind. */
export function kindLabel(n) {
  if (n.cls === 'conflict') return `Conflict · Record ${'AB'[n.ci]}`
  if (n.cls === 'missing') return 'Missing document'
  if (n.corrected) return 'Event · corrected'
  if (n.confirmed) return `${n.kind === 'deadline' ? 'Deadline' : n.kind === 'hearing' ? 'Hearing' : 'Event'} · confirmed`
  return { event: 'Event', hearing: 'Hearing', deadline: 'Deadline' }[n.kind] || 'Event'
}
