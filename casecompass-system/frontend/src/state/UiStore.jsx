import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/* ---------------------------------------------------------------
   Interface-only state (theme, sidebar, overlays). Case data and
   reviewer decisions stay in CaseStore.
---------------------------------------------------------------- */

const read = (k, fallback) => {
  try {
    const v = localStorage.getItem(k)
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}
const write = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

const Ctx = createContext(null)

export function UiProvider({ children }) {
  const [theme, setThemeState] = useState(() => read('cc-theme', 'light'))
  const [collapsedPref, setCollapsedPref] = useState(() => read('cc-sidebar', 'expanded') === 'collapsed')
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280)
  const [mobileNav, setMobileNav] = useState(false)
  const [palette, setPalette] = useState(false)
  const [history, setHistory] = useState(false)
  const [quarantine, setQuarantine] = useState(false)
  const [newCase, setNewCase] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    write('cc-theme', theme)
  }, [theme])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  /* Ctrl/⌘+K and "/" open the command palette */
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '')
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const setTheme = useCallback((t) => setThemeState(t), [])
  const toggleCollapsed = useCallback(() => {
    setCollapsedPref((c) => {
      write('cc-sidebar', c ? 'expanded' : 'collapsed')
      return !c
    })
  }, [])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
      collapsed: collapsedPref || narrow,
      narrow,
      toggleCollapsed,
      mobileNav,
      setMobileNav,
      palette,
      setPalette,
      history,
      setHistory,
      quarantine,
      setQuarantine,
      newCase,
      setNewCase,
    }),
    [theme, setTheme, collapsedPref, narrow, toggleCollapsed, mobileNav, palette, history, quarantine, newCase],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useUi() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUi must be used inside <UiProvider>')
  return v
}
