import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

/**
 * Browser entry point.
 *
 * The app is a pure static client: there is no server, no auth and no API.
 * All knowledge arrives as one `public/index.json` fetch that
 * `KnowledgeProvider` performs, so the only real boot requirement is the CSS
 * having settled before first paint to avoid a flash of unstyled card.
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
