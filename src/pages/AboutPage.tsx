import { Link } from 'react-router-dom'
import { Cloud, Database, Layers, Lock, Palette, Search } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { Badge, Button, Separator } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { SITE } from '@/lib/site'
import { THEMES } from '@/features/themes/registry'

/**
 * About page. A personal knowledge base should state plainly where its data
 * lives and how to change it.
 */

const PIPELINE = [
  { icon: Database, label: 'Cloudflare D1', detail: '正式数据唯一来源：卡片、标签、复习记录' },
  { icon: Cloud, label: 'Pages Functions API', detail: '读取公开，写入需要编辑密码' },
  { icon: Search, label: '前端搜索', detail: 'Fuse.js，纯浏览器检索，不上传任何查询' },
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
          {SITE.name} 是一个<strong className="text-[var(--color-ink)]">知识卡片</strong>
          驱动的个人知识库。卡片、标签与复习记录存储在 Cloudflare D1 数据库中，
          通过 Pages Functions API 读写。
        </p>
        <p>
          读取是公开的，任何人打开站点即可浏览；新增、修改与删除需要登录
          （编辑密码）。在网页端完成的修改会立即写入数据库，对所有访问者生效。
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
        <p className="mt-2.5 text-xs text-[var(--color-ink-3)]">
          卡片数据实时读取自 Cloudflare D1（/api/cards）
        </p>
      </section>

      <Separator className="my-7" />

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-ink)]">如何新增一张卡片</h2>
        <div className="space-y-2 text-sm text-[var(--color-ink-2)]">
          <p>1. 点击右上角「登录」，输入编辑密码。</p>
          <p>2. 在编辑器中填写标题、分类、标签与正反面内容（Markdown）。</p>
          <p>3. 点击「保存」——立即写入 D1 并对所有人可见；也可「下载 .md」备份。</p>
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
            <Database aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-ink-3)]" />
            <span>数据属于 Cloudflare D1，展示属于 React，视觉属于主题引擎。</span>
          </li>
          <li className="flex gap-2">
            <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-ink-3)]" />
            <span>读取公开、写入需要密码；IndexedDB 只存编辑草稿，正式数据永远在 D1。</span>
          </li>
          <li className="flex gap-2">
            <Palette aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--color-ink-3)]" />
            <span>内容可读性 &gt; 信息层级 &gt; 操作效率 &gt; 视觉装饰。主题可以艺术化，但不能影响阅读。</span>
          </li>
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Badge>Cloudflare Pages</Badge>
        <Badge>D1</Badge>
        <Badge>密码保护</Badge>
        <Badge>PWA</Badge>
        <Badge>可迁移</Badge>
      </div>
    </div>
  )
}