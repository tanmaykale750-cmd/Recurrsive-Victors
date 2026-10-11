import { useState } from 'react'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react'
import { LuChevronDown, LuCircleCheck, LuCircleAlert, LuCircleDashed } from 'react-icons/lu'
import { ACTIVE_CASE, STAGES } from '../../data/caseData'
import { Card } from '../ui/display'
import { Select } from '../ui/controls'
import { cn } from '../../lib/cn'

/** Checklist of documents a case of this type should contain, stage by stage. */
export default function ExpectedDocs() {
  const [type, setType] = useState(ACTIVE_CASE.type)
  const S = STAGES[type]
  const all = S.list.flatMap((s) => s.docs)
  const have = all.filter((d) => S.present.includes(d)).length
  const due = S.list.slice(0, S.now + 1).flatMap((s) => s.docs).filter((d) => !S.present.includes(d)).length

  return (
    <Card
      title="Expected documents"
      desc={S.now >= 0 ? `${have} of ${all.length} in bundle · ${due} missing` : 'Checklist for this case type'}
      actions={
        <Select value={type} onChange={(e) => setType(e.target.value)} className="h-8 w-[118px] text-[12px]" aria-label="Case type">
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      }
      bodyClassName="px-2 pb-2"
    >
      <div className="grid grid-cols-1 gap-0.5" key={type}>
        {S.list.map((s, i) => {
          const missing = S.now >= 0 && i <= S.now ? s.docs.filter((d) => !S.present.includes(d)).length : 0
          const current = i === S.now
          return (
            <Disclosure key={s.n} defaultOpen={current}>
              <DisclosureButton className={cn('group flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-2', current && 'bg-primary-soft/60')}>
                <span className={cn('tabular grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold', i < S.now ? 'bg-primary text-on-primary' : current ? 'bg-primary-soft text-primary ring-1 ring-primary' : 'bg-surface-2 text-ink-3')}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{s.n}</span>
                  <span className="text-[11.5px] text-ink-3">{s.m}{current ? ' · current stage' : ''}</span>
                </span>
                {missing > 0 && <span className="tabular rounded-full bg-warning-soft px-1.5 text-[11px] leading-[18px] font-semibold text-warning">{missing} missing</span>}
                <LuChevronDown className="size-4 shrink-0 text-ink-3 transition-transform group-data-open:rotate-180" />
              </DisclosureButton>
              <DisclosurePanel className="animate-fade pt-0.5 pr-2 pb-2 pl-9">
                <ul className="grid gap-0.5">
                  {s.docs.map((d) => {
                    const has = S.present.includes(d)
                    const past = S.now >= 0 && i <= S.now
                    const [Icon, cls, t] = has
                      ? [LuCircleCheck, 'text-success', 'In bundle']
                      : past
                        ? [LuCircleAlert, 'text-warning', 'Not in bundle']
                        : [LuCircleDashed, 'text-ink-3', S.now < 0 ? 'Awaiting upload' : 'Expected later']
                    return (
                      <li key={d} className="flex items-center gap-2 py-0.5 text-[12.5px]">
                        <Icon className={cn('size-3.5 shrink-0', cls)} />
                        <span className="min-w-0 flex-1 truncate text-ink-2">{d}</span>
                        <span className={cn('shrink-0 text-[11px]', has ? 'text-ink-3' : cls)}>{t}</span>
                      </li>
                    )
                  })}
                </ul>
              </DisclosurePanel>
            </Disclosure>
          )
        })}
      </div>
    </Card>
  )
}
