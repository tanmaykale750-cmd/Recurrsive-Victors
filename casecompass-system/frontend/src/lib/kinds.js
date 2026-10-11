/* Every timeline class maps onto one of the six theme colours.
   Values are CSS variables, so they follow light/dark mode. Use via `--c`. */
const V = {
  primary: 'var(--primary)',
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  success: 'var(--success)',
  quarantine: 'var(--quarantine)',
  muted: 'var(--ink-3)',
  brass: 'var(--brass)',
}

export const KIND_COLOR = {
  event: V.primary,
  hearing: V.primary,
  red: V.danger,
  amber: V.warning,
  green: V.success,
  past: V.muted,
  conflict: V.danger,
  missing: V.warning,
  confirmed: V.success,
  corrected: V.success,
  quarantine: V.quarantine,
  undated: V.muted,
  sequence: V.muted,
  navy: V.primary,
  ...V,
}

export const ISSUE_META = {
  conflict: { label: 'Date conflict', short: 'Conflict', color: V.danger },
  missing: { label: 'Missing document', short: 'Missing', color: V.warning },
  quarantine: { label: 'Quarantined date', short: 'Quarantine', color: V.quarantine },
  undated: { label: 'Undated event', short: 'Undated', color: V.muted },
  sequence: { label: 'Skipped step', short: 'Gap', color: V.muted },
}

export const STATUS_META = {
  open: { label: 'Open', color: V.danger },
  in_review: { label: 'In review', color: V.warning },
  resolved: { label: 'Resolved', color: V.success },
}

export const c = (key) => ({ '--c': KIND_COLOR[key] || key })
