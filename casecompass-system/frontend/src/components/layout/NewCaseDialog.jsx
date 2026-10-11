import { useState } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { LuLoaderCircle } from 'react-icons/lu'
import { useCase } from '../../state/CaseStore'
import { Button } from '../ui/Button'
import { Select } from '../ui/controls'

/** Create a case: title, number, court and case type (which decides the document checklist). */
export default function NewCaseDialog({ open, onClose }) {
  const { createCase, toast } = useCase()
  const [f, setF] = useState({ title: '', number: '', court: '', case_type: 'civil' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    if (f.title.trim().length < 3) return toast('Enter the case title (at least 3 characters).')
    setBusy(true)
    try {
      await createCase(f)
      setF({ title: '', number: '', court: '', case_type: 'civil' })
      onClose()
      window.location.hash = '#/upload'
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[80]">
      <DialogBackdrop transition className="fixed inset-0 bg-[var(--overlay)] transition-opacity duration-150 data-closed:opacity-0" />
      <div className="fixed inset-0 grid place-items-center p-4">
        <DialogPanel transition className="w-full max-w-[460px] rounded-xl border border-line bg-surface p-5 shadow-float transition duration-150 data-closed:scale-[0.98] data-closed:opacity-0">
          <DialogTitle className="text-[17px] font-semibold">New case</DialogTitle>
          <p className="mt-0.5 text-[12.5px] text-ink-3">The case type sets which documents CaseCompass expects at each stage.</p>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="nc-title" className="label">Case title <span className="text-danger">*</span></label>
              <input id="nc-title" className="field" value={f.title} onChange={set('title')} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <label htmlFor="nc-no" className="label">Case number</label>
                <input id="nc-no" className="field" value={f.number} onChange={set('number')} />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="nc-type" className="label">Case type</label>
                <Select id="nc-type" value={f.case_type} onChange={set('case_type')}>
                  <option value="civil">Civil suit</option>
                  <option value="criminal">Criminal case</option>
                  <option value="tribunal">Tribunal / consumer</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="nc-court" className="label">Court or forum</label>
              <input id="nc-court" className="field" value={f.court} onChange={set('court')} />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={busy}>{busy && <LuLoaderCircle className="animate-spin" />} Create case</Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
