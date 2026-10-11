import { useId, useRef } from 'react'
import { Switch as HSwitch } from '@headlessui/react'
import { LuChevronDown } from 'react-icons/lu'
import { cn } from '../../lib/cn'

/**
 * Segmented control (radio group). options: [{ value, label, icon?, count? }]
 * Arrow keys move the selection.
 */
export function SegmentedControl({ value, onChange, options, className, size = 'md', label }) {
  const refs = useRef([])
  const onKey = (e, i) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const j = (i + d + options.length) % options.length
    onChange(options[j].value)
    refs.current[j]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-surface-2 p-0.5', className)}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors duration-150 [&_svg]:size-3.5',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[12.5px]',
              on ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            {o.icon && <o.icon />}
            {o.label}
            {o.count !== undefined && <span className={cn('tabular text-[11px]', on ? 'text-ink-2' : 'text-ink-3')}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Toggle chip used for filters. */
export function FilterChip({ active, onClick, children, icon: Icon, count, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors duration-150',
        active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink',
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" />}
      {children}
      {count !== undefined && <span className="tabular text-[11px]">{count}</span>}
    </button>
  )
}

/** Underline tabs. tabs: [{ value, label, count? }] */
export function Tabs({ value, onChange, tabs, className }) {
  return (
    <div role="tablist" className={cn('flex gap-3.5 overflow-x-auto border-b border-line [scrollbar-width:none]', className)}>
      {tabs.map((t) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pt-1 pb-2 text-[12.5px] font-medium whitespace-nowrap transition-colors',
              on ? 'border-primary text-ink' : 'border-transparent text-ink-3 hover:text-ink-2',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('tabular rounded-full px-1.5 text-[10.5px] leading-[17px]', on ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-ink-3')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, size = 'md', className }) {
  return (
    <HSwitch
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className={cn(
        'group relative inline-flex shrink-0 items-center rounded-full bg-line-strong transition-colors duration-150 data-checked:bg-primary',
        size === 'sm' ? 'h-[18px] w-8' : 'h-5 w-9',
        className,
      )}
    >
      <span
        className={cn(
          'rounded-full bg-white shadow-sm transition-transform duration-150',
          size === 'sm' ? 'size-3.5 translate-x-0.5 group-data-checked:translate-x-[16px]' : 'size-4 translate-x-0.5 group-data-checked:translate-x-[18px]',
        )}
      />
    </HSwitch>
  )
}

export function Field({ label, hint, children, className, required }) {
  const id = useId()
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </div>
  )
}

export function Input({ className, ...rest }) {
  return <input className={cn('field', className)} {...rest} />
}

export function Select({ className, children, ...rest }) {
  return (
    <div className="relative">
      <select className={cn('field appearance-none pr-8', className)} {...rest}>
        {children}
      </select>
      <LuChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-3" />
    </div>
  )
}
