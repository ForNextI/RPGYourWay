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
assert.equal(pkg.version, '1.5.300')
assert.equal(pkg.rpgywVersion, '1.5.300')
assert.equal(pkg.dependencies?.next, '16.2.6')
assert.equal(pkg.dependencies?.['@supabase/ssr'], '^0.12.4')
assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '^2.112.3')

for (const file of [
  'app/page.tsx',
  'app/play/page.tsx',
  'app/shape/page.tsx',
  'app/api/shape/jobs/route.ts',
  'app/api/shape/transform/route.ts',
  'app/read/page.tsx',
  'app/pricing/page.tsx',
  'app/account/page.tsx',
  'app/account/actions.ts',
  'app/auth/confirm/route.ts',
  'components/SiteHeader.tsx',
  'components/SiteFooter.tsx',
  'components/AuthPanel.tsx',
  'components/AuthPrompt.tsx',
  'components/ShapeSignInGate.tsx',
  'components/ShapeWorkspace.tsx',
  'lib/version.ts',
  'lib/shape/access.ts',
  'lib/shape/transcript.ts',
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/proxy.ts',
  'supabase/migrations/20260824163000_shape_jobs.sql',
  'proxy.ts',
  'public/rpgyw-logo-bordered.png',
  'public/rpgyw-compass.png',
  'public/rpgyw-map-tan.png',
]) assert.ok(exists(file), `Missing ${file}`)

const home = read('app/page.tsx')
for (const phrase of [
  'Why I Created RPG Your Way',
  'The Players I Built RPG Your Way For',
  'RPGs are better at full throttle',
  'Buy play and use it when you want',
  'Run at cost',
  'Campaigns should last',
  'Turn the campaign into a story',
  'Your characters. Your campaign. Your pace.',
  'Solo players',
  'Neurodivergent players',
  'Forever DMs',
  'Blind players and screen-reader users',
  'Players with irregular or limited schedules',
  'Beginners and returning players',
  "They're part of why I created RPG Your Way.",
]) assert.match(home, new RegExp(phrase.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')))
assert.doesNotMatch(home, /What makes RPG Your Way unique\?/)
assert.doesNotMatch(home, /Who RPG Your Way is for/)
assert.match(home, /Tabletop gaming is best in person\./)
assert.match(home, /Campaign dashboard/)
assert.match(home, /feature-grid/)

const shapePage = read('app/shape/page.tsx')
assert.match(shapePage, /1,000,000 characters/)
assert.match(shapePage, /ShapeSignInGate/)
assert.match(shapePage, /ShapeWorkspace/)
assert.match(shapePage, /shapeEmailAllowed/)

const jobs = read('app/api/shape/jobs/route.ts')
assert.match(jobs, /shape_jobs/)
assert.match(jobs, /buildShapeAnalysisChunks/)
assert.match(jobs, /buildShapeTranscriptChunks/)
assert.match(jobs, /RPGYW_SHAPE_BETA_EMAILS|shapeEmailAllowed/)

const transform = read('app/api/shape/transform/route.ts')
assert.match(transform, /ProseMaker v5\.1\.0 · RPG Your Way/)
assert.match(transform, /api\.openai\.com\/v1\/responses/)
assert.match(transform, /Idempotency-Key/)
assert.match(transform, /provisionalProseTail/)
assert.match(transform, /replaceProvisionalProseTail/)
assert.match(transform, /status: 'error'/)
assert.match(transform, /input_tokens/)
assert.match(transform, /output_tokens/)

const migration = read('supabase/migrations/20260824163000_shape_jobs.sql')
assert.match(migration, /create table if not exists public\.shape_jobs/)
assert.match(migration, /enable row level security/)
assert.match(migration, /auth\.uid\(\) = user_id/)

const authPrompt = read('components/AuthPrompt.tsx')
assert.match(authPrompt, /rpgyw:open-auth/)

const env = read('.env.example')
assert.match(env, /OPENAI_API_KEY=/)
assert.match(env, /OPENAI_SHAPE_MODEL=/)
assert.match(env, /RPGYW_SHAPE_BETA_EMAILS=/)

const css = read('app/globals.css')
assert.match(css, /\.shape-workbench/)
assert.match(css, /\.shape-result/)
assert.match(css, /\.nested-accordion-copy/)
assert.match(css, /url\('\/rpgyw-map-tan\.png'\)/)

const footer = read('components/SiteFooter.tsx')
assert.match(footer, /© 2026 dodo ink\. Independent creative projects\./)
assert.match(footer, /APP_VERSION/)

console.log('RPG Your Way 1.5.300 Shape foundation and landing accordions passed validation.')
