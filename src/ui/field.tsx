import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/cn'

/** Form chrome. Themed with app tokens, never with `--card-*`. */

const fieldBase =
  'w-full rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25 disabled:opacity-50'

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, 'h-9.5', className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, 'min-h-20 resize-y py-2 leading-relaxed', className)}
      {...props}
    />
  )
}

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-ink-2)]',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-[var(--color-danger)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-[var(--color-ink-3)]">{hint}</p>
      ) : null}
    </div>
  )
}

type BadgeTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-surface-2)] text-[var(--color-ink-2)] border-[var(--color-line)]',
  accent: 'bg-[var(--color-accent)]/12 text-[var(--color-accent)] border-[var(--color-accent)]/30',
  ok: 'bg-[var(--color-ok)]/12 text-[var(--color-ok)] border-[var(--color-ok)]/30',
  warn: 'bg-[var(--color-warn)]/12 text-[var(--color-warn)] border-[var(--color-warn)]/30',
  danger: 'bg-[var(--color-danger)]/12 text-[var(--color-danger)] border-[var(--color-danger)]/30',
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.7rem] leading-5 whitespace-nowrap',
        BADGE_TONE[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-[var(--color-line)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  )
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-[var(--radius-panel)] bg-[var(--color-surface-2)]', className)}
      {...props}
    />
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? <div className="text-[var(--color-ink-3)]">{icon}</div> : null}
      <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-[var(--color-ink-3)]">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
