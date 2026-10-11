import { useSyncExternalStore } from 'react'
import { cn } from './cn'

/* A tiny hash router: works on any static host (GitHub Pages, Netlify) with no server config. */
function subscribe(cb) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const getHash = () => window.location.hash

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, getHash, () => '')
  const raw = hash.replace(/^#\/?/, '')
  const [path, qs = ''] = raw.split('?')
  return { path: path || 'dashboard', query: new URLSearchParams(qs) }
}

export function navigate(to) {
  window.location.hash = '#/' + to
}

export function Link({ to, className, children, ...rest }) {
  return (
    <a href={'#/' + to} className={cn(className)} {...rest}>
      {children}
    </a>
  )
}
