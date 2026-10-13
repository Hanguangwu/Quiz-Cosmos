import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  LayoutGrid,
  Library,
  LogIn,
  LogOut,
  Moon,
  Palette,
  PlayCircle,
  Search,
  Sun,
  Tags,
  Info,
  Menu,
} from 'lucide-react'
import { Button, Sheet, TooltipContent, TooltipProvider, TooltipRoot, TooltipTrigger } from '@/ui'
import { SITE } from '@/lib/site'
import { useAuth } from '@/lib/auth'
import { useKnowledge } from '@/lib/knowledge-context'
import { useAppearance } from './preferences'
import { cn } from '@/lib/cn'

/**
 * Application chrome.
 *
 * Desktop: fixed sidebar + scrolling content. Mobile: top bar + bottom
 * navigation. The shell never renders knowledge content itself — it hands off
 * to the Theme Engine and card components.
 */

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

const PRIMARY: NavItem[] = [
  { to: '/', label: '总览', icon: Home, end: true },
  { to: '/cards', label: '全部卡片', icon: Library },
  { to: '/review', label: '复习', icon: PlayCircle },
  { to: '/search', label: '搜索', icon: Search },
]

const SECONDARY: NavItem[] = [
  { to: '/tags', label: '标签', icon: Tags },
  { to: '/categories', label: '分类', icon: LayoutGrid },
  { to: '/themes', label: '主题', icon: Palette },
  { to: '/about', label: '关于', icon: Info },
]

const MOBILE: NavItem[] = [
  { to: '/', label: '总览', icon: Home, end: true },
  { to: '/cards', label: '卡片', icon: Library },
  { to: '/review', label: '复习', icon: PlayCircle },
  { to: '/search', label: '搜索', icon: Search },
]

function GlobalSearch({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const [value, setValue] = useState('')
  const navigate = useNavigate()

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onNavigate?.()
        navigate(`/search?q=${encodeURIComponent(value.trim())}`)
      }}
      className={cn('relative', className)}
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-3)]"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="搜索标题、标签、正文…"
        aria-label="搜索知识卡片"
        className="h-9.5 w-full rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface-2)] pl-9 pr-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/25"
      />
    </form>
  )
}

function AppearanceToggle() {
  const [appearance, setAppearance] = useAppearance()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={appearance === 'dark' ? '切换到浅色' : '切换到深色'}
      onClick={() => setAppearance(appearance === 'dark' ? 'light' : 'dark')}
    >
      {appearance === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}

function NavItems({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-[var(--radius-panel)] px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-[var(--color-surface-2)] font-medium text-[var(--color-ink)]'
                : 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]',
            )
          }
        >
          <Icon aria-hidden className="size-4 shrink-0 opacity-80" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function AuthControl() {
  const { isAuthed, logout } = useAuth()
  const navigate = useNavigate()

  if (isAuthed) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="退出登录"
        onClick={() => {
          void logout()
          navigate('/')
        }}
      >
        <LogOut />
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label="登录以编辑" onClick={() => navigate('/login')}>
      <LogIn />
    </Button>
  )
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={`${SITE.base}icons/icon.svg`} alt="" className="size-8 rounded-[10px]" />
      <span className="leading-tight">
        <span className="block text-[0.95rem] font-semibold tracking-tight text-[var(--color-ink)]">
          {SITE.name}
        </span>
        <span className="block text-[0.7rem] text-[var(--color-ink-3)]">{SITE.nameLatin}</span>
      </span>
    </Link>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { index } = useKnowledge()
  return (
    <div className="flex h-full flex-col gap-5 p-4">
      <Brand />
      <GlobalSearch onNavigate={onNavigate} />
      <div className="flex-1 overflow-y-auto">
        <NavItems items={PRIMARY} onNavigate={onNavigate} />
        <div className="my-4 h-px bg-[var(--color-line)]" />
        <NavItems items={SECONDARY} onNavigate={onNavigate} />
      </div>
      <div className="flex items-center justify-between border-t border-[var(--color-line)] pt-3">
        <span className="text-xs text-[var(--color-ink-3)]">
          {index ? `${index.total} 张卡片` : '载入中…'}
        </span>
        <div className="flex items-center gap-1">
          <AuthControl />
          <AppearanceToggle />
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Close the drawer whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname])

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-full">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-[var(--color-line)] bg-[var(--color-surface)]/60 backdrop-blur lg:block">
          <SidebarBody />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="kc-safe-t sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-canvas)]/85 px-4 py-3 backdrop-blur lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label="打开导航"
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </Button>
            <Brand />
            <div className="ml-auto flex items-center gap-1">
              <TooltipRoot>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" asChild aria-label="搜索">
                    <Link to="/search">
                      <Search />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>搜索</TooltipContent>
              </TooltipRoot>
              <AppearanceToggle />
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-14">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="导航">
        <SidebarBody onNavigate={() => setMenuOpen(false)} />
      </Sheet>

      {/* Mobile bottom navigation */}
      <nav className="kc-safe-b fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-[var(--color-line)] bg-[var(--color-surface)]/92 px-1 pt-1.5 backdrop-blur lg:hidden">
        {MOBILE.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-panel)] py-1.5 text-[0.68rem] transition-colors',
                isActive
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]',
              )
            }
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </NavLink>
        ))}
        <NavLink
          to="/tags"
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 rounded-[var(--radius-panel)] py-1.5 text-[0.68rem] transition-colors',
              isActive
                ? 'text-[var(--color-accent)]'
                : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]',
            )
          }
        >
          <Tags aria-hidden className="size-5" />
          标签
        </NavLink>
      </nav>
    </TooltipProvider>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-line)] pb-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm text-[var(--color-ink-3)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
