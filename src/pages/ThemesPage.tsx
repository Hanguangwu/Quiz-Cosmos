import { useMemo } from 'react'
import { Check, Eye } from 'lucide-react'
import { PageHeader } from '@/shell/AppShell'
import { Button, EmptyState, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui'
import { useKnowledge } from '@/lib/knowledge-context'
import { useCardThemePreference } from '@/shell/preferences'
import { resolveThemeId, themeToBinding } from '@/features/themes/engine'
import { DEFAULT_THEME_ID, THEMES, getThemesByCategory } from '@/features/themes/registry'
import { THEME_CATEGORIES, THEME_CATEGORY_LABELS, type ThemeDefinition } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Theme gallery (AGENTS.md §26).
 *
 * Every swatch is a *live* preview rendered by the real card component through
 * the Theme Engine, so what a reader sees here is what they get. Adding a
 * theme is a data change; this page needs no edits.
 */

function ThemePreview({ theme, title, body }: { theme: ThemeDefinition; title: string; body: string }) {
  const binding = themeToBinding(theme)
  return (
    <div
      {...binding}
      style={{ ...binding.style, ['--card-padding' as string]: '18px', ['--card-max-width' as string]: '100%' }}
      className="flex h-full flex-col gap-2"
    >
      <p className="kc-card__eyebrow">问题</p>
      <h3 className="text-[0.98rem] leading-snug">{title}</h3>
      <hr className="kc-card__rule" />
      <p className="kc-card__eyebrow">答案</p>
      <p className="text-[0.82rem] leading-relaxed">{body}</p>
      <div className="mt-auto flex flex-wrap gap-1 pt-2">
        <span className="kc-card__tag">示例</span>
        <span className="kc-card__tag">预览</span>
      </div>
    </div>
  )
}

function ThemeCard({ theme, active, onSelect }: { theme: ThemeDefinition; active: boolean; onSelect: () => void }) {
  const { index } = useKnowledge()
  const sample = useMemo(
    () => index?.cards.find((card) => card.hasAnswer) ?? index?.cards[0],
    [index],
  )

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[var(--radius-card)] border transition-colors',
        active
          ? 'border-[var(--color-accent)]'
          : 'border-[var(--color-line)] hover:border-[var(--color-accent)]/50',
      )}
    >
      <div className="kc-swatch-grid p-4">
        <div className="kc-card min-h-[13rem]">
          <ThemePreview
            theme={theme}
            title={sample?.title ?? theme.name}
            body={sample ? sample.answer.replace(/[#*`>|\n-]/g, ' ').slice(0, 130) : theme.description}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">{theme.name}</p>
          <p className="truncate text-[0.7rem] text-[var(--color-ink-3)]">{theme.nameLatin}</p>
        </div>
        <Button
          size="sm"
          variant={active ? 'primary' : 'outline'}
          onClick={onSelect}
          aria-label={active ? '当前主题' : `使用 ${theme.name} 主题`}
        >
          {active ? <Check /> : <Eye />}
          {active ? '使用中' : '使用'}
        </Button>
      </div>
    </div>
  )
}

export default function ThemesPage() {
  const { loading } = useKnowledge()
  const [themeId, setThemeId] = useCardThemePreference()
  const activeId = resolveThemeId(null, themeId, THEMES, DEFAULT_THEME_ID)
  const grouped = getThemesByCategory()

  return (
    <div>
      <PageHeader
        title="主题"
        description="主题只改变 CSS 变量，不改变卡片结构。新增主题不需要修改任何业务逻辑。"
        actions={
          <Select value={activeId} onValueChange={(value) => setThemeId(value)}>
            <SelectTrigger className="h-8 w-auto text-[0.8125rem]" aria-label="默认卡片主题">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  {theme.name} · {theme.nameLatin}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : THEMES.length === 0 ? (
        <EmptyState title="主题注册表为空" description="检查 src/features/themes/registry.ts。" />
      ) : (
        <Tabs defaultValue={THEME_CATEGORIES[0]}>
          <TabsList className="flex-wrap">
            {THEME_CATEGORIES.map((category) => (
              <TabsTrigger key={category} value={category}>
                {THEME_CATEGORY_LABELS[category]}
                <span className="ml-1.5 text-[0.7rem] tabular-nums text-[var(--color-ink-3)]">
                  {grouped[category].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {THEME_CATEGORIES.map((category) => {
            const themes = grouped[category]
            if (themes.length === 0) return null
            return (
              <TabsContent key={category} value={category}>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {themes.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      theme={theme}
                      active={theme.id === activeId}
                      onSelect={() => setThemeId(theme.id)}
                    />
                  ))}
                </div>
              </TabsContent>
            )
          })}
        </Tabs>
      )}

      <p className="mt-8 text-center text-xs text-[var(--color-ink-3)]">
        当前 {THEMES.length} 套主题覆盖极简、艺术、科技、中国传统与自然五类。
      </p>
    </div>
  )
}
