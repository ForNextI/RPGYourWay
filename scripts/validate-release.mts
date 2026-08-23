import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as { name?: string; version?: string; dependencies?: Record<string, string> }
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '0.1.1')
assert.equal(pkg.dependencies?.next, '16.2.6')

for (const file of [
  'app/page.tsx',
  'app/play/page.tsx',
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
assert.match(home, /Tabletop roleplaying/)
assert.match(home, /Pricing is not final yet/)
assert.match(home, /src="\/rpgyw-logo\.png"/)
assert.match(home, /alt="RPG Your Way compass logo"/)
assert.doesNotMatch(home, /WardensPC\.com/i)

const header = read('components/SiteHeader.tsx')
assert.match(header, /src="\/rpgyw-compass\.png"/)
assert.doesNotMatch(header, />R<\/span>/)

const pricing = read('app/pricing/page.tsx')
assert.match(pricing, /bounded prepaid usage/i)
assert.match(pricing, /No dollar amounts are published/i)

const robots = read('app/robots.ts')
assert.match(robots, /disallow:\s*['"]\/['"]/)

const css = read('app/globals.css')
assert.match(css, /--cyan:\s*oklch\(0\.78 0\.15 195\)/)
assert.match(css, /--amber:\s*oklch\(0\.78 0\.17 55\)/)
assert.match(css, /\.brand-logo-card/)
assert.match(css, /@media \(max-width: 620px\)/)
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)

console.log('RPG Your Way 0.1.1 brand assets passed validation.')
