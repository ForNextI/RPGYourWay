import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as { name?: string; version?: string; rpgywVersion?: string; dependencies?: Record<string,string> }
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.7.5')
assert.equal(pkg.rpgywVersion, '1.7.5')
assert.match(read('lib/version.ts'), /APP_VERSION = '1\.7\.5'/)

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
  'supabase/migrations/20260825120000_play_provider_usage.sql',
  'app/api/play/access/route.ts',
  'app/api/aigm/gameplay-chat/route.ts',
  'app/api/aigm/speech/route.ts',
  'app/api/aigm/transcribe/route.ts',
  'components/aigm/rpgyw-start-entry.tsx',
  'components/aigm/aigm-gameplay-shell.tsx',
  'lib/aigm/campaign-storage.ts',
  'lib/aigm/campaign-persistence.ts',
  'lib/aigm/character-display-rules.ts',
  'lib/usage/owner-qa.ts',
  'lib/usage/play-cost.ts',
  'lib/usage/server-billing.ts',
  'postcss.config.mjs',
  'data/settings/eberron.json',
  'data/rules/corpora/dnd-5.5e-srd-5.2.1.json',
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
assert.match(read('app/start/page.tsx'), /<RpgywStartEntry \/>/)

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


const playPage = read('app/play/page.tsx')
assert.match(playPage, /<AigmGameplayShell \/>/)
assert.match(playPage, /MotionPreferenceProvider/)
assert.match(playPage, /<MotionPreferenceProvider>/)
assert.match(playPage, /redirect\('\/start'\)/)
assert.doesNotMatch(playPage, /Import Existing Adventure|RpgywPlayEntry/)

const startPage = read('app/start/page.tsx')
assert.match(startPage, /<RpgywStartEntry \/>/)
assert.match(startPage, /Existing WardensPC adventures can be imported here/)
const startEntry = read('components/aigm/rpgyw-start-entry.tsx')
assert.match(startEntry, /Import Existing Adventure/)
assert.match(startEntry, /parseAdventureState/)
assert.match(startEntry, /imported\.stage !== 'complete'/)
assert.match(startEntry, /window\.location\.assign\('\/play'\)/)
assert.match(startEntry, /There is no cloud campaign synchronization/)
assert.doesNotMatch(startEntry, /setPlaying|AigmGameplayShell/)
const gameplayShell = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(gameplayShell, /Go to Start/)
assert.match(gameplayShell, /href="\/start"/)

const campaignPersistence = read('lib/aigm/campaign-persistence.ts')
assert.match(campaignPersistence, /rpgyw-aigm-campaigns/)
assert.doesNotMatch(campaignPersistence, /wardenspc-aigm-campaigns/)

const ownerQa = read('lib/usage/owner-qa.ts')
assert.match(ownerQa, /OWNER_QA_EMAIL = 'brett@rpgyourway\.com'/)
assert.doesNotMatch(ownerQa, /@.*@/)

const gameplay = read('app/api/aigm/gameplay-chat/route.ts')
assert.match(gameplay, /requireUsageAccount/)
assert.match(gameplay, /reserveUsage/)
assert.match(gameplay, /settleUsage/)
assert.match(gameplay, /terraProviderCostMicrousd/)
assert.match(gameplay, /usage_billing/)
assert.match(gameplay, /x-rpgyw-operation-id/)

const billing = read('lib/usage/server-billing.ts')
assert.match(billing, /rpgyw_reserve_usage/)
assert.match(billing, /rpgyw_capture_usage/)
assert.match(billing, /roundUsageMicrousdToCent/)
assert.match(billing, /ownerQa/)
assert.match(billing, /provider_usage_events/)

const playAccess = read('app/api/play/access/route.ts')
assert.match(playAccess, /voice_available: account\.ownerQa/)
const speech = read('app/api/aigm/speech/route.ts')
const transcribe = read('app/api/aigm/transcribe/route.ts')
assert.match(speech, /if \(!account\.ownerQa\)/)
assert.match(transcribe, /if \(!account\.ownerQa\)/)

const shapeJobs = read('app/api/shape/jobs/route.ts')
assert.match(shapeJobs, /isOwnerQaEmail/)
assert.match(shapeJobs, /if \(!auth\.ownerQa\)/)
const shapeSettlement = read('lib/shape/settlement.ts')
assert.match(shapeSettlement, /ownerQa/)
assert.match(shapeSettlement, /billed_microusd: 0/)

const playMigration = read('supabase/migrations/20260825120000_play_provider_usage.sql')
assert.match(playMigration, /provider_usage_events/)
assert.match(playMigration, /owner_qa_exempt/)
assert.match(playMigration, /no browser read\/write policies/i)

assert.equal(pkg.dependencies?.['@vercel/analytics'], '^1.5.0')
assert.equal(pkg.dependencies?.['lucide-react'], '^1.16.0')
const devDependencies = (pkg as { devDependencies?: Record<string,string> }).devDependencies || {}
assert.equal(devDependencies['tailwindcss'], '^4.3.3')
assert.equal(devDependencies['@tailwindcss/postcss'], '^4.3.3')
assert.match(read('postcss.config.mjs'), /@tailwindcss\/postcss/)

const env = read('.env.example')
assert.match(env, /OPENAI_API_KEY=/)
assert.match(env, /STRIPE_SECRET_KEY=/)
assert.match(env, /STRIPE_WEBHOOK_SECRET=/)
assert.match(env, /SUPABASE_SERVICE_ROLE_KEY=/)
assert.doesNotMatch(env, /RPGYW_SHAPE_BETA_EMAILS/)

for (const productionFile of ['lib/stripe/checkout.ts', 'lib/shape/billing.ts', 'lib/shape/settlement.ts']) {
  assert.doesNotMatch(read(productionFile), /from ['"][^'"]+\.ts['"]/, `${productionFile} must not import .ts extensions.`)
}


const playAccess175 = read('app/api/play/access/route.ts')
assert.match(playAccess175, /voice_available:\s*true/)
assert.doesNotMatch(playAccess175, /voice_available:\s*account\.ownerQa/)
for (const voiceRoute175 of ['app/api/aigm/speech/route.ts', 'app/api/aigm/transcribe/route.ts']) {
  const source175 = read(voiceRoute175)
  assert.match(source175, /await requireUsageAccount\(\)/)
  assert.doesNotMatch(source175, /if \(!account\.ownerQa\)/)
  assert.doesNotMatch(source175, /being readied for prepaid Play billing/)
}
const gameplay175 = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(gameplay175, /aigm-character-reorder/)
assert.match(gameplay175, /Character record/)
assert.doesNotMatch(gameplay175, /Complete character record/)
assert.match(gameplay175, /character-sheet-dialog/)
assert.match(gameplay175, /character-sheet-actions/)
assert.match(gameplay175, /aigm-gameplay-send/)
const voiceControls175 = read('components/aigm/aigm-voice-controls.tsx')
assert.match(voiceControls175, /aigm-voice-controls/)
const css175 = read('app/globals.css')
assert.match(css175, /RPG Your Way 1\.7\.5 Play UI and voice cleanup/)
assert.match(css175, /grid-template-columns:\s*minmax\(230px, \.64fr\)/)
assert.match(css175, /\.aigm-character-reorder/)
assert.match(css175, /\.character-sheet-dialog/)

console.log('RPG Your Way 1.7.5 Play UI and voice cleanup checks passed.')
