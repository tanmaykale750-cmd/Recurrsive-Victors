/* Thin API client. Base URL comes from VITE_API_URL (default: same origin, proxied in dev). */
const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'cc-token'

let token = null
try { token = localStorage.getItem(TOKEN_KEY) } catch { /* storage unavailable */ }
let onUnauthorized = () => {}

export const getToken = () => token
export function setToken(t) {
  token = t
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}
export function setUnauthorizedHandler(fn) { onUnauthorized = fn }

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

async function request(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(BASE + path, { method, headers, body: form || (body !== undefined ? JSON.stringify(body) : undefined) })
  } catch {
    throw new ApiError('Cannot reach the CaseCompass server. Check that the backend is running.', 0)
  }
  if (res.status === 401 && token) {
    setToken(null)
    onUnauthorized()
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try { const j = await res.json(); if (j.detail) msg = typeof j.detail === 'string' ? j.detail : msg } catch { /* not JSON */ }
    throw new ApiError(msg, res.status)
  }
  if (raw) return res
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: body ?? {} }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (p, files) => {
    const form = new FormData()
    for (const f of files) form.append('files', f, f.name)
    return request(p, { method: 'POST', form })
  },
  /** Download a file with auth and save it under the server-provided name. */
  async download(p, fallbackName) {
    const res = await request(p, { raw: true })
    const cd = res.headers.get('Content-Disposition') || ''
    const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    return name
  },
  /** URL for opening a stored document in a new tab (token in the query string). */
  fileUrl: (docId, page) => `${BASE}/api/documents/${docId}/file?token=${encodeURIComponent(token || '')}${page ? `#page=${page}` : ''}`,
}
