import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { KnowledgeProvider } from '@/lib/knowledge-context'
import { SITE } from '@/lib/site'
import { AppShell } from '@/shell/AppShell'
import { Skeleton } from '@/ui'

/**
 * The whole app is one shell plus twelve routes (design-plan §13).
 * `KnowledgeProvider` owns the single `index.json` fetch; pages read from it.
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
const EditorPage = lazy(() => import('@/pages/EditorPage'))
const ThemesPage = lazy(() => import('@/pages/ThemesPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))

/** Route placeholder: reserves a page-height block so the shell never jumps. */
function RouteFallback() {
  return (
    <div className="py-8">
      <Skeleton className="h-64" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={SITE.base}>
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
              <Route path="/editor" element={<EditorPage />} />
              <Route path="/editor/:slug" element={<EditorPage />} />
              <Route path="/themes" element={<ThemesPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </KnowledgeProvider>
    </BrowserRouter>
  )
}
