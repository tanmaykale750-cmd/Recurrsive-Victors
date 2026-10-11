/* =========================================================
   Live case data.
   These bindings are filled from the backend bundle (GET /api/cases/:id/bundle)
   by applyBundle(). Because ES module exports are live bindings, every module
   that imports them reads the current case. CaseStore re-renders the app after
   each update, so components always show fresh data.
   ========================================================= */
import dayjs from 'dayjs'

export let TODAY_STR = dayjs().format('YYYY-MM-DD')
export let REVIEWER = ''
export let ACTIVE_CASE = { id: null, title: '', short: '', no: '', court: '', type: 'civil', stage: 0, stageName: '' }
export let DOCS = {}
export let ITEMS = []
export let GAPS = []
export let QUARANTINE = []
export let GLOSSARY = []
export let ONGOING_CASES = []
export let PAST_CASES = []
export let STAGES = {}
export let AI = { available: false, model: null }

export function applyBundle(b) {
  TODAY_STR = b.today || TODAY_STR
  REVIEWER = b.user?.name || ''
  ACTIVE_CASE = { ...b.case, type: b.case.type }
  DOCS = b.docs || {}
  ITEMS = b.items || []
  GAPS = b.gaps || []
  QUARANTINE = b.quarantine || []
  GLOSSARY = b.glossary || []
  STAGES = b.stages || {}
  AI = b.ai || AI
  ONGOING_CASES = (b.cases || []).filter((c) => c.status === 'active').map((c) => ({ ...c, active: c.id === b.case.id }))
  PAST_CASES = (b.cases || []).filter((c) => c.status === 'closed')
}

export function clearCaseData() {
  ACTIVE_CASE = { id: null, title: '', short: '', no: '', court: '', type: 'civil', stage: 0, stageName: '' }
  DOCS = {}; ITEMS = []; GAPS = []; QUARANTINE = []; ONGOING_CASES = []; PAST_CASES = []; REVIEWER = ''
}

/** Letters used to label conflicting records: Record A, Record B ... */
export const RECORD = 'ABCDEFGH'
