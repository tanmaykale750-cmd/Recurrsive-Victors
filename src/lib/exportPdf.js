import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { UNRESOLVED_COLS, VERIFIED_COLS, download } from './report'

const PAGE = [595.28, 841.89] // A4 in points
const M = 50
const NAVY = rgb(0.043, 0.129, 0.322)
const LINE = rgb(0.78, 0.81, 0.86)
const RED = rgb(0.7, 0.14, 0.09)

/* Standard PDF fonts only cover WinAnsi characters. */
const clean = (s) =>
  String(s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF–—…]/g, '?')

function wrap(text, font, size, width) {
  const words = clean(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (font.widthOfTextAtSize(test, size) <= width) line = test
    else {
      if (line) lines.push(line)
      line = w
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/** Builds a real, paginated A4 PDF in the browser and downloads it. */
export async function exportPdf(report, filename = 'CaseCompass_Chronology.pdf') {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Chronology of events and list of dates')
  pdf.setCreator('CaseCompass')
  const F = {
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    serifB: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifI: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansB: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
  const W = PAGE[0] - M * 2
  let page
  let y

  const addPage = () => {
    page = pdf.addPage(PAGE)
    y = PAGE[1] - 56
  }
  const ensure = (h) => {
    if (y - h < 64) {
      addPage()
      return true
    }
    return false
  }
  const para = (text, { font = F.serif, size = 10.5, color = rgb(0, 0, 0), align = 'left', gap = 4 } = {}) => {
    for (const ln of wrap(text, font, size, W)) {
      ensure(size + gap)
      const tw = font.widthOfTextAtSize(ln, size)
      const x = align === 'center' ? M + (W - tw) / 2 : M
      page.drawText(ln, { x, y: y - size, size, font, color })
      y -= size + gap
    }
  }
  const heading = (text) => {
    ensure(40)
    y -= 14
    page.drawText(clean(text), { x: M, y: y - 13, size: 13, font: F.serifB, color: NAVY })
    y -= 22
  }

  const table = (cols, rows, { flagKey } = {}) => {
    const size = 9
    const lh = 11.5
    const pad = 5
    const widths = cols.map((c) => c.w * W)
    const drawHeader = () => {
      const hLines = cols.map((c, i) => wrap(c.label, F.sansB, 8.5, widths[i] - pad * 2))
      const h = Math.max(...hLines.map((l) => l.length)) * lh + pad * 2
      ensure(h + 20)
      let x = M
      page.drawRectangle({ x: M, y: y - h, width: W, height: h, color: NAVY })
      cols.forEach((c, i) => {
        hLines[i].forEach((ln, k) => page.drawText(ln, { x: x + pad, y: y - pad - 8.5 - k * lh, size: 8.5, font: F.sansB, color: rgb(1, 1, 1) }))
        x += widths[i]
      })
      y -= h
    }
    drawHeader()
    rows.forEach((r) => {
      const cells = cols.map((c, i) => wrap(r[c.key], F.serif, size, widths[i] - pad * 2))
      const h = Math.max(...cells.map((l) => l.length)) * lh + pad * 2
      if (ensure(h)) drawHeader()
      let x = M
      cols.forEach((c, i) => {
        page.drawRectangle({ x, y: y - h, width: widths[i], height: h, borderColor: LINE, borderWidth: 0.6 })
        const isFlag = flagKey === c.key && r[c.key]
        cells[i].forEach((ln, k) =>
          page.drawText(ln, { x: x + pad, y: y - pad - size - k * lh + 1, size, font: isFlag ? F.sansB : F.serif, color: isFlag ? RED : rgb(0.07, 0.07, 0.07) }),
        )
        x += widths[i]
      })
      y -= h
    })
    y -= 8
  }

  addPage()
  const { meta, opts } = report
  para(meta.heading, { font: F.serifB, size: 15, align: 'center', gap: 8 })
  para(meta.matter, { size: 11.5, align: 'center' })
  para(meta.parties, { font: F.serifI, size: 11.5, align: 'center', gap: 10 })
  para(meta.prepared, { font: F.sans, size: 8.5, color: rgb(0.35, 0.35, 0.4), align: 'center' })
  para(meta.disclaimer, { font: F.sans, size: 8.5, color: rgb(0.35, 0.35, 0.4), align: 'center', gap: 6 })

  heading('Part A: Verified entries')
  para('Dates stated in the record, or confirmed by the reviewer where marked. Each entry is tied to its source.', { font: F.sans, size: 8.5, color: rgb(0.35, 0.35, 0.4), gap: 8 })
  table(VERIFIED_COLS(opts.citations), report.verified)

  if (report.unresolved.length) {
    heading('Part B: Unresolved issues')
    para('These entries are not verified. They are listed so the record can be checked; no date has been chosen or calculated for them.', { font: F.sans, size: 8.5, color: rgb(0.35, 0.35, 0.4), gap: 8 })
    table(UNRESOLVED_COLS(opts.citations), report.unresolved, { flagKey: 'type' })
  }
  if (report.missing.length) {
    heading('Appendix A: Documents referred to but not in the bundle')
    table(
      [{ key: 'title', label: 'Document', w: 0.3 }, { key: 'referredIn', label: 'Referred to in', w: 0.4 }, { key: 'status', label: 'Status', w: 0.12 }, { key: 'note', label: 'Reviewer note', w: 0.18 }],
      report.missing,
    )
  }
  if (report.corrections.length) {
    heading('Appendix B: Reviewer correction log')
    table([{ key: 'at', label: 'When', w: 0.18 }, { key: 'who', label: 'By', w: 0.14 }, { key: 'detail', label: 'Correction', w: 0.68 }], report.corrections)
  }

  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    const t = `Page ${i + 1} of ${pages.length}   |   CaseCompass chronology. Organises the record; not legal advice.`
    p.drawText(t, { x: M, y: 30, size: 7.5, font: F.sans, color: rgb(0.45, 0.45, 0.5) })
  })

  const bytes = await pdf.save()
  download(new Blob([bytes], { type: 'application/pdf' }), filename)
}
