import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Download,
  Eye,
  FileText,
  PenLine,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { Markdown } from '@/features/markdown/Markdown'
import { MarkdownEditor } from '@/features/editor/MarkdownEditor'
import { newCardTemplate, serializeFrontMatter, suggestId } from '@/features/editor/frontmatter'
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { replaceFrontMatter, resolveCard } from '@/lib/content'
import { parseCard } from '@/lib/parser'
import { deleteDraft, loadDraft, saveDraft } from '@/lib/drafts'
import { downloadBlob } from '@/lib/export'
import {
  CARD_STATUSES,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FLIP_MARKER,
  STATUS_LABELS,
  type CardFrontMatter,
  type CardStatus,
  type Difficulty,
} from '@/types'
import { THEMES } from '@/features/themes/registry'
import { cn } from '@/lib/cn'

/**
 * Markdown editor (design-plan §11, §21, AGENTS.md §13).
 *
 * Left: source. Right: live preview. The editor is *not* the card UI — it is a
 * file editor for the artefact the reader owns (design-plan §11: the editing
 * surface and the reading surface are deliberately different).
 *
 * Persistence model (design-plan §28–31, AGENTS.md §3): drafts live in
 * IndexedDB so a refresh never loses work, but the only way to publish is to
 * download the `.md` file into `content/` and commit it. There is no backend
 * and no GitHub write from the browser.
 */

type Panel = 'edit' | 'preview'

function sourceFromCard(card: NonNullable<ReturnType<typeof resolveCard>>): string {
  // Prefer the verbatim body when the index carries it; otherwise rebuild the
  // file from the two rendered halves. Either way the front matter is
  // re-serialised, which is the one thing the browser legitimately owns.
  const body = card.body
  if (typeof body === 'string' && body.trim()) return `${serializeFrontMatter(card)}\n${body}\n`
  return [
    serializeFrontMatter(card),
    '',
    card.question.trim(),
    '',
    FLIP_MARKER,
    '',
    card.answer.trim(),
    '',
  ].join('\n')
}

