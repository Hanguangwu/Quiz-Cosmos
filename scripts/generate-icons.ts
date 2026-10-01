/**
 * Rasterise the app mark into the icon set a PWA install needs.
 *
 * AGENTS.md §18 requires an app icon and standalone display. The browser will
 * not accept the hand-written `public/favicon.svg` for this, so every declared
 * size is produced here as a real PNG.
 *
 * The mark is defined once, below, and drawn twice:
 *   · `artwork` is drawn edge-to-edge  → used for the `any` purpose icons and
 *     for apple-touch-icon, which iOS masks into its own shape.
 *   · `artwork` scaled into the middle 80% on a full-bleed square → used for
 *     the `maskable` icon, because Android crops maskable icons to whatever
 *     shape the launcher wants and anything outside the 80% safe zone can be
 *     sliced away.
 *
 * Run with `pnpm run icons`. Output is committed, not built in CI, so a fresh
 * clone has working icons without needing sharp.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ICON_DIR = resolve(ROOT, 'public/icons')

/** Foreground art, drawn on a 512 grid. Shared with public/favicon.svg. */
const ARTWORK = `
  <rect x="88" y="104" width="336" height="304" rx="34" fill="#1a2436" />
  <rect x="128" y="144" width="256" height="264" rx="28" fill="#e9eefb" />
  <rect x="160" y="176" width="10" height="200" rx="5" fill="#4cc9f0" />
  <rect x="196" y="188" width="156" height="18" rx="9" fill="#0d1320" opacity="0.82" />
  <rect x="196" y="228" width="156" height="18" rx="9" fill="#0d1320" opacity="0.55" />
  <rect x="196" y="268" width="156" height="18" rx="9" fill="#0d1320" opacity="0.55" />
  <rect x="196" y="308" width="112" height="18" rx="9" fill="#a78bfa" opacity="0.75" />
`

function mark({ padding = 0 }: { padding?: number }): string {
  const size = 512
  const inner = size * (1 - padding * 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#070a12" />
  <g transform="translate(${(size - inner) / 2} ${(size - inner) / 2}) scale(${inner / size})">
    ${ARTWORK}
  </g>
</svg>`
}

interface Target {
  file: string
  size: number
  padding?: number
}

/**
 * `padding` puts the art inside the maskable safe zone. The `any` icons keep
 * the artwork full-bleed because Android only applies a circle/ squircle mask
 * for `maskable` icons.
 */
const TARGETS: readonly Target[] = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512, padding: 0.1 },
  { file: '../apple-touch-icon.png', size: 180 },
]

async function main(): Promise<void> {
  await mkdir(ICON_DIR, { recursive: true })

  for (const target of TARGETS) {
    const svg = mark({ padding: target.padding })
    const out = resolve(ICON_DIR, target.file)
    const png = await sharp(Buffer.from(svg, 'utf8'))
      .resize(target.size, target.size)
      .png({ compressionLevel: 9 })
      .toBuffer()
    await writeFile(out, png)
    console.log(`icons  ${out.replace(ROOT + '\\', '')}  ${target.size}x${target.size}`)
  }
}

await main()
