import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { useUi } from '../../state/UiStore'
import { SidebarContent } from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from './CommandPalette'
import SourceDrawer from '../shared/SourceDrawer'
import HistoryDrawer from '../shared/HistoryDrawer'
import QuarantineDrawer from '../shared/QuarantineDrawer'
import Toaster from '../ui/Toaster'
import { cn } from '../../lib/cn'

export default function AppShell({ pages, page, children }) {
  const { collapsed, mobileNav, setMobileNav } = useUi()
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop / tablet sidebar: fixed, full viewport height */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-line bg-surface transition-[width] duration-200 ease-out md:block',
          collapsed ? 'w-[72px]' : 'w-[248px]',
        )}
      >
        <SidebarContent pages={pages} page={page} collapsed={collapsed} />
      </aside>

      {/* Mobile: off-canvas drawer */}
      <Dialog open={mobileNav} onClose={setMobileNav} className="relative z-50 md:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-[var(--overlay)] transition-opacity duration-200 data-closed:opacity-0" />
        <DialogPanel transition className="fixed inset-y-0 left-0 w-[272px] border-r border-line bg-surface shadow-float transition duration-200 ease-out data-closed:-translate-x-full">
          <SidebarContent pages={pages} page={page} collapsed={false} showCollapse={false} onNavigate={() => setMobileNav(false)} />
        </DialogPanel>
      </Dialog>

      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200 ease-out', collapsed ? 'md:pl-[72px]' : 'md:pl-[248px]')}>
        <Topbar page={page} />
        <main id="main" className="mx-auto w-full min-w-0 max-w-[1440px] flex-1 px-4 py-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <CommandPalette pages={pages} />
      <SourceDrawer />
      <HistoryDrawer />
      <QuarantineDrawer />
      <Toaster />
    </div>
  )
}
