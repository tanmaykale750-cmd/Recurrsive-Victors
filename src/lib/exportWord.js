import {
  AlignmentType, Document, Footer, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'
import { UNRESOLVED_COLS, VERIFIED_COLS, download } from './report'

const FONT = 'Times New Roman'

const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: o.sans ? 'Arial' : FONT, size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color })
const p = (text, o = {}) =>
  new Paragraph({ alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: o.after ?? 80, before: o.before ?? 0 }, children: [run(text, o)] })

function table(cols, rows, flagKey) {
  const cell = (text, w, head, flag) =>
    new TableCell({
      width: { size: Math.round(w * 100), type: WidthType.PERCENTAGE },
      shading: head ? { type: ShadingType.CLEAR, color: 'auto', fill: '0B2152' } : undefined,
      margins: { top: 70, bottom: 70, left: 90, right: 90 },
      children: [new Paragraph({ children: [run(text, { size: head ? 17 : 19, bold: head || flag, sans: head || flag, color: head ? 'FFFFFF' : flag ? 'B42318' : undefined })] })],
    })
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: cols.map((c) => cell(c.label, c.w, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: cols.map((c) => cell(r[c.key], c.w, false, flagKey === c.key && r[c.key])) })),
    ],
  })
}

/** Builds a real .docx file in the browser and downloads it. */
export async function exportWord(report, filename = 'CaseCompass_Chronology.docx') {
  const { meta, opts } = report
  const grey = { sans: true, size: 16, color: '5A5F6B' }
  const children = [
    p(meta.heading, { center: true, bold: true, size: 28, after: 120 }),
    p(meta.matter, { center: true, size: 22, after: 40 }),
    p(meta.parties, { center: true, italics: true, size: 22, after: 160 }),
    p(meta.prepared, { center: true, ...grey, after: 20 }),
    p(meta.disclaimer, { center: true, ...grey, after: 240 }),
    p('Part A: Verified entries', { bold: true, size: 24, color: '13337A', after: 60 }),
    p('Dates stated in the record, or confirmed by the reviewer where marked.', { ...grey, after: 120 }),
    table(VERIFIED_COLS(opts.citations), report.verified),
  ]
  if (report.unresolved.length) {
    children.push(
      p('Part B: Unresolved issues', { bold: true, size: 24, color: '13337A', before: 300, after: 60 }),
      p('Not verified. No date has been chosen or calculated for these entries.', { ...grey, after: 120 }),
      table(UNRESOLVED_COLS(opts.citations), report.unresolved, 'type'),
    )
  }
  if (report.missing.length) {
    children.push(
      p('Appendix A: Documents referred to but not in the bundle', { bold: true, size: 24, color: '13337A', before: 300, after: 120 }),
      table([{ key: 'title', label: 'Document', w: 0.3 }, { key: 'referredIn', label: 'Referred to in', w: 0.4 }, { key: 'status', label: 'Status', w: 0.12 }, { key: 'note', label: 'Reviewer note', w: 0.18 }], report.missing),
    )
  }
  if (report.corrections.length) {
    children.push(
      p('Appendix B: Reviewer correction log', { bold: true, size: 24, color: '13337A', before: 300, after: 120 }),
      table([{ key: 'at', label: 'When', w: 0.18 }, { key: 'who', label: 'By', w: 0.14 }, { key: 'detail', label: 'Correction', w: 0.68 }], report.corrections),
    )
  }

  const doc = new Document({
    creator: 'CaseCompass',
    title: 'Chronology of events and list of dates',
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES, '  |  CaseCompass chronology. Organises the record; not legal advice.'], size: 14, font: 'Arial', color: '6B7080' })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  download(blob, filename)
}
