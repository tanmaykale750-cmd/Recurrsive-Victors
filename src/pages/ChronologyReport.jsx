import { useMemo, useState } from 'react'
import { LuFileText, LuFileType, LuLoaderCircle, LuPrinter, LuCircleCheck, LuTriangleAlert, LuFileQuestion, LuArrowRight } from 'react-icons/lu'
import { useCase } from '../state/CaseStore'
import { issueCounts } from '../lib/selectors'
import { DEFAULT_REPORT_OPTIONS, buildReport } from '../lib/report'
import { Button } from '../components/ui/Button'
import { Card, PageHeader } from '../components/ui/display'
import { Switch } from '../components/ui/controls'
import Paper from '../components/report/Paper'

const OPTIONS = [
  ['citations', 'Page-level citations', 'Document and page for every entry'],
  ['conflicts', 'Flagged contradictions', 'Unresolved conflicts with both dates'],
  ['quarantine', 'Quarantined dates', 'Snippets not yet verified'],
  ['gaps', 'Gaps', 'Missing, undated and skipped steps'],
  ['missingAppendix', 'Appendix of missing documents', 'Referred to but not in the bundle'],
  ['correctionLog', 'Correction log', 'Who changed what, when and why'],
]

const FILE = 'CaseCompass_Chronology_CS-COMM-118-2026'

export default function ChronologyReport() {
  const { state, toast } = useCase()
  const [opts, setOpts] = useState(DEFAULT_REPORT_OPTIONS)
  const [busy, setBusy] = useState(null)
  const report = useMemo(() => buildReport(state, opts), [state, opts])
  const open = issueCounts(state).open

  /* export libraries load on demand, so they don't weigh down the rest of the app */
  const run = async (kind) => {
    setBusy(kind)
    try {
      if (kind === 'pdf') {
        const { exportPdf } = await import('../lib/exportPdf')
        await exportPdf(report, `${FILE}.pdf`)
      } else {
        const { exportWord } = await import('../lib/exportWord')
        await exportWord(report, `${FILE}.docx`)
      }
      toast(kind === 'pdf' ? 'PDF exported' : 'Word document exported', 'ok')
    } catch (e) {
      console.error(e)
      toast('Export failed. Try again, or check the browser console for details.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Chronology Report & Export" desc="A court-ready chronology of events and list of dates, with verified entries kept apart from unresolved issues." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4 lg:sticky lg:top-[72px]">
          <Card title="Readiness" bodyClassName="pb-3">
            <ul className="grid gap-2 text-[13px]">
              <li className="flex items-center gap-2.5"><LuCircleCheck className="size-4 text-success" /><span><b className="tabular font-semibold">{report.verified.length}</b> verified entries in Part A</span></li>
              <li className="flex items-center gap-2.5"><LuTriangleAlert className="size-4 text-danger" /><span><b className="tabular font-semibold">{report.unresolved.length}</b> unresolved issues listed separately in Part B</span></li>
              <li className="flex items-center gap-2.5"><LuFileQuestion className="size-4 text-warning" /><span><b className="tabular font-semibold">{report.missing.length}</b> missing documents in Appendix A</span></li>
            </ul>
            {open > 0 && (
              <a href="#/review" className="group mt-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2 hover:text-ink">
                <span>{open} issues still open. Resolve them to move entries into Part A.</span>
                <LuArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
            <div className="mt-4 grid gap-2">
              <Button variant="primary" onClick={() => run('pdf')} disabled={!!busy}>
                {busy === 'pdf' ? <LuLoaderCircle className="animate-spin" /> : <LuFileText />} Export PDF
              </Button>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Button variant="secondary" onClick={() => run('docx')} disabled={!!busy}>
                  {busy === 'docx' ? <LuLoaderCircle className="animate-spin" /> : <LuFileType />} Export Word (.docx)
                </Button>
                <Button variant="secondary" size="icon" className="size-9" onClick={() => window.print()} aria-label="Print"><LuPrinter /></Button>
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-ink-3">Files are generated in your browser. Nothing is uploaded.</p>
          </Card>
          <Card title="Include" bodyClassName="px-2 pb-2">
            <ul>
              {OPTIONS.map(([k, label, desc]) => (
                <li key={k} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{label}</span>
                    <span className="block text-[11.5px] text-ink-3">{desc}</span>
                  </span>
                  <Switch size="sm" checked={opts[k]} onChange={(v) => setOpts((o) => ({ ...o, [k]: v }))} label={label} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="min-w-0">
          <div className="overflow-x-auto rounded-[10px] border border-line bg-surface-2 p-4 sm:p-8">
            <Paper report={report} opts={opts} />
          </div>
          <p className="mt-2 text-center text-[11.5px] text-ink-3">Preview. Faint lines mark approximate A4 page breaks; the exported file is paginated exactly.</p>
        </div>
      </div>
    </>
  )
}
