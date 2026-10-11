import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { api } from '../lib/api'
import { applyBundle, clearCaseData } from '../data/caseData'
import { useAuth } from './AuthStore'

/* ---------------------------------------------------------------
   Case state, backed by the CaseCompass API.
   The bundle (documents, timeline items, issues, decisions, history)
   is loaded per case; every reviewer action is sent to the server and
   the bundle is re-fetched, so the UI always shows the stored record.
---------------------------------------------------------------- */

export const UPLOAD_STEPS = ['Uploading', 'Reading text (OCR)', 'Finding dates and events', 'Linking source sentences', 'Checking references to other documents', 'Ready for review']

const CASE_KEY = 'cc-case'
const readCase = () => { try { return Number(localStorage.getItem(CASE_KEY)) || null } catch { return null } }
const saveCase = (id) => { try { localStorage.setItem(CASE_KEY, String(id)) } catch { /* ignore */ } }

const initialState = {
  loading: true,
  error: null,
  caseId: null,
  version: 0,
  noCases: false,
  status: {},
  resolutions: {},
  notes: {},
  history: [],
  reminders: {},
  settings: { red: 7, amber: 30, showTerms: true },
  uploads: [],
  notifications: [],
  drawer: null,
  toasts: [],
}

let seq = 0
const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`
/** Timeline entries (events, hearings, deadlines) have codes like E01, H01, L01; issues are C/G/Q. */
const isEntry = (id) => /^[EHL]\d+$/.test(id || '')
const kindOf = (name) => (/\.(png|jpe?g|tiff?|heic|webp|bmp)$/i.test(name) ? 'image' : /\.pdf$/i.test(name) ? 'pdf' : 'other')

function reducer(state, a) {
  switch (a.type) {
    case 'loading':
      return { ...state, loading: true, error: null }
    case 'bundle': {
      const b = a.bundle
      return {
        ...state, loading: false, error: null, noCases: false, caseId: b.case.id, version: state.version + 1,
        status: b.status, resolutions: b.resolutions, notes: b.notes, history: b.history, reminders: b.reminders,
        settings: { red: 7, amber: 30, showTerms: true, ...(b.user.settings || {}) },
      }
    }
    case 'noCases':
      return { ...state, loading: false, noCases: true, caseId: null, version: state.version + 1 }
    case 'error':
      return { ...state, loading: false, error: a.error }
    case 'uploads':
      return { ...state, uploads: a.uploads }
    case 'reminder': {
      const cur = state.reminders[a.id] || { on: false, days: [7, 1] }
      return { ...state, reminders: { ...state.reminders, [a.id]: { ...cur, ...a.patch } } }
    }
    case 'settings':
      return { ...state, settings: { ...state.settings, ...a.patch } }
    case 'notifications':
      return { ...state, notifications: a.items }
    case 'drawer':
      return { ...state, drawer: a.id }
    case 'toast':
      return { ...state, toasts: [...state.toasts, a.toast] }
    case 'toastDone':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== a.id) }
    case 'reset':
      return { ...initialState, loading: false }
    default:
      return state
  }
}

const Ctx = createContext(null)

export function CaseProvider({ children }) {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(reducer, initialState)
  const caseRef = useRef(null)
  const pollRef = useRef(null)
  const sessionUploads = useRef(new Map()) // id -> upload row shown in the queue
  const stateRef = useRef(state)
  stateRef.current = state

  const toast = useCallback((message, tone = 'info') => {
    const id = uid('t')
    dispatch({ type: 'toast', toast: { id, message, tone } })
    setTimeout(() => dispatch({ type: 'toastDone', id }), 3600)
  }, [])

  const syncUploads = useCallback((processing = []) => {
    for (const p of processing) {
      const cur = sessionUploads.current.get(p.id)
      sessionUploads.current.set(p.id, { ...(cur || { kind: kindOf(p.name), size: p.size }), id: p.id, name: p.name, step: p.step, status: p.status, error: p.error })
    }
    dispatch({ type: 'uploads', uploads: [...sessionUploads.current.values()].reverse() })
  }, [])

  const loadNotifications = useCallback(() => {
    api.get('/api/notifications').then((items) => dispatch({ type: 'notifications', items })).catch(() => {})
  }, [])

  const load = useCallback(async (id, { quiet } = {}) => {
    if (!quiet) dispatch({ type: 'loading' })
    try {
      const b = await api.get(`/api/cases/${id}/bundle`)
      applyBundle(b)
      caseRef.current = b.case.id
      saveCase(b.case.id)
      dispatch({ type: 'bundle', bundle: b })
      syncUploads(b.processing)
      return b
    } catch (e) {
      dispatch({ type: 'error', error: e.message })
      throw e
    }
  }, [syncUploads])

  const refresh = useCallback(() => (caseRef.current ? load(caseRef.current, { quiet: true }).catch(() => {}) : Promise.resolve()), [load])

  /* poll processing documents until they are done, then refresh the bundle */
  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const id = caseRef.current
      if (!id) return
      try {
        const docs = await api.get(`/api/cases/${id}/documents`)
        const tracked = docs.filter((d) => sessionUploads.current.has(d.id) || d.status === 'queued' || d.status === 'processing')
        const before = [...sessionUploads.current.values()].filter((u) => u.status === 'queued' || u.status === 'processing').map((u) => u.id)
        syncUploads(tracked)
        const finished = tracked.filter((d) => before.includes(d.id) && (d.status === 'done' || d.status === 'failed'))
        for (const d of finished) {
          if (d.status === 'done') toast(`${d.title || d.name} is ready for review`, 'ok')
          else toast(`${d.name}: ${d.error || 'processing failed'}`)
        }
        if (finished.length) await refresh()
        if (!docs.some((d) => d.status === 'queued' || d.status === 'processing')) {
          clearInterval(pollRef.current)
          pollRef.current = null
          await refresh()
        }
      } catch { /* keep polling */ }
    }, 1200)
  }, [refresh, syncUploads, toast])

  /* initial load after sign-in */
  useEffect(() => {
    if (!user) {
      clearCaseData()
      sessionUploads.current.clear()
      caseRef.current = null
      dispatch({ type: 'reset' })
      return
    }
    ;(async () => {
      try {
        const cases = await api.get('/api/cases')
        if (!cases.length) return dispatch({ type: 'noCases' })
        const saved = readCase()
        const pick = cases.find((c) => c.id === saved) || cases.find((c) => c.status === 'active') || cases[0]
        const b = await load(pick.id)
        if (b.processing.some((d) => d.status !== 'failed')) startPolling()
        loadNotifications()
      } catch (e) {
        dispatch({ type: 'error', error: e.message })
      }
    })()
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [user, load, startPolling, loadNotifications])

  const run = useCallback(async (fn, okMessage) => {
    try {
      const r = await fn()
      await refresh()
      if (okMessage) toast(okMessage, 'ok')
      return r
    } catch (e) {
      toast(e.message)
      throw e
    }
  }, [refresh, toast])

  const actions = useMemo(() => {
    const cid = () => caseRef.current
    return {
      toast,
      refresh,
      openSource: (id) => dispatch({ type: 'drawer', id }),
      closeSource: () => dispatch({ type: 'drawer', id: null }),
      switchCase: async (id) => {
        sessionUploads.current.clear()
        dispatch({ type: 'uploads', uploads: [] })
        const b = await load(id)
        if (b.processing.some((d) => d.status !== 'failed')) startPolling()
      },
      createCase: async (data) => {
        const c = await api.post('/api/cases', data)
        sessionUploads.current.clear()
        await load(c.id)
        toast('Case created. Upload its documents to build the timeline.', 'ok')
        return c
      },
      updateCase: (patch) => run(() => api.patch(`/api/cases/${cid()}`, patch), patch.status === 'closed' ? 'Case closed' : patch.status === 'active' ? 'Case reopened' : 'Case updated'),
      setStatus: (id, status, title, label) => run(() => api.post(`/api/cases/${cid()}/issues/${id}/status`, { status }), `Marked ${label.toLowerCase()}`).catch(() => {}),
      addNote: (id, text, title, targetType) =>
        run(() => api.post(`/api/cases/${cid()}/notes`, { target_type: targetType || (isEntry(id) ? 'event' : 'issue'), target_code: id, text }), 'Note added').catch(() => {}),
      resolve: (id, resolution, opts = {}) => {
        // correcting a stated entry's date is stored as an event correction (the extracted date is kept)
        if (isEntry(id) && resolution.type === 'corrected')
          return run(() => api.post(`/api/cases/${cid()}/events/${id}/correction`, { date: resolution.date, reason: resolution.reason }), opts.message || 'Correction recorded').catch(() => {})
        const body = { type: resolution.type, reason: resolution.reason }
        for (const k of ['date', 'basis', 'kind', 'doc']) if (resolution[k]) body[k] = resolution[k]
        return run(() => api.post(`/api/cases/${cid()}/issues/${id}/resolve`, body), opts.message || 'Decision recorded').catch(() => {})
      },
      reopen: (id) =>
        isEntry(id)
          ? run(() => api.del(`/api/cases/${cid()}/events/${id}/correction`), 'Correction withdrawn. Extracted date restored.').catch(() => {})
          : run(() => api.post(`/api/cases/${cid()}/issues/${id}/reopen`), 'Issue reopened. Original records restored.').catch(() => {}),
      correctEvent: (code, date, reason) => run(() => api.post(`/api/cases/${cid()}/events/${code}/correction`, { date, reason }), 'Date corrected. The extracted date stays on record.'),
      withdrawCorrection: (code) => run(() => api.del(`/api/cases/${cid()}/events/${code}/correction`), 'Correction withdrawn. Extracted date restored.').catch(() => {}),
      setReminder: async (id, patch) => {
        dispatch({ type: 'reminder', id, patch })
        const cur = { on: false, days: [7, 1], ...(stateRef.current.reminders[id] || {}), ...patch }
        try {
          await api.put(`/api/cases/${cid()}/reminders/${id}`, { on: cur.on, days: cur.days })
          loadNotifications()
        } catch (e) {
          toast(e.message)
          refresh()
        }
      },
      setSettings: async (patch) => {
        dispatch({ type: 'settings', patch })
        try { await api.put('/api/auth/me/settings', patch) } catch (e) { toast(e.message) }
      },
      addFiles: async (files) => {
        try {
          const docs = await api.upload(`/api/cases/${cid()}/documents`, files)
          docs.forEach((d, i) => sessionUploads.current.set(d.id, { id: d.id, name: d.name, size: files[i]?.size || d.size, kind: kindOf(d.name), step: 0, status: d.status }))
          dispatch({ type: 'uploads', uploads: [...sessionUploads.current.values()].reverse() })
          startPolling()
        } catch (e) {
          toast(e.message)
        }
      },
      reprocessDocument: async (id) => {
        await api.post(`/api/documents/${id}/reprocess`)
        sessionUploads.current.set(id, { ...(sessionUploads.current.get(id) || { id, name: 'Document', kind: 'pdf' }), status: 'queued', step: 0 })
        startPolling()
        toast('Re-processing started')
      },
      deleteDocument: (id) => run(() => api.del(`/api/documents/${id}`), 'Document removed. Flags were recomputed.'),
      fetchExtraction: (docId) => api.get(`/api/documents/${docId}/extraction`),
      fetchReport: (opts) => api.get(`/api/cases/${cid()}/report?${new URLSearchParams(opts)}`),
      downloadReport: (fmt, opts) => api.download(`/api/cases/${cid()}/report.${fmt}?${new URLSearchParams(opts)}`, `CaseCompass_Chronology.${fmt}`),
      downloadIcs: () => api.download(`/api/cases/${cid()}/calendar.ics`, 'CaseCompass_deadlines.ics'),
    }
  }, [toast, refresh, load, run, startPolling, loadNotifications])

  return <Ctx.Provider value={{ state, ...actions }}>{children}</Ctx.Provider>
}

export function useCase() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCase must be used inside <CaseProvider>')
  return v
}
