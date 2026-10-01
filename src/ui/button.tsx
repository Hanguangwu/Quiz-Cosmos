import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * shadcn-style primitives (design-plan §46).
 *
 * These handle UI chrome only — buttons, fields, overlays. They are
 * deliberately theme-agnostic: card visuals belong to the Theme Engine, never
 * to app chrome components.
 */

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-panel)] text-sm font-medium transition-[background-color,color,border-color,opacity,transform] duration-150 active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:brightness-110',
        secondary:
          'bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:bg-[var(--color-surface-3)] border border-[var(--color-line)]',
        ghost:
          'text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
        outline:
          'border border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]',
        danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
        link: 'text-[var(--color-accent)] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[0.8125rem] [&_svg]:size-3.5',
        md: 'h-9.5 px-4 [&_svg]:size-4',
        lg: 'h-11 px-5 text-[0.9375rem] [&_svg]:size-4',
        icon: 'size-9.5 [&_svg]:size-4',
        'icon-sm': 'size-8 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/**
 * `forwardRef` is mandatory, not decorative: with `asChild` this component
 * renders Radix's `Slot`, which clones its child and attaches a `ref` to it —
 * and every `<Button asChild>` is itself often wrapped in a Radix trigger
 * (`<TooltipTrigger asChild><Button asChild><Link/></Button></TooltipTrigger>`).
 * A plain function component cannot receive that ref, which produced
 * "Function components cannot be given refs" and broke focus + tooltip
 * anchoring on the anchor element that `Slot` actually lands on.
 *
 * The ref type is therefore `ElementRef<typeof Slot>` (`HTMLElement`), not
 * `HTMLButtonElement`: with `asChild` the ref belongs to whatever child was
 * substituted, e.g. react-router's `<Link>`, which renders an `<a>`.
 */
const Button = React.forwardRef<React.ElementRef<typeof Slot>, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size }), className)
    if (asChild) return <Slot className={classes} {...props} ref={ref} />
    // The public ref is `HTMLElement` (see above), while a real `<button>` only
    // accepts `Ref<HTMLButtonElement>`. `RefObject.current` is `readonly`, so
    // the two are not mutually assignable and the ref has to travel through a
    // callback instead — which is bivariant and therefore accepts the node
    // either way. Object refs are still written through, so consumers that use
    // `useRef` are unaffected.
    const bridgeRef: React.RefCallback<HTMLElement> = (node) => {
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }
    return <button className={classes} {...props} ref={bridgeRef} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
