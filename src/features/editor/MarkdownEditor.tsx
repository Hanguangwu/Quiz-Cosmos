import { useCallback, useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { cn } from '@/lib/cn'

/**
 * CodeMirror 6 Markdown editor (AGENTS.md §13).
 *
 * Deliberately unopinionated about chrome — the surrounding layout and styling
 * belong to the page; this component only owns text editing.
 */

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  /** Read-only viewer mode, used by the export preview stage. */
  readOnly?: boolean
  ariaLabel?: string
}

function buildExtensions(readOnly: boolean): Extension[] {
  const base: Extension[] = [
    lineNumbers(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown({ base: markdownLanguage }),
    EditorView.lineWrapping,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
  ]
  if (readOnly) {
    base.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
  }
  return base
}

export function MarkdownEditor({
  value,
  onChange,
  className,
  readOnly = false,
  ariaLabel = 'Markdown 编辑器',
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Create the view once; afterwards the parent controls content.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...buildExtensions(readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  // Push external value changes (card switch, template insert) into the editor
  // without clobbering the cursor while the user is typing.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    })
  }, [value])

  const focus = useCallback(() => viewRef.current?.focus(), [])

  return (
    <div
      ref={hostRef}
      role="group"
      aria-label={ariaLabel}
      data-readonly={readOnly || undefined}
      className={cn(
        'h-full overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface-2)] text-sm',
        '[&_.cm-editor]:h-full [&_.cm-editor]:bg-transparent [&_.cm-editor]:text-[var(--color-ink)]',
        '[&_.cm-scroller]:font-[family-name:var(--font-mono)] [&_.cm-scroller]:text-[0.8125rem] [&_.cm-scroller]:leading-relaxed',
        '[&_.cm-gutters]:border-r-0 [&_.cm-gutters]:bg-transparent [&_.cm-gutters]:text-[var(--color-ink-3)]',
        '[&_.cm-activeLine]:bg-[var(--color-surface-3)] [&_.cm-activeLineGutter]:bg-transparent',
        '[&_.cm-selectionBackground]:!bg-[var(--color-accent)]/25 [&_.cm-content]:caret-[var(--color-accent)]',
        className,
      )}
      onFocus={focus}
    />
  )
}
