import { Fragment, useState } from 'react'
import {
  FloatingPortal, autoUpdate, flip, offset, shift, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole,
} from '@floating-ui/react'
import { termRe, glossFor } from '../../lib/selectors'
import { useCase } from '../../state/CaseStore'

/** One highlighted legal term with a plain-language tooltip (hover or keyboard focus). */
export function JargonTerm({ term, def, children }) {
  const [open, setOpen] = useState(false)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  })
  const hover = useHover(context, { move: false, delay: { open: 120, close: 60 } })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  return (
    <>
      <span ref={refs.setReference} tabIndex={0} className="term" {...getReferenceProps()}>
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div ref={refs.setFloating} style={floatingStyles} className="z-[100] w-max max-w-[280px]" {...getFloatingProps()}>
            <div className="animate-fade rounded-lg border border-line bg-surface p-3 font-sans text-[12.5px] leading-relaxed text-ink-2 not-italic shadow-float">
              <b className="mb-0.5 block text-[13px] font-semibold text-ink">{term}</b>
              {def}
              <small className="mt-2 block border-t border-line pt-1.5 text-[11px] text-ink-3">Definition from the case glossary. Not legal advice.</small>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  )
}

const DATE_RE = /\b(\d{1,2}\.\d{1,2}\.\d{4}|\d\?\/\d\?\/\d{4}|1\?\/0\?\/\d{4})\b/g

/**
 * Renders text with glossary terms wrapped in JargonTerm tooltips.
 * `dates` also highlights dd.mm.yyyy dates (used in quoted source sentences).
 */
export function Decorated({ text, dates = false }) {
  const { state } = useCase()
  if (!text) return null
  const showTerms = state.settings.showTerms
  const tokens = []
  const push = (s, key) => {
    if (!dates || !s) return tokens.push(<Fragment key={key}>{s}</Fragment>)
    let last = 0
    for (const m of s.matchAll(DATE_RE)) {
      if (m.index > last) tokens.push(<Fragment key={`${key}-${last}`}>{s.slice(last, m.index)}</Fragment>)
      tokens.push(<mark key={`${key}-d${m.index}`} className="qdate">{m[0]}</mark>)
      last = m.index + m[0].length
    }
    tokens.push(<Fragment key={`${key}-e`}>{s.slice(last)}</Fragment>)
  }
  if (!showTerms) {
    push(text, 'all')
    return tokens
  }
  let last = 0
  for (const m of text.matchAll(termRe())) {
    const g = glossFor(m[0])
    if (!g) continue
    if (m.index > last) push(text.slice(last, m.index), `t${last}`)
    tokens.push(
      <JargonTerm key={`j${m.index}`} term={g.term} def={g.def}>
        {m[0]}
      </JargonTerm>,
    )
    last = m.index + m[0].length
  }
  push(text.slice(last), `t${last}`)
  return tokens
}

/** A quoted source sentence: serif-free, left rule, dates highlighted, terms decorated. */
export function Quote({ text, className = '' }) {
  return (
    <blockquote className={`border-l-2 border-line-strong pl-3 text-[13.5px] leading-relaxed text-ink ${className}`}>
      “<Decorated text={text} dates />”
    </blockquote>
  )
}
