import { useEffect, useMemo, useState } from 'react'
import { DOCS } from '../data/caseData'
import { useCase } from '../state/CaseStore'
import { fmt, fmtNum } from '../lib/dates'
import { navigate, useRoute } from '../lib/router'
import { PageHeader } from '../components/ui/display'
import { Dropzone, UploadQueue } from '../components/upload/Dropzone'
import BundleTable, { docExtraction } from '../components/upload/BundleTable'
import ExpectedDocs from '../components/upload/ExpectedDocs'
import ExtractionDrawer from '../components/upload/ExtractionDrawer'

/** Normalise a bundle document into the extraction drawer's shape. */
function fromBundle(id, openSource) {
  const d = DOCS[id]
  const x = docExtraction(id)
  return {
    title: d.name,
    subtitle: `${id} · ${d.type} · ${d.pages} pages · ${d.format} · added ${fmt(d.uploaded)}`,
    dates: [
      ...x.items.map((i) => ({ text: fmtNum(i.date), sentence: i.quote, page: i.page, onClick: () => openSource(i.id) })),
      ...x.quarantined.map((q) => ({ text: 'Date held back', sentence: q.quote, page: q.page, confidence: q.confidence, quarantined: true, reason: q.reason, onClick: () => navigate(`review?issue=${q.id}`) })),
    ],
    events: x.items.filter((i) => i.kind !== 'conflict').map((i) => ({ text: i.title, sentence: i.quote, page: i.page, onClick: () => openSource(i.id) })),
    references: x.refs.map((r) => ({ text: r.label, inBundle: !r.gap, onClick: () => (r.gap ? navigate(`review?issue=${r.gap}`) : null) })).map((r) => (r.inBundle ? { ...r, onClick: undefined } : r)),
    rejected: [],
  }
}

/** Normalise an uploaded file's (sample) results. */
function fromUpload(u) {
  const r = u.results
  return {
    title: u.name,
    subtitle: 'Uploaded in this session',
    sample: r.sample,
    dates: r.dates.map((x) => ({ text: x.text, sentence: x.sentence, page: x.page, confidence: x.confidence })),
    events: r.events.map((x) => ({ text: x.text, sentence: x.sentence, page: x.page })),
    references: r.references.map((x) => ({ text: x.text, sentence: x.sentence, page: x.page, inBundle: x.inBundle })),
    rejected: r.rejected.map((x) => ({ text: x.text, reason: x.reason })),
  }
}

export default function UploadDocuments() {
  const { openSource } = useCase()
  const { query } = useRoute()
  const [sel, setSel] = useState(null) // { kind: 'doc' | 'upload', id, upload? }

  useEffect(() => {
    const d = query.get('doc')
    if (d && DOCS[d]) setSel({ kind: 'doc', id: d })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.toString()])

  const data = useMemo(() => (sel ? (sel.kind === 'doc' ? fromBundle(sel.id, openSource) : fromUpload(sel.upload)) : null), [sel, openSource])
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(!!sel), [sel])

  return (
    <>
      <PageHeader title="Upload Documents" desc="Add PDFs, scans and images. Dates, events and document references are extracted and linked to their exact sentence." />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <section className="card p-4" aria-label="Add files">
            <Dropzone />
            <UploadQueue onView={(u) => setSel({ kind: 'upload', id: u.id, upload: u })} />
          </section>
          <BundleTable onOpen={(id) => setSel({ kind: 'doc', id })} />
        </div>
        <div className="xl:sticky xl:top-[72px]">
          <ExpectedDocs />
        </div>
      </div>
      <ExtractionDrawer
        data={data}
        open={open}
        onClose={() => {
          setOpen(false)
          if (query.get('doc')) navigate('upload')
          setTimeout(() => setSel(null), 200)
        }}
      />
    </>
  )
}
