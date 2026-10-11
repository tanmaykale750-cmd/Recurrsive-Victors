import { LuCircleCheck, LuInfo } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'

export default function Toaster() {
  const { state } = useCase()
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[110] grid w-[min(360px,calc(100vw-32px))] gap-2" aria-live="polite" role="status">
      {state.toasts.map((t) => (
        <div key={t.id} className="animate-page-in pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-[13px] text-ink shadow-float">
          {t.tone === 'ok' ? <LuCircleCheck className="mt-px size-4 shrink-0 text-success" /> : <LuInfo className="mt-px size-4 shrink-0 text-primary" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
