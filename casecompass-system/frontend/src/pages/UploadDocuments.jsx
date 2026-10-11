import { useEffect, useState } from 'react'
import { DOCS } from '../data/caseData'
import { navigate, useRoute } from '../lib/router'
import { PageHeader } from '../components/ui/display'
import { Dropzone, UploadQueue } from '../components/upload/Dropzone'
import BundleTable from '../components/upload/BundleTable'
import ExpectedDocs from '../components/upload/ExpectedDocs'
import ExtractionDrawer from '../components/upload/ExtractionDrawer'

export default function UploadDocuments() {
  const { query } = useRoute()
  const [docId, setDocId] = useState(null)
  const [open, setOpen] = useState(false)
  const show = (id) => { setDocId(id); setOpen(true) }

  useEffect(() => {
    const d = query.get('doc')
    if (d && DOCS[d]) show(DOCS[d].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.toString()])


  return (
    <>
      <PageHeader
        title="Upload Documents"
        desc="Add PDFs, scans and images. Dates, events and document references are extracted and linked to their exact sentence."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <section className="card p-4" aria-label="Add files">
            <Dropzone />
            <UploadQueue onView={(u) => show(u.id)} />
          </section>
          <BundleTable onOpen={(code) => show(DOCS[code].id)} />
        </div>
        <div className="xl:sticky xl:top-[72px]">
          <ExpectedDocs />
        </div>
      </div>
      <ExtractionDrawer
        docId={docId}
        open={open}
        onClose={() => {
          setOpen(false)
          if (query.get('doc')) navigate('upload')
        }}
      />
    </>
  )
}
