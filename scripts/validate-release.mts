import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as { name?: string; version?: string; dependencies?: Record<string, string> }
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.3.1')
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
  'public/rpgyw-compass.png',
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

const home = read('app/page.tsx')
assert.match(home, /Tabletop gaming is best in person/)
assert.match(home, /No question\./)
assert.match(home, /But sometimes\.\.\./)
assert.match(home, /Who RPG Your Way is for/)
assert.match(home, /src="\/rpgyw-logo\.png"/)
assert.match(home, /alt="RPG Your Way compass logo"/)
assert.match(home, /Solo players/)
assert.match(home, /Neurodivergent players/)
assert.match(home, /Forever DMs/)
assert.match(home, /Blind players and screen-reader users/)
assert.match(home, /Players with irregular or limited schedules/)
assert.match(home, /Beginners and returning players/)
assert.match(home, /<details className="audience-accordion hero-audience">/)
assert.match(home, /<details className="audience-item"/)
assert.doesNotMatch(home, /When the table isn&apos;t available/)
assert.doesNotMatch(home, /Open this to see who RPG Your Way is for/)

const header = read('components/SiteHeader.tsx')
assert.match(header, /src="\/rpgyw-compass\.png"/)
assert.match(header, /href: '\/play', label: 'Play'/)
assert.match(header, /href: '\/shape', label: 'Shape'/)
assert.match(header, /href: '\/read', label: 'Read'/)
assert.doesNotMatch(header, /href: '\/pricing', label: 'Pricing'/)
assert.doesNotMatch(header, /href: '\/account', label: 'Account'/)

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
assert.match(css, /--cyan:\s*oklch\(0\.78 0\.15 195\)/)
assert.match(css, /--amber:\s*oklch\(0\.78 0\.17 55\)/)
assert.match(css, /\.brand-logo-card/)
assert.match(css, /\.hero-thesis/)
assert.match(css, /align-items:\s*start/)
assert.match(css, /hero-thesis-line/)
assert.match(css, /white-space:\s*nowrap/)
assert.match(css, /font-size:\s*clamp\(1\.05rem, 2\.4vw, 2\.2rem\)/)
assert.match(css, /\.hero-audience/)
assert.match(css, /\.audience-accordion/)
assert.match(css, /\.audience-item/)
assert.match(css, /@media \(max-width: 620px\)/)
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)

console.log('RPG Your Way 1.3.1 compact top-aligned landing thesis passed validation.')
