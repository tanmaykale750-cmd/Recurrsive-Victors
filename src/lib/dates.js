import dayjs from 'dayjs'
import { TODAY_STR } from '../data/caseData'

export const TODAY = dayjs(TODAY_STR)

export const fmt = (s) => dayjs(s).format('D MMM YYYY')
export const fmtShort = (s) => dayjs(s).format('D MMM')
export const fmtNum = (s) => dayjs(s).format('DD.MM.YYYY')
export const fmtTime = (iso) => dayjs(iso).format('D MMM, HH:mm')
export const daysFrom = (s) => dayjs(s).startOf('day').diff(TODAY, 'day')

/** Urgency bucket for a stated deadline, using the user's thresholds. */
export function urgency(s, th = { red: 7, amber: 30 }) {
  const n = daysFrom(s)
  if (n < 0) return 'past'
  if (n <= th.red) return 'red'
  if (n <= th.amber) return 'amber'
  return 'green'
}

export function countdown(s) {
  const n = daysFrom(s)
  if (n === 0) return 'Due today'
  if (n === 1) return 'Due tomorrow'
  if (n > 1) return `in ${n} days`
  if (n === -1) return 'yesterday'
  return `${-n} days ago`
}

export function relTime(iso) {
  const now = dayjs()
  const t = dayjs(iso)
  const mins = now.diff(t, 'minute')
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24 && now.isSame(t, 'day')) return `today, ${t.format('HH:mm')}`
  return t.format('D MMM, HH:mm')
}
