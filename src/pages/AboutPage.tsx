import { Link } from 'react-router-dom'
import { Database, FileCode2, Github, HardDrive, Layers, Palette, Search } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { Badge, Button, Separator } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { SITE } from '@/lib/site'
import { THEMES } from '@/features/themes/registry'
import { SCHEMA_VERSION } from '@/types'

/**
 * About / data-spec page. A personal knowledge base should state plainly where
 * its data lives and how to change it (design-plan §5, §29, §34).
 */

const PIPELINE = [
  { icon: FileCode2, label: 'Markdown + YAML', detail: 'content/**/*.md 是唯一正式数据源' },
  { icon: Database, label: '构建期索引', detail: 'validate → build-index → index.json' },
  { icon: Search, label: '前端搜索', detail: 'Fuse.js，纯浏览器，无服务端请求' },
  { icon: Palette, label: '主题引擎', detail: 'CSS 变量驱动，卡片结构不变' },
  { icon: Layers, label: '卡片渲染', detail: 'QA 翻面、复习、导出' },
]

export default function AboutPage() {
  const { index } = useKnowledge()

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`关于 ${SITE.name}`}
        description={SITE.description}
      />

      <section className="space-y-3 text-sm leading-relaxed text-[var(--color-ink-2)]">
        <p>
          {SITE.name} 是一个<strong className="text-[var(--color-ink)]">Markdown 驱动</strong>
          的个人知识卡片库。知识内容保存在 Git 仓库的 Markdown 文件中，构建期生成 JSON
          索引，浏览器只负责搜索、阅读、复习与导出。
        </p>
        <p>
          这意味着你的知识不会被某个应用或数据库锁死：随时可以迁移到 Obsidian、
          Logseq、Joplin 或任何其他 Markdown 工具。
        </p>
      </section>

      <Separator className="my-7" />

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">数据流水线</h2>
        <ol className="space-y-2">
          {PIPELINE.map(({ icon: Icon, label, detail }, i) => (
            <li key={label} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-[var(--color-line)] text-[0.7rem] tabular-nums text-[var(--color-ink-3)]">
                {i + 1}
              </span>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent)]/12 text-[var(--color-accent)]">
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-[var(--color-ink)]">{label}</span>
                <span className="block text-xs text-[var(--color-ink-3)]">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <Separator className="my-7" />

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">当前数据</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['卡片', index?.total ?? '—'],
            ['标签', index?.tags.length ?? '—'],
            ['分类', index?.categories.length ?? '—'],
            ['主题', THEMES.length],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5"
            >
              <p className="text-lg font-semibold tabular-nums text-[var(--color-ink)]">{value}</p>
              <p className="text-xs text-[var(--color-ink-3)]">{label}</p>
            </div>
          ))}
        </div>
        {index ? (
          <p className="mt-2.5 text-xs text-[var(--color-ink-3)]">
            索引生成于 {new Date(index.generatedAt).toLocaleString('zh-CN')} · schema v{SCHEMA_VERSION}
          </p>
        ) : null}
      </section>

      <Separator className="my-7" />

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">如何新增一张卡片</h2>
        <div className="space-y-2 text-sm text-[var(--color-ink-2)]">
          <p>1. 在编辑器中编写并下载 <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs">.md</code> 文件。</p>
          <p>2. 放入 <code className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-xs">content/&lt;分类&gt;/</code> 目录并提交 Git。</p>
          <p>3. 构建时自动校验并重新生成索引。</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="primary" size="sm">
            <Link to="/editor">打开编辑器</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/cards">浏览卡片</Link>
          </Button>
        </div>
      </section>

      <Separator className="my-7" />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-[var(--color-ink)]">设计原则</h2>
        <ul className="space-y-2 text-sm text-[var(--color-ink-2)]">
          <li className="flex gap-2">
            <HardDrive aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-ink-3)]" />
            <span>数据属于 Markdown，版本属于 Git，索引属于构建系统，展示属于 React，视觉属于主题引擎。</span>
          </li>
          <li className="flex gap-2">
            <Github aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-ink-3)]" />
            <span>无后端、无登录、无云端调用。IndexedDB 只存草稿，正式数据永远在 Git 中。</span>
          </li>
          <li className="flex gap-2">
            <Palette aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-ink-3)]" />
            <span>内容可读性 &gt; 信息层级 &gt; 操作效率 &gt; 视觉装饰。主题可以艺术化，但不能影响阅读。</span>
          </li>
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Badge>纯前端</Badge>
        <Badge>可离线</Badge>
        <Badge>可迁移</Badge>
        <Badge>PWA</Badge>
        <Badge>GitHub Pages</Badge>
      </div>
    </div>
  )
}
