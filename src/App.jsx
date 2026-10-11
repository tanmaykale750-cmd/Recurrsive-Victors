import { useEffect } from 'react'
import { LuLayoutDashboard, LuCloudUpload, LuGitCommitHorizontal, LuListChecks, LuCalendarDays, LuFileText } from 'react-icons/lu'
import AppShell from './components/layout/AppShell'
import { useRoute } from './lib/router'
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

export default function App() {
  const { path } = useRoute()
  const page = PAGES.find((p) => p.path === path) || PAGES[0]
  const Page = page.component

  useEffect(() => {
    document.title = `${page.title} · CaseCompass`
    window.scrollTo({ top: 0 })
  }, [page])

  return (
    <AppShell pages={PAGES} page={page}>
      <div key={page.path} className="animate-page-in">
        <Page />
      </div>
    </AppShell>
  )
}
