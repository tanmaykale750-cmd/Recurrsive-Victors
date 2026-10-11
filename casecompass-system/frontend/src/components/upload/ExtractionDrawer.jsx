import { useEffect, useState } from 'react'
import { LuCircleCheck, LuBan, LuShieldAlert, LuArrowUpRight, LuExternalLink, LuRotateCw, LuTrash2, LuSparkles, LuLink } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { api } from '../../lib/api'
import { Drawer } from '../ui/overlay'
import { Badge, ConfidenceMeter, EmptyState, Skeleton } from '../ui/display'
import { Tabs } from '../ui/controls'
import { Button } from '../ui/Button'
import { Quote } from '../ui/JargonTerm'
import { fmt } from '../../lib/dates'
import { navigate } from '../../lib/router'

const DATE_STATUS = {
  timeline: { label: 'On the timeline', color: 'success', icon: LuCircleCheck },
  quarantined: { label: 'Sent to quarantine', color: 'quarantine', icon: LuShieldAlert },
  reference: { label: 'Refers to another document', color: 'primary', icon: LuLink },
}

/** What was extracted from one document, in four tabs. docId: backend document id. */
export default function ExtractionDrawer({ docId, open, onClose }) {
  const { fetchExtraction, openSource, reprocessDocument, deleteDocument, toast } = useCase()
  const [tab, setTab] = useState('dates')
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!open || !docId) return
    setTab('dates')
    setData(null)
    fetchExtraction(docId).then(setData).catch((e) => toast(e.message))
  }, [open, docId, fetchExtraction, toast])

  const tabs = data
    ? [
        { value: 'dates', label: 'Dates', count: data.dates.length },
        { value: 'events', label: 'Events', count: data.events.length },
        { value: 'references', label: 'References', count: data.references.length },
        { value: 'rejected', label: 'Rejected', count: data.rejected.length },
      ]
    : []
  const rows = data ? data[tab] : []

  const Row = ({ x }) => {
    const st = DATE_STATUS[x.status]
    const click = tab === 'events' ? () => { onClose(); openSource(x.code) } : tab === 'references' && x.inBundle === false ? () => { onClose(); navigate('review?tab=missing') } : null
    const body = (
      <>
        <div className="flex flex-wrap items-center gap-2">
          <b className="tabular text-[13px] font-semibold">{x.text}</b>
          {tab === 'dates' && st && <Badge color={st.color} icon={st.icon}>{x.status === 'quarantined' && x.reason ? x.reason : st.label}</Badge>}
          {tab === 'events' && <Badge>{x.kind}{x.date ? ` · ${fmt(x.date)}` : ''}</Badge>}
          {tab === 'events' && x.method === 'ai' && <Badge color="brass" icon={LuSparkles}>AI-refined title</Badge>}
          {tab === 'references' && (x.inBundle ? <Badge color="success" icon={LuCircleCheck}>In bundle{x.doc ? ` as ${x.doc}` : ''}</Badge> : <Badge color="warning" icon={LuBan}>Not in bundle · flagged as missing</Badge>)}
          {x.page && <span className="tabular text-[11.5px] text-ink-3">p. {x.page}</span>}
          {click && <LuArrowUpRight className="ml-auto size-3.5 text-ink-3" />}
        </div>
        {x.sentence && <Quote text={x.sentence} className="mt-2" />}
        {x.reason && tab === 'rejected' && <p className="mt-1.5 text-[12.5px] text-ink-2">{x.reason}</p>}
        {tab === 'dates' && x.confidence !== null && x.confidence !== undefined && <ConfidenceMeter value={Math.round(x.confidence)} label="OCR confidence" className="mt-2.5 max-w-[220px]" />}
      </>
    )
    return click ? (
      <button onClick={click} className="w-full rounded-lg border border-line p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2/60">{body}</button>
    ) : (
      <div className="rounded-lg border border-line p-3">{body}</div>
    )
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={data?.title || 'Loading…'}
      subtitle={data?.subtitle}
      width="max-w-[580px]"
      eyebrow={<Badge>Extraction</Badge>}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={() => window.open(api.fileUrl(docId), '_blank', 'noopener')}><LuExternalLink /> Open file</Button>
          <Button variant="ghost" size="sm" onClick={() => { reprocessDocument(docId); onClose() }}><LuRotateCw /> Re-process</Button>
          <span className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:text-danger"
            onClick={() => { if (window.confirm('Remove this document from the bundle? Its entries and flags will be recomputed.')) { deleteDocument(docId).catch(() => {}); onClose() } }}
          >
            <LuTrash2 /> Remove
          </Button>
        </>
      }
    >
      {!data ? (
        <div className="grid gap-2"><Skeleton className="h-8" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : data.status === 'failed' ? (
        <EmptyState title="This document could not be processed. Re-process it, or upload a clearer copy (300 dpi, flat page, good light)." />
      ) : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={tabs} className="mb-3" />
          <div className="grid gap-2">
            {rows.map((x, i) => <Row key={i} x={x} />)}
            {!rows.length && (
              <EmptyState
                title={tab === 'rejected' ? 'Nothing was rejected. Every item had a source sentence.' : tab === 'references' ? 'This document does not refer to other documents.' : 'Nothing of this kind was found in this document.'}
              />
            )}
          </div>
          {tab === 'rejected' && rows.length > 0 && <p className="mt-3 text-[12px] text-ink-3">Items without a verifiable source sentence are never shown on the timeline.</p>}
        </>
      )}
    </Drawer>
  )
}
