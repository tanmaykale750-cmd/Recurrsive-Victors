import { LuShieldAlert, LuCircleCheck } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { useUi } from '../../state/UiStore'
import { buildIssues } from '../../lib/selectors'
import { Drawer } from '../ui/overlay'
import { Badge, EmptyState } from '../ui/display'
import QuarantineCard from './QuarantineCard'

/** USP 4: the Confidence-Gated Date Quarantine Drawer. */
export default function QuarantineDrawer() {
  const { state } = useCase()
  const { quarantine, setQuarantine } = useUi()
  const all = buildIssues(state).filter((i) => i.type === 'quarantine')
  const open = all.filter((i) => i.status !== 'resolved')
  const done = all.filter((i) => i.status === 'resolved')
  return (
    <Drawer
      open={quarantine}
      onClose={() => setQuarantine(false)}
      width="max-w-[560px]"
      eyebrow={<Badge color="quarantine" icon={LuShieldAlert}>{open.length} held back</Badge>}
      title="Quarantined dates"
      subtitle="Blurry, handwritten or vague dates are kept off the timeline instead of being guessed. Confirm each one against the original."
    >
      <div className="grid gap-3">
        {open.map((i) => (
          <QuarantineCard key={i.id} issue={i} compact />
        ))}
        {!open.length && <EmptyState icon={LuCircleCheck} title="No dates are waiting. Every quarantined snippet has been confirmed or dismissed." />}
        {done.length > 0 && (
          <>
            <div className="eyebrow mt-3">Confirmed or dismissed</div>
            {done.map((i) => (
              <QuarantineCard key={i.id} issue={i} compact />
            ))}
          </>
        )}
      </div>
    </Drawer>
  )
}
