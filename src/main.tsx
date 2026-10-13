import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

/**
 * Browser entry point.
 *
 * The app is a client for the Cloudflare Pages Function API: reading is
 * public, writing requires the edit password. All knowledge arrives as one
 * `GET /api/cards` fetch that `KnowledgeProvider` performs, so the only real
 * boot requirement is the CSS having settled before first paint to avoid a
 * flash of unstyled card.
 */
const container = document.getElementById('root')

if (!container) {
  throw new Error('找不到 #root 挂载点，index.html 与 main.tsx 不匹配。')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
