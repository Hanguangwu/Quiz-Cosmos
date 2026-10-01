import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { cn } from '@/lib/cn'

/**
 * The single Markdown renderer for the whole app (AGENTS.md §9).
 *
 * Every surface that shows knowledge content — card front, card back, editor
 * live preview, single-card page, export stage — renders through this one
 * component. Themes restyle the rendered elements via the `--card-*` custom
 * properties in `tokens.css`; there is never a per-theme renderer.
 */

type MarkdownComponents = Components

const components: MarkdownComponents = {
  // Tables scroll horizontally on narrow screens (AGENTS.md §29) and are
  // wrapped so the card never overflows. `pre` is overridden to unwrap the
  // default `code` wrapper react-markdown puts tables inside.
  table: ({ node, ...props }) => (
    <div className="kc-table-scroll">
      <table {...props} />
    </div>
  ),
  a: ({ node, ...props }) => (
    <a
      {...props}
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noreferrer noopener' : undefined}
    />
  ),
}

export interface MarkdownProps {
  content: string
  className?: string
  /** Render task-list checkboxes as disabled controls. */
  disableInteractive?: boolean
}

function MarkdownImpl({ content, className, disableInteractive = true }: MarkdownProps) {
  return (
    <div className={cn('kc-card__body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          ...components,
          ...(disableInteractive ? { input: checkboxProps } : {}),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function checkboxProps(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} disabled readOnly />
}

export const Markdown = memo(MarkdownImpl)
export default Markdown
