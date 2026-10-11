import { cloneElement, useState } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import {
  FloatingPortal, autoUpdate, flip, offset, shift, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole,
} from '@floating-ui/react'
import { LuX } from 'react-icons/lu'
import { Button } from './Button'
import { cn } from '../../lib/cn'

/** Hover/focus tooltip. Wraps a single focusable child. */
export function Tooltip({ content, children, placement = 'top', disabled, delay = 250 }) {
  const [open, setOpen] = useState(false)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  })
  const hover = useHover(context, { move: false, delay: { open: delay, close: 0 } })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])
  if (disabled || !content) return children
  return (
    <>
      {cloneElement(children, { ref: refs.setReference, ...getReferenceProps(children.props) })}
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="animate-fade pointer-events-none z-[100] max-w-[260px] rounded-md bg-ink px-2 py-1 text-[11.5px] font-medium text-canvas shadow-float"
            {...getFloatingProps()}
          >
            {content}
          </div>
        </FloatingPortal>
      )}
    </>
  )
}

/** Right-hand slide-over. Traps focus, closes on Esc and backdrop click. */
export function Drawer({ open, onClose, title, subtitle, eyebrow, children, footer, width = 'max-w-[480px]' }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-[var(--overlay)] transition-opacity duration-200 data-closed:opacity-0" />
      <div className="fixed inset-0 flex justify-end">
        <DialogPanel
          transition
          className={cn(
            'flex h-full w-full flex-col border-l border-line bg-surface shadow-float transition duration-200 ease-out data-closed:translate-x-8 data-closed:opacity-0',
            width,
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
              <DialogTitle className="text-[17px] leading-snug font-semibold">{title}</DialogTitle>
              {subtitle && <p className="mt-0.5 text-[12.5px] text-ink-3">{subtitle}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel" className="-mt-1 -mr-2">
              <LuX />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </DialogPanel>
      </div>
    </Dialog>
  )
}
