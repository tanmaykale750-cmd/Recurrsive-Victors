import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!getToken())

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (!getToken()) return
    api.get('/api/auth/me').then(setUser).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])

  const value = useMemo(
    () => ({
      user,
      ready,
      setUser,
      logout,
      login: async (email, password) => {
        const r = await api.post('/api/auth/login', { email, password })
        setToken(r.token)
        setUser(r.user)
      },
      register: async (data) => {
        const r = await api.post('/api/auth/register', data)
        setToken(r.token)
        setUser(r.user)
      },
    }),
    [user, ready, logout],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}
