import { useRef, useState } from 'react'
import { LuCloudUpload, LuSparkles, LuFileText, LuImage, LuFile, LuLoaderCircle, LuCircleCheck } from 'react-icons/lu'
import { UPLOAD_STEPS, useCase } from '../../state/CaseStore'
import { Button } from '../ui/Button'
import { Progress } from '../ui/display'
import { cn } from '../../lib/cn'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.tif,.tiff,.heic,.webp'
const OK_RE = /\.(pdf|png|jpe?g|tiff?|heic|webp)$/i
const sizeLabel = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b ? `${Math.max(1, Math.round(b / 1e3))} KB` : '—')

export function Dropzone() {
  const { addFiles, toast } = useCase()
  const [over, setOver] = useState(false)
  const input = useRef(null)
  const take = (files) => {
    const ok = [...files].filter((f) => OK_RE.test(f.name))
    if (ok.length < files.length) toast('Some files were skipped. Upload PDFs, scans or images.')
    if (ok.length) addFiles(ok)
  }
  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setOver(true) }}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false) }}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}
      className={cn(
        'flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-5 py-6 text-center transition-colors duration-150 sm:flex-row sm:text-left',
        over ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface-2/40 hover:border-primary/60',
      )}
    >
      <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { take(e.target.files); e.target.value = '' }} />
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary transition-transform duration-150', over && 'scale-110')}>
        <LuCloudUpload className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">{over ? 'Drop to upload' : 'Drag files here, or browse'}</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-3">PDFs, scanned documents and images · PDF, JPG, PNG, TIFF, HEIC. Scans are read with OCR.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={() => addFiles([{ name: 'Order_sheet_08.10.2026.pdf', size: 312000 }, { name: 'Scanned_receipt_stamp.jpg', size: 1840000 }])}>
          <LuSparkles /> Try samples
        </Button>
        <Button variant="primary" size="sm" onClick={() => input.current.click()}>
          <LuCloudUpload /> Browse files
        </Button>
      </div>
    </div>
  )
}

/** Processing queue: one row per uploaded file with its current pipeline step. */
export function UploadQueue({ onView }) {
  const { state } = useCase()
  if (!state.uploads.length) return null
  return (
    <div className="mt-4">
      <div className="eyebrow mb-1.5">Processing</div>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {state.uploads.map((u) => {
          const Icon = u.kind === 'image' ? LuImage : u.kind === 'pdf' ? LuFileText : LuFile
          const done = u.status === 'done'
          return (
            <li key={u.id} className="animate-fade grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
              <span className={cn('grid size-8 place-items-center rounded-md', done ? 'bg-success-soft text-success' : 'bg-surface-2 text-ink-3')}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{u.name}</span>
                  <span className="tabular shrink-0 text-[11.5px] text-ink-3">{sizeLabel(u.size)}</span>
                </div>
                {done ? (
                  <span className="flex items-center gap-1 text-[12px] text-success">
                    <LuCircleCheck className="size-3.5" /> Ready for review
                  </span>
                ) : (
                  <div className="mt-1 flex items-center gap-2.5">
                    <Progress value={((u.step + 1) / UPLOAD_STEPS.length) * 100} className="h-1 max-w-[220px] flex-1" label={`Processing ${u.name}`} />
                    <span className="flex items-center gap-1 truncate text-[11.5px] text-ink-3">
                      <LuLoaderCircle className="size-3 animate-spin" /> {UPLOAD_STEPS[u.step]}
                      <span className="tabular">· {u.step + 1}/{UPLOAD_STEPS.length}</span>
                    </span>
                  </div>
                )}
              </div>
              {done ? (
                <Button variant="secondary" size="sm" onClick={() => onView(u)}>View extraction</Button>
              ) : (
                <span className="h-8 w-[110px] animate-pulse rounded-lg bg-surface-2" aria-hidden />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
