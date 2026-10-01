import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Overlay + navigation primitives, Radix-backed for accessibility. */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-pop)] outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="关闭"
          className="absolute right-3.5 top-3.5 rounded-md p-1 text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 space-y-1 pr-7', className)} {...props} />
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold text-[var(--color-ink)]', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-[var(--color-ink-3)]', className)}
      {...props}
    />
  )
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-5 flex justify-end gap-2', className)} {...props} />
}

/** Side drawer, built on the dialog primitive so focus trapping is free. */
export function Sheet({
  open,
  onOpenChange,
  side = 'left',
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  side?: 'left' | 'right'
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 z-50 flex w-[min(84vw,20rem)] flex-col border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] outline-none',
            side === 'left'
              ? 'left-0 border-r'
              : 'right-0 border-l',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="关闭"
            className="absolute right-3 top-3 rounded-md p-1 text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export const Tabs = TabsPrimitive.Root

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1',
        className,
      )}
      {...props}
    />
  )
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'rounded-[calc(var(--radius-panel)-0.25rem)] px-3 py-1.5 text-sm text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-ink)] data-[state=active]:bg-[var(--color-surface)] data-[state=active]:text-[var(--color-ink)] data-[state=active]:shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('mt-4 outline-none', className)} {...props} />
}

export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-3)] px-2 py-1 text-xs text-[var(--color-ink)] shadow-lg',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

export const Select = SelectPrimitive.Root
export const SelectValue = SelectPrimitive.Value
export const SelectGroup = SelectPrimitive.Group

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-9.5 w-full items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-line-strong)] focus:border-[var(--color-accent)] focus:outline-none data-[placeholder]:text-[var(--color-ink-3)]',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="size-4 opacity-60" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2.5 pr-8 text-sm text-[var(--color-ink-2)] outline-none data-[highlighted]:bg-[var(--color-surface-2)] data-[highlighted]:text-[var(--color-ink)] data-[state=checked]:text-[var(--color-ink)]',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-2 flex items-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-[var(--color-accent)]" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-44 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-pop)]',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-[var(--color-ink-2)] outline-none data-[highlighted]:bg-[var(--color-surface-2)] data-[highlighted]:text-[var(--color-ink)]',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      className={cn(
        'px-2.5 py-1.5 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--color-ink-3)]',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--color-line)]', className)}
      {...props}
    />
  )
}
