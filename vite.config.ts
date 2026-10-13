import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Build tooling for 知库 · Knowledge Cards.
 *
 * Deploy order is tsc → vite build → Cloudflare Pages (Functions + D1 + KV),
 * and §18 requires a PWA that still opens offline. `SITE.base` in
 * `src/lib/site.ts` reads `import.meta.env.BASE_URL`, so it can no longer
 * drift out of sync with `base` below.
 *
 * The app shell and route chunks are precached so the shell opens offline;
 * live card data is fetched at runtime from the D1-backed API (`/api/cards`).
 */

/** Root package of a path that is already relative to a `node_modules/`. */
function rootPackage(afterNodeModules: string): string {
  const segments = afterNodeModules.split('/').filter((segment) => segment !== '')
  const head = segments[0] ?? ''
  if (!head) return ''
  if (head.startsWith('@')) {
    const tail = segments[1]
    return tail ? `${head}/${tail}` : head
  }
  return head
}

/**
 * Package name of a bundled module id, or `''` for app code and Vite's virtual
 * modules. pnpm's store repeats `node_modules` in the path
 * (`.pnpm/katex@0.16.22/node_modules/katex/dist/katex.mjs`), so the name is
 * read after the *last* separator — which is also the one pnpm's own symlinks
 * point through. Scoped packages keep both segments (`@codemirror/view`).
 *
 * Vite also hands the bundler a few *bare* specifiers instead of resolved
 * paths — `react/jsx-runtime` is the one that matters, because leaving it
 * unmatched let it be pulled into the `markdown` group and drag KaTeX into the
 * first-load graph. Absolute paths (Windows drive letters included) and Vite's
 * `\0`-prefixed virtual ids are still reported as `''` so app code never lands
 * in a vendor group.
 */
function packageNameOf(moduleId: string): string {
  const normalised = moduleId.replace(/\\/g, '/')
  const marker = normalised.lastIndexOf('node_modules/')
  if (marker >= 0) return rootPackage(normalised.slice(marker + 'node_modules/'.length))
  const first = normalised.charAt(0)
  if (first === '/' || first === '.' || first === '\u0000' || normalised.includes(':')) return ''
  return rootPackage(normalised)
}

/** Vendor group matcher: `test` receives every module id in the graph. */
function vendorGroup(name: string, match: RegExp, priority: number) {
  return {
    name,
    test: (moduleId: string) => match.test(packageNameOf(moduleId)),
    priority,
  }
}

/**
 * Manual chunking, in the order the heavy vendors should win.
 *
 * Vite 8 is Rolldown-based, so this lives under
 * `build.rolldownOptions.output` (the Rollup-flavoured `rollupOptions` /
 * `manualChunks` are deprecated aliases in Rolldown 1.x). `codeSplitting` is
 * the native key in Rolldown 1.0.3; `advancedChunks` is its deprecated alias
 * and emits a warning. Group `test` predicates classify by package name rather
 * than by path regex so the pnpm store layout and Windows separators do not
 * matter.
 *
 * Priorities are descending, and they matter twice: the first group whose
 * `test` matches captures a module *and its transitive dependencies*, and a
 * module captured by a higher-priority group is removed from every
 * lower-priority one. So `react` outranks `radix` — otherwise the Radix group
 * would reach through its own imports and drag `react-dom` across — and
 * `codemirror` outranks `codemirror-langs` for the same reason.
 *
 * There is deliberately no catch-all "everything else" group. A group is a
 * single chunk that the entry imports statically whenever any of its modules
 * is eagerly reachable, so swallowing `yaml` (used only by the front-matter
 * parser on /editor) would pull editor-only YAML parsing into the first load.
 * Leaving unmatched packages to Rolldown's own automatic chunking keeps them
 * with their only importer.
 */
const vendorChunks = [
  // CodeMirror 6 runtime: reachable only from /editor. The ~20 bundled Lezer
  // grammars are a separate group below so neither half breaches 500 kB.
  vendorGroup(
    'codemirror',
    /^(?:@codemirror\/(?:state|view|language|commands|search|autocomplete|legacy-modes)$|@lezer\/(?:common|highlight|lr)$|crelt$|style-mod$|w3c-keyname$)/,
    100,
  ),
  vendorGroup(
    'codemirror-langs',
    /^(?:@codemirror\/(?:lang-|language-data)|@lezer\/|@marijn\/)/,
    95,
  ),
  // Raster export: reachable only from the export menu.
  vendorGroup('html2canvas', /^html2canvas$/, 100),
  // Fuzzy search: reachable only from /search.
  vendorGroup('fuse', /^fuse\.js$/, 100),
  // React itself plus the router.
  vendorGroup(
    'react',
    /^(?:react$|react-dom$|react-router$|react-router-dom$|@remix-run\/|scheduler$|loose-envify$)/,
    90,
  ),
  // Markdown rendering: react-markdown + remark/rehype/micromark/mdast + KaTeX
  // + prismjs. Used by every route that renders a card, so it is its own
  // long-lived chunk rather than being re-bundled per route.
  vendorGroup(
    'markdown',
    /^(?:katex$|prismjs$|react-markdown$|remark-|rehype-|micromark|mdast-|hast-|hastscript$|unist-|unified$|bail$|trough$|vfile|property-information$|space-separated-tokens$|comma-separated-tokens$|html-url-attributes$|html-void-elements$|web-namespaces$|stringify-entities$|parse-entities$|character-|decode-named-character-reference$|zwitch$|longest-streak$|ccount$|escape-string-regexp$|markdown-table$|devlop$|trim-lines$|estree-util-|is-(?:alphabetical|alphanumerical|decimal|extendable|hexadecimal|plain-obj)$)/,
    80,
  ),
  // Radix primitives and the runtime helpers they pull in.
  vendorGroup(
    'radix',
    /^(?:@radix-ui\/|@floating-ui\/|@ungap\/structured-clone$|aria-hidden$|react-remove-scroll$|react-remove-scroll-bar$|use-sidecar$|use-callback-ref$|use-isomorphic-layout-effect$|get-nonce$|react-style-singleton$|tslib$|class-variance-authority$|clsx$|tailwind-merge$)/,
    70,
  ),
]

/**
 * Deployment base path. Cloudflare Pages serves the site from the domain root,
 * so the default is `/`. Set `VITE_BASE_PATH` to host under a sub-path instead.
 * `SITE.base` in `src/lib/site.ts` reads the same value via
 * `import.meta.env.BASE_URL`, and the PWA manifest/routes below derive from it.
 */
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '知库 · Knowledge Cards',
        short_name: '知库',
        description: '个人知识卡片库：Markdown 书写，云端存储，卡片式阅读与复习。',
        lang: 'zh-CN',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#070a12',
        theme_color: '#070a12',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}icons/maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,svg,png,webp,woff,woff2}'],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: vendorChunks,
        },
      },
    },
  },
})
