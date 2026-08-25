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
assert.equal(pkg.version, '1.5.500')
assert.equal(pkg.rpgywVersion, '1.5.500')
assert.equal(pkg.dependencies?.next, '16.2.6')
assert.equal(pkg.dependencies?.['@supabase/ssr'], '^0.12.4')
assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '^2.112.3')

for (const file of [
  'app/page.tsx',
  'app/play/page.tsx',
  'app/shape/page.tsx',
  'app/api/shape/jobs/route.ts',
  'app/api/shape/transform/route.ts',
  'app/api/shape/projects/route.ts',
  'app/api/shape/usage/route.ts',
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
  'lib/shape/config.ts',
  'lib/shape/transcript.ts',
  'lib/usage/money.ts',
  'app/api/usage/balance/route.ts',
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
  'lib/supabase/proxy.ts',
  'supabase/migrations/20260824163000_shape_jobs.sql',
  'supabase/migrations/20260824194500_shape_beta_instrumentation.sql',
  'supabase/migrations/20260825003000_shared_usage_balance.sql',
  'scripts/test-shape-runtime.mts',
  'scripts/test-usage-money.mts',
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
assert.match(shapePage, /How Shape uses your RPG Your Way balance/)
assert.match(shapePage, /maximum estimated balance deduction/)
assert.match(shapePage, /no payment is collected during these tests/)

const jobs = read('app/api/shape/jobs/route.ts')
assert.match(jobs, /shape_jobs/)
assert.match(jobs, /buildShapeAnalysisChunks/)
assert.match(jobs, /buildShapeTranscriptChunks/)
assert.match(jobs, /RPGYW_SHAPE_BETA_EMAILS|shapeEmailAllowed/)
assert.match(jobs, /shape_projects/)
assert.match(jobs, /confirm_duplicate/)
assert.match(jobs, /cached_input_tokens/)
assert.match(jobs, /partial_result_text/)
assert.match(jobs, /prose_text/)
assert.match(jobs, /\['processing', 'error', 'completed'\]/)

const transform = read('app/api/shape/transform/route.ts')
assert.match(transform, /SHAPE_PROMPT_VERSION/)
const shapeConfig = read('lib/shape/config.ts')
assert.match(shapeConfig, /ProseMaker v5\.1\.0 · RPG Your Way/)
assert.match(transform, /api\.openai\.com\/v1\/responses/)
assert.match(transform, /Idempotency-Key/)
assert.match(transform, /provisionalProseTail/)
assert.match(transform, /reconcileShapeWritingSection/)
assert.match(read('lib/shape/transcript.ts'), /replaceProvisionalProseTail/)
assert.match(transform, /status: 'error'/)
assert.match(transform, /writing-repair:/)
assert.match(transform, /writing-recovery:/)
assert.match(transform, /usageTotalsFromLedger/)
assert.match(transform, /diagnostic: message/)
assert.match(transform, /serializeJob\(failedJob, false, true\)/)
assert.match(transform, /input_tokens/)
assert.match(transform, /output_tokens/)
assert.match(transform, /shape_usage_events/)
assert.match(transform, /cached_input_tokens/)
assert.match(transform, /PRIOR PROJECT CONTINUITY/)
assert.match(transform, /providerRequestId/)
const usageRoute = read('app/api/shape/usage/route.ts')
assert.doesNotMatch(usageRoute, /transcript,result_text|result_text,transcript/)
assert.match(usageRoute, /No transcript or finished prose is included/)

const migration = read('supabase/migrations/20260824163000_shape_jobs.sql')
assert.match(migration, /create table if not exists public\.shape_jobs/)
assert.match(migration, /enable row level security/)
assert.match(migration, /auth\.uid\(\) = user_id/)

const instrumentation = read('supabase/migrations/20260824194500_shape_beta_instrumentation.sql')
assert.match(instrumentation, /create table if not exists public\.shape_projects/)
assert.match(instrumentation, /create table if not exists public\.shape_usage_events/)
assert.match(instrumentation, /cached_input_tokens/)
assert.match(instrumentation, /unique \(job_id, operation\)/)

const authPrompt = read('components/AuthPrompt.tsx')
assert.match(authPrompt, /rpgyw:open-auth/)

const env = read('.env.example')
assert.match(env, /OPENAI_API_KEY=/)
assert.match(env, /OPENAI_SHAPE_MODEL=/)
assert.match(env, /RPGYW_SHAPE_BETA_EMAILS=/)

const css = read('app/globals.css')
assert.match(css, /\.shape-workbench/)
assert.match(css, /\.shape-result/)
assert.match(css, /\.shape-steps/)
assert.match(css, /\.shape-usage-grid/)
assert.match(css, /\.shape-diagnostic/)
assert.match(css, /\.nested-accordion-copy/)
assert.match(css, /url\('\/rpgyw-map-tan\.png'\)/)


const shapeWorkspace = read('components/ShapeWorkspace.tsx')
assert.match(shapeWorkspace, /Download work so far/)
assert.match(shapeWorkspace, /INCOMPLETE SHAPE RESULT/)
assert.match(shapeWorkspace, /Private-test diagnostic/)
assert.match(shapeWorkspace, /visibleError/)
assert.doesNotMatch(shapeWorkspace, /job\.error_message && job\.status === 'error'.*error \?/s)

const balanceMigration = read('supabase/migrations/20260825003000_shared_usage_balance.sql')
assert.match(balanceMigration, /create table if not exists public\.usage_wallets/)
assert.match(balanceMigration, /create table if not exists public\.usage_ledger/)
assert.match(balanceMigration, /create table if not exists public\.usage_holds/)
assert.match(balanceMigration, /rpgyw_release_expired_usage/)
assert.match(balanceMigration, /rpgyw_reserve_usage/)
assert.match(balanceMigration, /rpgyw_capture_usage/)
assert.match(balanceMigration, /rpgyw_credit_usage/)
assert.match(balanceMigration, /service_role/)
assert.match(balanceMigration, /usage_wallets_select_own/)

const account = read('app/account/page.tsx')
assert.match(account, /Shared usage balance/)
assert.match(account, /Play and Shape use the same balance/)
assert.match(account, /usage_ledger/)
assert.match(account, /formatUsageDollars/)

const balanceRoute = read('app/api/usage/balance/route.ts')
assert.match(balanceRoute, /usage_wallets/)
assert.match(balanceRoute, /available_microusd/)
assert.match(balanceRoute, /Cache-Control/)

const money = read('lib/usage/money.ts')
assert.match(money, /MICRO_USD_PER_DOLLAR = 1_000_000/)
assert.match(money, /formatUsageDollars/)

const pricing = read('app/pricing/page.tsx')
assert.match(pricing, /One balance\. Play or Shape\./)
assert.match(pricing, /same RPG Your Way usage balance/)

assert.match(shapePage, /same prepaid RPG Your Way usage balance as Play/)
assert.match(shapePage, /maximum estimated balance deduction/)
assert.doesNotMatch(shapePage, /Shape will be priced separately from Play Packs/)

const footer = read('components/SiteFooter.tsx')
assert.match(footer, /© 2026 dodo ink\. Independent creative projects\./)
assert.match(footer, /APP_VERSION/)

console.log('RPG Your Way 1.5.500 Shape recovery, shared usage balance, and account foundation passed validation.')
