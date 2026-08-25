import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as { name?: string; version?: string; rpgywVersion?: string; dependencies?: Record<string,string> }
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.6.2')
assert.equal(pkg.rpgywVersion, '1.6.202')
assert.match(read('lib/version.ts'), /APP_VERSION = '1\.6\.202'/)

for (const file of [
  'app/page.tsx', 'app/play/page.tsx', 'app/start/page.tsx', 'app/script/page.tsx', 'app/shape/page.tsx',
  'app/account/page.tsx', 'app/pricing/page.tsx', 'app/pricing/actions.ts',
  'app/api/shape/jobs/route.ts', 'app/api/shape/quote/route.ts', 'app/api/shape/transform/route.ts',
  'app/api/shape/projects/route.ts', 'app/api/shape/usage/route.ts', 'app/api/stripe/webhook/route.ts',
  'components/SiteHeader.tsx', 'components/SiteFooter.tsx', 'components/ShapeWorkspace.tsx',
  'lib/billing/play-packs.ts', 'lib/shape/billing.ts', 'lib/shape/settlement.ts', 'lib/shape/transcript.ts',
  'lib/stripe/server.ts', 'lib/stripe/checkout.ts', 'lib/usage/money.ts', 'lib/usage/openai-cost.ts',
  'supabase/migrations/20260825003000_shared_usage_balance.sql',
  'supabase/migrations/20260825060000_script_commercial_billing.sql',
]) assert.ok(exists(file), `Missing ${file}`)

const account = read('app/account/page.tsx')
for (const phrase of [
  'Sign in or create an account', 'Usage balance', 'Available for Play and Script', 'Add usage',
  'Purchase price includes payment processing and site operating costs', '2.9% + 30¢',
  'A Note on Usage', 'Usage can vary quite a bit from one session to another.',
  'There aren&apos;t extra charges hidden inside the heavier session.',
]) assert.match(account, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
assert.doesNotMatch(account, /Lifetime added|Lifetime used|No separate Script wallet/)

const packs = read('lib/billing/play-packs.ts')
for (const amount of ['priceCents: 600', 'priceCents: 1_690', 'priceCents: 3_340', 'priceCents: 4_990', 'priceCents: 7_200', 'priceCents: 9_950']) assert.match(packs, new RegExp(amount))
for (const usage of ['usageCents: 500', 'usageCents: 1_500', 'usageCents: 3_000', 'usageCents: 4_500', 'usageCents: 6_500', 'usageCents: 9_000']) assert.match(packs, new RegExp(usage))

const layout = read('app/layout.tsx')
assert.match(layout, /@vercel\/analytics\/next/)
assert.match(layout, /<Analytics \/>/)

const header = read('components/SiteHeader.tsx')
assert.match(header, /href: '\/account', label: 'Account'/)
assert.match(header, /thereadingofthewardens\.com/)
assert.match(header, /target="_blank"/)
assert.match(header, /fullscreen-nav-gap/)
const css = read('app/globals.css')
assert.match(css, /header-inner \{ min-height: 52px/)
assert.match(css, /usage-disclosure-row/)
assert.match(css, /kofi-support-button/)
assert.match(css, /shape-quote/)

const footer = read('components/SiteFooter.tsx')
assert.match(footer, /Buy Brett a Coffee/)
assert.match(footer, /ko-fi\.com\/dodoink/)
assert.match(footer, /fill="#FF5E5B"/)
assert.match(footer, /kofi-cup/)

const home = read('app/page.tsx')
assert.match(home, /href="\/start">New Player<\/Link>/)
assert.match(home, /href="\/play">Continue playing<\/Link>/)
assert.match(read('app/start/page.tsx'), /permanent front door to RPG Your Way onboarding/)

const pricing = read('app/pricing/page.tsx')
assert.match(pricing, /permanentRedirect\('\/account#add-usage'\)/)

const scriptPage = read('app/script/page.tsx')
assert.match(scriptPage, /same prepaid RPG Your Way usage balance as Play/)
assert.match(scriptPage, /maximum estimated balance deduction/)
assert.doesNotMatch(scriptPage, /private test|no payment is collected/i)

const workspace = read('components/ShapeWorkspace.tsx')
assert.match(workspace, /See maximum usage/)
assert.match(workspace, /Begin Script · max/)
assert.match(workspace, /Maximum estimated deduction/)
assert.match(workspace, /Progress advances only when a real Script step finishes/)
assert.match(workspace, /role="progressbar"/)
assert.match(workspace, /setQuoteMicrousd\(null\)/)
assert.match(workspace, /Add usage in Account/)
assert.doesNotMatch(workspace, /Begin private Script test|Script opens soon|Preview only/)

const jobs = read('app/api/shape/jobs/route.ts')
assert.match(jobs, /estimateShapeMaximumMicrousd/)
assert.match(jobs, /rpgyw_reserve_usage/)
assert.match(jobs, /maximum_deduction_microusd/)
assert.match(jobs, /settleShapeJobUsage/)
assert.doesNotMatch(jobs, /shapeEmailAllowed|private test list/)

const transform = read('app/api/shape/transform/route.ts')
assert.match(transform, /cache_write_tokens/)
assert.match(transform, /settleCompletedJob/)
assert.match(transform, /section_disposition/)
assert.match(transform, /no_new_prose/)
assert.doesNotMatch(transform, /diagnostic:\s*message/)
assert.doesNotMatch(transform, /shapeEmailAllowed|private test list/)

const settlement = read('lib/shape/settlement.ts')
assert.match(settlement, /roundUsageMicrousdToCent\(providerCostMicrousd\)/)
assert.match(settlement, /Math\.min\(roundedProviderCostMicrousd, maximumMicrousd\)/)
assert.match(settlement, /rpgyw_capture_usage/)
assert.match(settlement, /cache_write_tokens/)

const stripe = read('lib/stripe/server.ts')
assert.match(stripe, /latest_charge\.balance_transaction/)
assert.match(stripe, /processingSurplusCents/)
assert.match(stripe, /stripe-surplus/)
assert.match(stripe, /account\?status=checkout-cancelled#add-usage/)

const migration = read('supabase/migrations/20260825060000_script_commercial_billing.sql')
assert.match(migration, /cache_write_tokens/)
assert.match(migration, /usage_hold_id/)
assert.match(migration, /maximum_deduction_microusd/)
assert.match(migration, /provider_cost_microusd/)
assert.match(migration, /billed_microusd/)

const env = read('.env.example')
assert.match(env, /OPENAI_API_KEY=/)
assert.match(env, /STRIPE_SECRET_KEY=/)
assert.match(env, /STRIPE_WEBHOOK_SECRET=/)
assert.match(env, /SUPABASE_SERVICE_ROLE_KEY=/)
assert.doesNotMatch(env, /RPGYW_SHAPE_BETA_EMAILS/)

for (const productionFile of ['lib/stripe/checkout.ts', 'lib/shape/billing.ts', 'lib/shape/settlement.ts']) {
  assert.doesNotMatch(read(productionFile), /from ['"][^'"]+\.ts['"]/, `${productionFile} must not import .ts extensions.`)
}

console.log('RPG Your Way 1.6.202 cent settlement, truthful progress, Start route, and analytics checks passed.')
