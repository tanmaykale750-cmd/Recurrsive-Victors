import { useEffect } from 'react'
import { LuLayoutDashboard, LuCloudUpload, LuGitCommitHorizontal, LuListChecks, LuCalendarDays, LuFileText, LuCompass, LuPlus, LuRotateCw } from 'react-icons/lu'
import AppShell from './components/layout/AppShell'
import NewCaseDialog from './components/layout/NewCaseDialog'
import { useRoute } from './lib/router'
import { useAuth } from './state/AuthStore'
import { useCase } from './state/CaseStore'
import { useUi } from './state/UiStore'
import { Button } from './components/ui/Button'
import { Skeleton } from './components/ui/display'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import UploadDocuments from './pages/UploadDocuments'
import CaseTimeline from './pages/CaseTimeline'
import ReviewIssues from './pages/ReviewIssues'
import CalendarTracker from './pages/CalendarTracker'
import ChronologyReport from './pages/ChronologyReport'

/* The six pages, in workflow order. The sidebar, breadcrumb and command palette read this list. */
export const PAGES = [
  { path: 'dashboard', title: 'Dashboard', icon: LuLayoutDashboard, component: Dashboard },
  { path: 'upload', title: 'Upload Documents', icon: LuCloudUpload, component: UploadDocuments },
  { path: 'timeline', title: 'Case Timeline', icon: LuGitCommitHorizontal, component: CaseTimeline },
  { path: 'review', title: 'Review & Resolve Issues', short: 'Review & Resolve', icon: LuListChecks, component: ReviewIssues },
  { path: 'calendar', title: 'Calendar & Deadline Tracker', short: 'Calendar & Deadlines', icon: LuCalendarDays, component: CalendarTracker },
  { path: 'report', title: 'Chronology Report & Export', short: 'Chronology Report', icon: LuFileText, component: ChronologyReport },
]

function Centered({ children }) {
  return <div className="grid min-h-dvh place-items-center px-4">{children}</div>
}

function Loading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-8 w-80" />
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-60" /><Skeleton className="h-60" /></div>
    </div>
  )
}

export default function App() {
  const { user, ready } = useAuth()
  const { state, refresh } = useCase()
  const { newCase, setNewCase } = useUi()
  const { path } = useRoute()
  const page = PAGES.find((p) => p.path === path) || PAGES[0]
  const Page = page.component

  useEffect(() => {
    document.title = `${page.title} · CaseCompass`
    window.scrollTo({ top: 0 })
  }, [page])

  if (!ready) return <Centered><LuCompass className="size-8 animate-spin text-brass" /></Centered>
  if (!user) return <AuthPage />

  if (state.noCases)
    return (
      <Centered>
        <div className="max-w-[420px] text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brass-soft text-brass"><LuCompass className="size-6" /></span>
          <h1 className="mt-4 text-[22px]">Welcome, {user.name.split(' ')[0]}</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">Create your first case, then upload its documents. CaseCompass builds the timeline and flags what needs a decision.</p>
          <Button variant="primary" className="mt-5" onClick={() => setNewCase(true)}><LuPlus /> Create a case</Button>
        </div>
        <NewCaseDialog open={newCase} onClose={() => setNewCase(false)} />
      </Centered>
    )

  if (state.error && !state.caseId)
    return (
      <Centered>
        <div className="max-w-[420px] text-center">
          <h1 className="text-[20px]">Could not load your cases</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">{state.error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}><LuRotateCw /> Try again</Button>
        </div>
      </Centered>
    )

  return (
    <AppShell pages={PAGES} page={page}>
      {state.loading && !state.caseId ? (
        <Loading />
      ) : (
        <div key={`${page.path}-${state.caseId}`} className="animate-page-in">
          <Page />
        </div>
      )}
      <NewCaseDialog open={newCase} onClose={() => { setNewCase(false); refresh() }} />
    </AppShell>
  )
}
