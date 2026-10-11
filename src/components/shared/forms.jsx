import { useState } from 'react'
import { cn } from '../../lib/cn'

/** Returns [className, trigger] for a short shake on invalid submit. */
export function useShake() {
  const [k, setK] = useState(0)
  return [k ? 'animate-shake' : '', () => { setK(0); requestAnimationFrame(() => setK(Date.now())) }, k]
}

/**
 * Required reason field with optional quick-pick suggestions. Suggestions only
 * fill the field; the reviewer still chooses and can edit before recording.
 */
export function ReasonInput({ id, value, onChange, placeholder, suggestions = [], label = 'Reason' }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="label">
        {label} <span className="text-danger">*</span>
      </label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required aria-required="true" />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11.5px] transition-colors',
                value === s ? 'border-primary bg-primary-soft text-primary' : 'border-line text-ink-3 hover:border-line-strong hover:text-ink-2',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Pull out the unclear part of a quarantined snippet so it can be highlighted. */
const UNCLEAR_RE = /(within [a-z0-9 ]+? (?:days|weeks)(?: of [a-z ]+? notice)?|on or about [^.…]+|\d\?\/\d\?\/\d{4}(?: \[[^\]]+\])?)/i
export function splitUnclear(quote) {
  const m = quote.match(UNCLEAR_RE)
  if (!m) return [quote, '', '']
  return [quote.slice(0, m.index), m[0], quote.slice(m.index + m[0].length)]
}
