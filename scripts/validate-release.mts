import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as { name?: string; version?: string; dependencies?: Record<string, string> }
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.3.12')
assert.equal(pkg.dependencies?.next, '16.2.6')

for (const file of [
  'app/page.tsx',
  'app/play/page.tsx',
  'app/shape/page.tsx',
  'app/read/page.tsx',
  'app/pricing/page.tsx',
  'app/account/page.tsx',
  'app/support/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'app/robots.ts',
  'app/icon.png',
  'app/apple-icon.png',
  'app/favicon.ico',
  'components/SiteHeader.tsx',
  'components/SiteFooter.tsx',
  'public/rpgyw-logo.png',
  'public/rpgyw-logo-bordered.png',
  'public/rpgyw-compass.png',
  'public/rpgyw-map-tan.png',
]) {
  assert.ok(exists(file), `Missing ${file}`)
}

for (const file of fs.readdirSync(path.join(root, 'app'), { recursive: true })
  .map(String)
  .filter((file) => file.endsWith('page.tsx'))) {
  const source = read(path.join('app', file))
  assert.match(source, /<main[^>]*id="main-content"[^>]*tabIndex=\{-1\}/, `${file} must expose the skip-link target.`)
}

const layout = read('app/layout.tsx')
assert.match(layout, /href="#main-content"/)
assert.match(layout, /RPG Your Way/)
assert.match(layout, /colorScheme: 'light'/)

const home = read('app/page.tsx')
assert.match(home, /Tabletop gaming is best in person/)
assert.match(home, /No question\./)
assert.match(home, /But sometimes\.\.\./)
assert.match(home, /Who RPG Your Way is for/)
assert.match(home, /src="\/rpgyw-logo-bordered\.png"/)
assert.match(home, /alt="RPG Your Way compass logo"/)
assert.match(home, /Campaign dashboard/)
assert.match(home, /Continue campaign/)
assert.match(home, /Your adventure/)
assert.match(home, /Solo players/)
assert.match(home, /Neurodivergent players/)
assert.match(home, /Forever DMs/)
assert.match(home, /Blind players and screen-reader users/)
assert.match(home, /Players with irregular or limited schedules/)
assert.match(home, /Beginners and returning players/)
assert.match(home, /<section className="audience-section"/)
assert.match(home, /<details className="audience-accordion">/)
assert.match(home, /<details className="audience-item"/)

const header = read('components/SiteHeader.tsx')
assert.match(header, /src="\/rpgyw-compass\.png"/)
assert.match(header, /href: '\/play', label: 'Play'/)
assert.match(header, /href: '\/shape', label: 'Shape'/)
assert.match(header, /href: '\/read', label: 'Read'/)
assert.doesNotMatch(header, /href: '\/pricing', label: 'Pricing'/)
assert.doesNotMatch(header, /href: '\/account', label: 'Account'/)

const play = read('app/play/page.tsx')
assert.match(play, /<PageShell variant="play">/)

const shape = read('app/shape/page.tsx')
assert.match(shape, /Turn the game into the story/)
assert.match(shape, /priced separately per conversion/i)
assert.match(shape, /not draw from your Play usage balance/i)

const readPage = read('app/read/page.tsx')
assert.match(readPage, /The novel\./)
assert.match(readPage, /free site/)
assert.match(readPage, /https:\/\/www\.thereadingofthewardens\.com/)
assert.doesNotMatch(readPage, /WardensPC/i)

const pricing = read('app/pricing/page.tsx')
assert.match(pricing, /bounded prepaid usage/i)
assert.match(pricing, /No dollar amounts are published/i)

const robots = read('app/robots.ts')
assert.match(robots, /disallow:\s*['"]\/['"]/)

const css = read('app/globals.css')
assert.match(css, /--forest:/)
assert.match(css, /--cream:/)
assert.match(css, /--lime:/)
assert.match(css, /url\('\/rpgyw-map-tan\.png'\)/)
assert.match(css, /\.site-frame-play/)
assert.match(css, /data:image\/svg\+xml/)
assert.match(css, /grid-template-areas:/)
assert.match(css, /"thesis logo"/)
assert.match(css, /"dashboard logo"/)
assert.match(css, /\.audience-section/)
assert.match(css, /\.audience-accordion/)
assert.match(css, /@media \(max-width: 620px\)/)
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)

console.log('RPG Your Way 1.3.12 parchment-map UI foundation passed validation.')
