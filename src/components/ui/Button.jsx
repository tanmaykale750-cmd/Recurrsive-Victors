import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/cn'

export const buttonStyles = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover',
        secondary: 'border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong',
        ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        danger: 'bg-danger text-white hover:opacity-90',
        link: 'h-auto px-0 text-primary hover:underline underline-offset-4',
      },
      size: {
        sm: 'h-8 rounded-lg px-2.5 text-[12.5px]',
        md: 'h-9 rounded-lg px-3.5 text-[13px]',
        icon: 'size-8 rounded-lg [&_svg]:size-[17px]',
        'icon-sm': 'size-7 rounded-md [&_svg]:size-4',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

/** Button. Renders an <a> when `href` is given. Icon-only buttons need `aria-label`. */
export const Button = forwardRef(function Button({ variant, size, className, href, type = 'button', ...rest }, ref) {
  const cls = cn(buttonStyles({ variant, size }), className)
  if (href) return <a ref={ref} href={href} className={cls} {...rest} />
  return <button ref={ref} type={type} className={cls} {...rest} />
})
