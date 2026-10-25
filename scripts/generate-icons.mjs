// Renders the app icon (public/favicon.svg) to every PNG size the web app needs.
// Run with: npm run icons
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync('public/favicon.svg', 'utf8')

/** Maskable icons need their artwork inside the central 80% "safe zone". */
const maskable = svg
  .replace('<rect width="512" height="512" rx="120" fill="url(#bg)"/>', '<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(51.2 51.2) scale(0.8)">')
  .replace('</svg>', '</g></svg>')

const outputs = [
  { file: 'public/icons/icon-192.png', size: 192, source: svg },
  { file: 'public/icons/icon-512.png', size: 512, source: svg },
  { file: 'public/icons/maskable-512.png', size: 512, source: maskable },
  { file: 'public/icons/apple-touch-icon.png', size: 180, source: maskable },
  { file: 'public/icons/favicon-32.png', size: 32, source: svg },
  { file: 'public/icons/og-image.png', size: 1200, source: og() },
]

for (const { file, size, source } of outputs) {
  const png = new Resvg(source, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: true } }).render().asPng()
  writeFileSync(file, png)
  console.log(`${file}  ${size}px`)
}

/** Social preview card (1200×630 artwork, rendered on a square canvas then cropped by platforms). */
function og() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1c1a2e"/><stop offset="1" stop-color="#0d0c14"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(96 150)">
    <rect width="300" height="64" rx="32" fill="#5b5bd6"/>
    <rect y="100" width="480" height="64" rx="32" fill="#1ba3a3"/>
    <rect y="200" width="220" height="64" rx="32" fill="#f0a133"/>
    <circle cx="390" cy="32" r="32" fill="#e5487a"/>
  </g>
  <text x="660" y="300" fill="#ffffff" font-family="Georgia, serif" font-size="96">Stiamo</text>
  <text x="662" y="370" fill="#a8a6c4" font-family="Arial, sans-serif" font-size="32">Cases, meetings, plans &amp; goals —</text>
  <text x="662" y="414" fill="#a8a6c4" font-family="Arial, sans-serif" font-size="32">one calm canvas.</text>
</svg>`
}
