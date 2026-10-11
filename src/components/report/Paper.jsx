import { LuBadgeCheck } from 'react-icons/lu'
import { UNRESOLVED_COLS, VERIFIED_COLS } from '../../lib/report'
import { cn } from '../../lib/cn'

const MISSING_COLS = [{ key: 'title', label: 'Document', w: 0.3 }, { key: 'referredIn', label: 'Referred to in', w: 0.4 }, { key: 'status', label: 'Status', w: 0.12 }, { key: 'note', label: 'Reviewer note', w: 0.18 }]
const LOG_COLS = [{ key: 'at', label: 'When', w: 0.18 }, { key: 'who', label: 'By', w: 0.14 }, { key: 'detail', label: 'Correction', w: 0.68 }]

function Table({ cols, rows, flagKey }) {
  return (
    <table>
      <thead>
        <tr>{cols.map((c) => <th key={c.key} style={{ width: `${c.w * 100}%` }}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td
                key={c.key}
                className={cn(
                  (c.key === 'date' || c.key === 'no') && 'whitespace-nowrap tabular-nums',
                  flagKey === c.key && 'font-sans text-[11px] font-semibold text-[#b42318]',
                  c.key === 'note' && r.note && 'font-sans text-[11px] font-medium text-[#2f6b4f]',
                )}
              >
                {r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Section({ title, note, children, id }) {
  return (
    <section key={id} className="animate-fade mt-8">
      <h3 className="font-serif text-[16px] font-semibold text-[#1f3a5f]">{title}</h3>
      {note && <p className="mt-0.5 mb-2.5 font-sans text-[11.5px] text-[#666]">{note}</p>}
      {!note && <div className="mb-2.5" />}
      {children}
    </section>
  )
}

/** A4-proportioned preview built from the same structure as the PDF and Word exports. */
export default function Paper({ report, opts }) {
  const { meta } = report
  return (
    <article
      id="paper"
      className="paper relative mx-auto w-full max-w-[794px] min-w-[620px] rounded-sm px-12 py-12 font-serif shadow-[0_1px_3px_rgba(0,0,0,0.12),0_12px_32px_-12px_rgba(0,0,0,0.25)]"
      style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 1122px, #d5dae1 1122px 1123px)' }}
    >
      <span className="absolute top-5 right-6 inline-flex items-center gap-1 rounded-full border border-[#a3824f]/40 bg-[#a3824f]/10 px-2 py-0.5 font-sans text-[10.5px] font-semibold text-[#7a6038]">
        <LuBadgeCheck className="size-3.5" /> Court-ready format
      </span>
      <h2 className="text-center font-serif text-[19px] font-semibold tracking-[0.04em] text-[#111]">{meta.heading}</h2>
      <p className="mt-2 text-center text-[14px]">{meta.matter}</p>
      <p className="text-center text-[14px] italic">{meta.parties}</p>
      <p className="mx-auto mt-3 max-w-[62ch] text-center font-sans text-[11px] leading-relaxed text-[#666]">{meta.prepared}</p>

      <Section id="a" title="Part A — Verified chronology" note="Dates stated in the record, or confirmed by the reviewer where marked. Each entry is tied to its source.">
        <Table cols={VERIFIED_COLS(opts.citations)} rows={report.verified} />
      </Section>

      {report.unresolved.length > 0 && (
        <Section id="b" title="Part B — Unresolved issues" note="Not verified. Listed separately so the record can be checked; no date has been chosen or calculated.">
          <Table cols={UNRESOLVED_COLS(opts.citations)} rows={report.unresolved} flagKey="type" />
        </Section>
      )}
      {report.missing.length > 0 && (
        <Section id="m" title="Appendix A — Missing referenced documents">
          <Table cols={MISSING_COLS} rows={report.missing} />
        </Section>
      )}
      {report.corrections.length > 0 && (
        <Section id="c" title="Appendix B — Correction log">
          <Table cols={LOG_COLS} rows={report.corrections} />
        </Section>
      )}

      <p className="mt-10 border-t border-[#ddd] pt-3 text-center font-sans text-[10.5px] text-[#777]">{meta.disclaimer}</p>
    </article>
  )
}
