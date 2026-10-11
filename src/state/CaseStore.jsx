import { createContext, useCallback, useContext, useMemo, useReducer, useRef } from 'react'
import { REVIEWER, SEED_HISTORY } from '../data/caseData'

/* ---------------------------------------------------------------
   Case state: review status, reviewer corrections, notes, history,
   reminders and uploads. Swap the reducer's side for API calls
   when a backend exists; components only use the hooks below.
---------------------------------------------------------------- */

const initialState = {
  status: { C02: 'in_review' },
  resolutions: {},
  notes: {
    C02: [{ text: "Asked counsel to check the process server's original report before choosing a date.", at: '2026-10-09T16:20:00', who: REVIEWER }],
  },
  history: SEED_HISTORY,
  reminders: { L02: { on: true, days: [7, 1] }, L03: { on: true, days: [3] } },
  uploads: [],
  drawer: null,
  settings: { red: 7, amber: 30, showTerms: true },
  toasts: [],
}

let seq = 0
const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`
const now = () => new Date().toISOString()

function log(state, entry) {
  return [{ id: uid('h'), at: now(), who: REVIEWER, ...entry }, ...state.history]
}

function reducer(state, a) {
  switch (a.type) {
    case 'status':
      return {
        ...state,
        status: { ...state.status, [a.id]: a.status },
        history: log(state, { action: 'Status changed', detail: `${a.title}: marked ${a.label}`, issueId: a.id, kind: 'status' }),
      }
    case 'note': {
      const list = state.notes[a.id] || []
      return {
        ...state,
        notes: { ...state.notes, [a.id]: [...list, { text: a.text, at: now(), who: REVIEWER }] },
        history: log(state, { action: 'Note added', detail: `${a.title}: "${a.text.slice(0, 80)}${a.text.length > 80 ? '…' : ''}"`, issueId: a.id, kind: 'note' }),
      }
    }
    case 'resolve':
      return {
        ...state,
        resolutions: { ...state.resolutions, [a.id]: { ...a.resolution, at: now(), who: REVIEWER } },
        status: { ...state.status, [a.id]: a.status || 'resolved' },
        history: log(state, { action: a.action, detail: a.detail, issueId: a.id, kind: 'correction' }),
      }
    case 'reopen': {
      const resolutions = { ...state.resolutions }
      delete resolutions[a.id]
      return {
        ...state,
        resolutions,
        status: { ...state.status, [a.id]: 'open' },
        history: log(state, { action: 'Reopened', detail: `${a.title}: earlier correction withdrawn, original records restored`, issueId: a.id, kind: 'correction' }),
      }
    }
    case 'reminder': {
      const cur = state.reminders[a.id] || { on: false, days: [7, 1] }
      return { ...state, reminders: { ...state.reminders, [a.id]: { ...cur, ...a.patch } } }
    }
    case 'uploadAdd':
      return {
        ...state,
        uploads: [...a.uploads, ...state.uploads],
        history: a.uploads.reduce((h, u) => [{ id: uid('h'), at: now(), who: REVIEWER, action: 'Uploaded', detail: u.name, kind: 'upload' }, ...h], state.history),
      }
    case 'uploadPatch':
      return { ...state, uploads: state.uploads.map((u) => (u.id === a.id ? { ...u, ...a.patch } : u)) }
    case 'drawer':
      return { ...state, drawer: a.id }
    case 'settings':
      return { ...state, settings: { ...state.settings, ...a.patch } }
    case 'toast':
      return { ...state, toasts: [...state.toasts, a.toast] }
    case 'toastDone':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== a.id) }
    case 'log':
      return { ...state, history: log(state, a.entry) }
    default:
      return state
  }
}

const Ctx = createContext(null)

const STEPS = ['Uploading', 'Reading text (OCR)', 'Finding dates and events', 'Linking source sentences', 'Checking references to other documents', 'Ready for review']

/* Sample extraction shown for files added in the demo. Real output comes from your backend. */
function sampleResults(name) {
  return {
    dates: [
      { text: '14.10.2026', sentence: 'Matter be listed for further proceedings on 14.10.2026.', page: 1, confidence: 96 },
      { text: '08.10.2026', sentence: 'Order pronounced in open court on 08.10.2026.', page: 2, confidence: 91 },
    ],
    events: [{ text: 'Further proceedings listed', sentence: 'Matter be listed for further proceedings on 14.10.2026.', page: 1 }],
    references: [{ text: 'IA No. 302/2026', sentence: 'Reply to IA No. 302/2026 is taken on record.', page: 1, inBundle: false }],
    rejected: [{ text: '"Hearing likely next month"', reason: 'No source sentence found in the document, so it was not added.' }],
    sample: true,
    file: name,
  }
}

export function CaseProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const timers = useRef({})

  const toast = useCallback((message, tone = 'info') => {
    const id = uid('t')
    dispatch({ type: 'toast', toast: { id, message, tone } })
    setTimeout(() => dispatch({ type: 'toastDone', id }), 3200)
  }, [])

  const actions = useMemo(
    () => ({
      toast,
      openSource: (id) => dispatch({ type: 'drawer', id }),
      closeSource: () => dispatch({ type: 'drawer', id: null }),
      setStatus: (id, status, title, label) => {
        dispatch({ type: 'status', id, status, title, label })
        toast(`Marked ${label.toLowerCase()}`, 'ok')
      },
      addNote: (id, text, title) => {
        dispatch({ type: 'note', id, text, title })
        toast('Note added to the issue', 'ok')
      },
      resolve: (id, resolution, { action, detail, status, message }) => {
        dispatch({ type: 'resolve', id, resolution, action, detail, status })
        toast(message || 'Correction recorded', 'ok')
      },
      reopen: (id, title) => {
        dispatch({ type: 'reopen', id, title })
        toast('Issue reopened. Original records restored.')
      },
      setReminder: (id, patch) => dispatch({ type: 'reminder', id, patch }),
      setSettings: (patch) => dispatch({ type: 'settings', patch }),
      addFiles: (files) => {
        const uploads = [...files].map((f) => ({
          id: uid('u'),
          name: f.name,
          size: f.size || 0,
          kind: /\.(png|jpe?g|tiff?|heic|webp)$/i.test(f.name) ? 'image' : /\.pdf$/i.test(f.name) ? 'pdf' : 'other',
          step: 0,
          status: 'processing',
          results: null,
        }))
        dispatch({ type: 'uploadAdd', uploads })
        uploads.forEach((u, i) => {
          let step = 0
          timers.current[u.id] = setInterval(() => {
            step += 1
            if (step >= STEPS.length - 1) {
              clearInterval(timers.current[u.id])
              dispatch({ type: 'uploadPatch', id: u.id, patch: { step: STEPS.length - 1, status: 'done', results: sampleResults(u.name) } })
              dispatch({ type: 'log', entry: { who: 'CaseCompass', action: 'Extracted', detail: `${u.name}: 2 dates, 1 event, 1 reference; 1 item rejected for having no source`, kind: 'extract' } })
              toast(`${u.name} is ready for review`, 'ok')
            } else dispatch({ type: 'uploadPatch', id: u.id, patch: { step } })
          }, 700 + i * 140)
        })
      },
    }),
    [toast],
  )

  return <Ctx.Provider value={{ state, ...actions }}>{children}</Ctx.Provider>
}

export const UPLOAD_STEPS = STEPS

export function useCase() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCase must be used inside <CaseProvider>')
  return v
}
