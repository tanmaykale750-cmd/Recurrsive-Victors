import { useEffect, useState } from 'react'
import { LuCircleCheck, LuBan, LuShieldAlert, LuArrowUpRight } from 'react-icons/lu'
import { Drawer } from '../ui/overlay'
import { Badge, ConfidenceMeter, EmptyState } from '../ui/display'
import { Tabs } from '../ui/controls'
import { Quote } from '../ui/JargonTerm'

const QUARANTINE_BELOW = 80

/**
 * What was extracted from one document, in four tabs.
 * data: { title, subtitle, sample?, dates[], events[], references[], rejected[] }
 */
export default function ExtractionDrawer({ data, open, onClose }) {
  const [tab, setTab] = useState('dates')
  useEffect(() => { if (open) setTab('dates') }, [open, data?.title])
  if (!data) return <Drawer open={false} onClose={onClose} title="" />
  const tabs = [
    { value: 'dates', label: 'Dates', count: data.dates.length },
    { value: 'events', label: 'Events', count: data.events.length },
    { value: 'references', label: 'References', count: data.references.length },
    { value: 'rejected', label: 'Rejected', count: data.rejected.length },
  ]
  const rows = data[tab]
  const Row = ({ x }) => {
    const body = (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <b className="tabular text-[13px] font-semibold">{x.text}</b>
          {tab === 'dates' && (x.quarantined || (x.confidence !== undefined && x.confidence < QUARANTINE_BELOW)) && (
            <Badge color="quarantine" icon={LuShieldAlert}>Sent to quarantine</Badge>
          )}
          {tab === 'references' && (x.inBundle ? <Badge color="success" icon={LuCircleCheck}>In bundle</Badge> : <Badge color="warning" icon={LuBan}>Not in bundle · flagged as missing</Badge>)}
          {x.page && <span className="tabular text-[11.5px] text-ink-3">p. {x.page}</span>}
          {x.onClick && <LuArrowUpRight className="ml-auto size-3.5 text-ink-3" />}
        </div>
        {x.sentence && <Quote text={x.sentence} className="mt-2" />}
        {x.reason && <p className="mt-1.5 text-[12.5px] text-ink-2">{x.reason}</p>}
        {tab === 'dates' && x.confidence !== undefined && <ConfidenceMeter value={x.confidence} className="mt-2.5 max-w-[220px]" />}
      </>
    )
    return x.onClick ? (
      <button onClick={x.onClick} className="w-full rounded-lg border border-line p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2/60">{body}</button>
    ) : (
      <div className="rounded-lg border border-line p-3">{body}</div>
    )
  }
  return (
    <Drawer open={open} onClose={onClose} title={data.title} subtitle={data.subtitle} width="max-w-[560px]" eyebrow={data.sample ? <Badge color="warning">Sample output · connect your extraction backend</Badge> : <Badge>Extraction</Badge>}>
      <Tabs value={tab} onChange={setTab} tabs={tabs} className="mb-3" />
      <div className="grid gap-2">
        {rows.map((x, i) => <Row key={i} x={x} />)}
        {!rows.length && (
          <EmptyState
            title={
              tab === 'rejected'
                ? 'Nothing was rejected. Every item had a source sentence.'
                : tab === 'references'
                  ? 'This document does not refer to other documents.'
                  : 'Nothing of this kind was found in this document.'
            }
          />
        )}
      </div>
      {tab === 'rejected' && rows.length > 0 && <p className="mt-3 text-[12px] text-ink-3">Items without a source sentence are never shown on the timeline.</p>}
    </Drawer>
  )
}
