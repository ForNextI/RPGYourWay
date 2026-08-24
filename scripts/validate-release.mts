import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as {
  name?: string
  version?: string
  rpgywVersion?: string
  dependencies?: Record<string, string>
}
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.5.201')
assert.equal(pkg.rpgywVersion, '1.5.201')
assert.equal(pkg.dependencies?.next, '16.2.6')
assert.equal(pkg.dependencies?.['@supabase/ssr'], '^0.12.4')
assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '^2.112.3')

for (const file of [
  'app/page.tsx',
  'app/play/page.tsx',
  'app/shape/page.tsx',
  'app/read/page.tsx',
  'app/pricing/page.tsx',
  'app/account/page.tsx',
  'app/account/actions.ts',
  'app/auth/confirm/route.ts',
  'app/support/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'components/SiteHeader.tsx',
  'components/SiteFooter.tsx',
  'components/AuthPanel.tsx',
  'components/AuthPrompt.tsx',
  'lib/version.ts',
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/proxy.ts',
  'proxy.ts',
  'public/rpgyw-logo-bordered.png',
  'public/rpgyw-compass.png',
  'public/rpgyw-map-tan.png',
]) assert.ok(exists(file), `Missing ${file}`)

const home = read('app/page.tsx')
assert.match(home, /const features =/)
assert.match(home, /What makes RPG Your Way unique\?/)
assert.match(home, /Who RPG Your Way is for/)
assert.match(home, /Tabletop gaming is best in person\./)
assert.match(home, /Campaign dashboard/)
assert.match(home, /feature-grid/)
assert.doesNotMatch(home, /Less site\. More game\./)
assert.doesNotMatch(home, /The foundation comes first\./)

const css = read('app/globals.css')
assert.match(css, /grid-template-areas:/)
assert.match(css, /"dashboard brand"/)
assert.match(css, /"unique audience"/)
assert.match(css, /\.accordion-plus::before/)
assert.match(css, /\.accordion-plus::after/)
assert.match(css, /\.feature-section/)
assert.match(css, /url\('\/rpgyw-map-tan\.png'\)/)

const footer = read('components/SiteFooter.tsx')
assert.match(footer, /© 2026 dodo ink\. Independent creative projects\./)
assert.match(footer, /APP_VERSION/)

console.log('RPG Your Way 1.5.201 landing-layout correction passed validation.')
