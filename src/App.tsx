import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { KnowledgeProvider } from '@/lib/knowledge-context'
import { SITE } from '@/lib/site'
import { AppShell } from '@/shell/AppShell'
import { Skeleton } from '@/ui'

/**
 * The whole app is one shell plus twelve routes.
 * `KnowledgeProvider` owns the single API-backed index load; pages read from it.
 *
 * Routes are split with `React.lazy` so each one lands in its own chunk: the
 * shell (router + provider + chrome) stays in the first chunk, while the heavy
 * route graphs — CodeMirror behind the editor, html2canvas behind the export
 * menu, KaTeX/prism behind every rendered card — load on demand instead of
 * being shipped to every visitor.
 */
const HomePage = lazy(() => import('@/pages/HomePage'))
const CardsPage = lazy(() => import('@/pages/CardsPage'))
const CardPage = lazy(() => import('@/pages/CardPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const TagsPage = lazy(() => import('@/pages/TagsPage'))
const TagPage = lazy(() => import('@/pages/TagPage'))
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'))
const CategoryPage = lazy(() => import('@/pages/CategoryPage'))
const ReviewPage = lazy(() => import('@/pages/ReviewPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const FlashcardManagerPage = lazy(() => import('@/pages/FlashcardManagerPage'))
const EditorPage = lazy(() => import('@/pages/EditorPage'))
const ThemesPage = lazy(() => import('@/pages/ThemesPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))

/** Route placeholder: reserves a page-height block so the shell never jumps. */
function RouteFallback() {
  return (
    <div className="py-8">
      <Skeleton className="h-64" />
    </div>
  )
}

/**
 * Login route: redirects away once authed, otherwise renders the login form
 * wired to the auth context.
 */
function LoginRoute() {
  const { login, isAuthed } = useAuth()
  const navigate = useNavigate()
  if (isAuthed) return <Navigate to="/editor" replace />
  return (
    <LoginPage
      onLogin={async (password) => {
        await login(password)
        navigate('/editor', { replace: true })
      }}
    />
  )
}

/** Gate for edit routes: browsing is public, editing needs a session. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthed, login } = useAuth()
  if (!isAuthed) return <LoginPage onLogin={login} />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter basename={SITE.base}>
      <AuthProvider>
        <KnowledgeProvider>
          <AppShell>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/cards" element={<CardsPage />} />
                <Route path="/card/:slug" element={<CardPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/tags" element={<TagsPage />} />
                <Route path="/tags/:tag" element={<TagPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/categories/:name" element={<CategoryPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/manage" element={<FlashcardManagerPage />} />
                <Route path="/login" element={<LoginRoute />} />
                <Route
                  path="/editor"
                  element={
                    <RequireAuth>
                      <EditorPage />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/editor/:slug"
                  element={
                    <RequireAuth>
                      <EditorPage />
                    </RequireAuth>
                  }
                />
                <Route path="/themes" element={<ThemesPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </AppShell>
        </KnowledgeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