export default function EditorPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { index, loading } = useKnowledge()

  const [text, setText] = useState('')
  const [original, setOriginal] = useState('')
  const [panel, setPanel] = useState<Panel>('edit')
  const [dirty, setDirty] = useState(false)
  const [draftAt, setDraftAt] = useState<number | null>(null)
  const [restored, setRestored] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showMeta, setShowMeta] = useState(true)
  const ready = useRef(false)

  const draftKey = slug ?? '__new__'

  // --- initial source -----------------------------------------------------
  useEffect(() => {
    if (loading || !index || ready.current) return
    const card = slug ? resolveCard(slug, index) : null
    const base = card ? sourceFromCard(card) : newCardTemplate()
    setText(base)
    setOriginal(base)
    ready.current = true

    void (async () => {
      const draft = await loadDraft(draftKey)
      if (draft && draft !== base) {
        setText(draft)
        setDraftAt(Date.now())
        setRestored(true)
      }
    })()
  }, [index, loading, slug, draftKey])

  // --- autosave -----------------------------------------------------------
  useEffect(() => {
    if (!ready.current || text === original) return
    const timer = window.setTimeout(() => {
      void saveDraft(draftKey, text).then(() => setDraftAt(Date.now()))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [text, original, draftKey])

  useEffect(() => {
    setDirty(text !== original)
  }, [text, original])

  const parsed = useMemo(() => parseCard(text, `${slug ?? 'new'}.md`), [text, slug])
  const front: CardFrontMatter | null = parsed.ok ? parsed.card : null

  const applyFront = useCallback(
    (patch: Partial<CardFrontMatter>) => {
      if (!front) return
      setText((prev) => {
        const current = parseCard(prev, 'draft.md')
        if (!current.ok) return prev
        return replaceFrontMatter(prev, serializeFrontMatter({ ...current.card, ...patch }))
      })
    },
    [front],
  )

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked */
    }
  }, [text])

  const onDownload = useCallback(() => {
    const id = front?.id || 'new-card'
    downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${id}.md`)
  }, [text, front?.id])

  const onDiscardDraft = useCallback(async () => {
    await deleteDraft(draftKey)
    const card = slug && index ? resolveCard(slug, index) : null
    const base = card ? sourceFromCard(card) : newCardTemplate()
    setText(base)
    setOriginal(base)
    setDraftAt(null)
    setRestored(false)
    ready.current = true
  }, [draftKey, slug, index])

  const categories = index?.categories ?? []
  const allTags = index?.tags ?? []
  const takenIds = useMemo(() => index?.cards.map((c) => c.id) ?? [], [index])

  if (loading) {
    return <div className="h-96 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-surface)]" />
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={slug ? `/card/${slug}` : '/cards'}>
            <ArrowLeft />
            返回
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <Badge tone="warn">
              {draftAt ? '草稿已保存到本机' : '编辑中…'}
            </Badge>
          ) : null}
          {restored ? (
            <Button variant="ghost" size="sm" onClick={onDiscardDraft}>
              <Upload />
              放弃草稿
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onCopy}>
            {copied ? <Check /> : <ClipboardCopy />}
            {copied ? '已复制' : '复制 Markdown'}
          </Button>
          <Button variant="primary" size="sm" onClick={onDownload}>
            <Download />
            下载 .md
          </Button>
        </div>
      </div>

      <PageHeader
        title={slug ? '编辑卡片' : '新建卡片'}
        description="Markdown 是正式数据源。下载后放入 content/ 目录并提交 Git 即可发布。"
      />

      {/* Publish path, spelled out (design-plan §30–31). */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5 text-xs text-[var(--color-ink-3)]">
        <FileText aria-hidden className="size-3.5 shrink-0" />
        发布流程：
        <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[var(--color-ink-2)]">
          下载 .md
        </code>
        → 放入 <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5">content/</code> →
        <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5">git commit</code> →
        构建自动生成索引
      </div>

      {/* Mobile panel switch */}
      <div className="mb-3 flex gap-1.5 lg:hidden">
        {(['edit', 'preview'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setPanel(item)}
            className={cn(
              'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-panel)] border text-sm transition-colors',
              panel === item
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'border-[var(--color-line)] text-[var(--color-ink-3)]',
            )}
          >
            {item === 'edit' ? <PenLine className="size-3.5" /> : <Eye className="size-3.5" />}
            {item === 'edit' ? '编辑' : '预览'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- source ---- */}
        <section
          className={cn('min-w-0', panel === 'edit' ? 'block' : 'hidden lg:block')}
          aria-label="Markdown 源码"
        >
          {showMeta && front ? (
            <div className="mb-3 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-3)]">
                  Front Matter
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setShowMeta(false)}>
                  隐藏
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ID" hint={slug ? undefined : '留空时自动生成'} htmlFor="f-id">
                  <Input
                    id="f-id"
                    value={front.id}
                    placeholder="programming-os-process-001"
                    onChange={(event) => {
                      const value = event.target.value
                      applyFront({ id: value })
                      if (!slug && !value) {
                        applyFront({ id: suggestId(front.category, front.subcategory ?? '', front.title, takenIds) })
                      }
                    }}
                  />
                </Field>

                <Field label="问题（卡片正面）" htmlFor="f-title" className="sm:col-span-2">
                  <Input
                    id="f-title"
                    value={front.title}
                    placeholder="进程和线程的区别是什么？"
                    onChange={(event) => applyFront({ title: event.target.value })}
                  />
                </Field>

                <Field label="分类" htmlFor="f-category">
                  <Input
                    id="f-category"
                    list="kc-categories"
                    value={front.category}
                    onChange={(event) => applyFront({ category: event.target.value })}
                  />
                  <datalist id="kc-categories">
                    {categories.map((category) => (
                      <option key={category.name} value={category.name} />
                    ))}
                  </datalist>
                </Field>

                <Field label="子分类" htmlFor="f-sub">
                  <Input
                    id="f-sub"
                    value={front.subcategory ?? ''}
                    placeholder="os / db / java"
                    onChange={(event) =>
                      applyFront({ subcategory: event.target.value || null })
                    }
                  />
                </Field>

                <Field label="标签" hint="用逗号分隔" htmlFor="f-tags" className="sm:col-span-2">
                  <Input
                    id="f-tags"
                    value={front.tags.join(', ')}
                    placeholder="操作系统, 进程, 线程"
                    onChange={(event) =>
                      applyFront({
                        tags: event.target.value
                          .split(/[,，]/)
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  {allTags.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {allTags.slice(0, 10).map((tag) => (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() =>
                            applyFront({
                              tags: front.tags.includes(tag.name)
                                ? front.tags
                                : [...front.tags, tag.name],
                            })
                          }
                          className="rounded-[var(--radius-pill)] border border-[var(--color-line)] px-2 py-0.5 text-[0.68rem] text-[var(--color-ink-3)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-ink)]"
                        >
                          #{tag.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </Field>

                <Field label="难度">
                  <Select
                    value={front.difficulty ?? '__none'}
                    onValueChange={(value) =>
                      applyFront({ difficulty: value === '__none' ? null : (value as Difficulty) })
                    }
                  >
                    <SelectTrigger aria-label="难度">
                      <SelectValue placeholder="未设置" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">未设置</SelectItem>
                      {DIFFICULTIES.map((difficulty) => (
                        <SelectItem key={difficulty} value={difficulty}>
                          {DIFFICULTY_LABELS[difficulty]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="状态">
                  <Select
                    value={front.status}
                    onValueChange={(value) => applyFront({ status: value as CardStatus })}
                  >
                    <SelectTrigger aria-label="状态">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="主题" hint="留空则跟随偏好" htmlFor="f-theme">
                  <Select
                    value={front.theme ?? '__default'}
                    onValueChange={(value) =>
                      applyFront({ theme: value === '__default' ? null : value })
                    }
                  >
                    <SelectTrigger id="f-theme" aria-label="主题">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default">跟随偏好</SelectItem>
                      {THEMES.map((theme) => (
                        <SelectItem key={theme.id} value={theme.id}>
                          {theme.name} · {theme.nameLatin}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="相关卡片 ID" hint="用逗号分隔" htmlFor="f-related">
                  <Input
                    id="f-related"
                    value={front.related.join(', ')}
                    onChange={(event) =>
                      applyFront({
                        related: event.target.value
                          .split(/[,，]/)
                          .map((id) => id.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowMeta(true)}>
                <PenLine />
                编辑 Front Matter
              </Button>
            </div>
          )}

          <div className="h-[26rem] lg:h-[34rem]">
            <MarkdownEditor value={text} onChange={setText} />
          </div>
        </section>

        {/* ---- preview ---- */}
        <section
          className={cn('min-w-0', panel === 'preview' ? 'block' : 'hidden lg:block')}
          aria-label="实时预览"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-ink-3)]">
              实时预览
            </h2>
            {parsed.ok ? <Badge tone="ok">解析通过</Badge> : <Badge tone="danger">解析失败</Badge>}
          </div>

          <div className="max-h-[26rem] space-y-3 overflow-y-auto lg:max-h-[34rem]">
            {!parsed.ok ? (
              <div className="rounded-[var(--radius-panel)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)]">
                  <TriangleAlert aria-hidden className="size-3.5" />
                  Front Matter 有 {parsed.errors.length} 处问题
                </p>
                <ul className="space-y-1 text-xs text-[var(--color-ink-2)]">
                  {parsed.errors.map((error) => (
                    <li key={error}>· {error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {front && parsed.ok ? (
              <div className="kc-card">
                <p className="kc-card__eyebrow mb-2">问题</p>
                <h1 className="text-lg">{front.title}</h1>
                {parsed.card.question && !parsed.card.question.includes(front.title) ? (
                  <Markdown content={parsed.card.question} className="mt-3" />
                ) : null}
                <hr className="kc-card__rule my-4" />
                <p className="kc-card__eyebrow mb-2">答案</p>
                <Markdown content={parsed.card.answer} />
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {parsed.ok && parsed.warnings.length > 0 ? (
        <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3.5">
          <p className="mb-1.5 text-xs font-medium text-[var(--color-warn)]">
            {parsed.warnings.length} 条提醒
          </p>
          <ul className="space-y-1 text-xs text-[var(--color-ink-3)]">
            {parsed.warnings.map((warning) => (
              <li key={warning}>· {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Separator className="my-6" />

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--color-ink-3)]">
        <span>
          草稿保存在本机 IndexedDB，仅为防止刷新丢失；正式数据始终是 Git 中的 Markdown。
        </span>
        <Button variant="ghost" size="sm" onClick={() => navigate('/cards')}>
          查看已发布卡片
        </Button>
      </div>
    </div>
  )
}
