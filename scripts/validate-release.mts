import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))
const has = (source: string, phrase: string, label = phrase) => assert.ok(source.includes(phrase), `Missing ${label}`)
const lacks = (source: string, phrase: string, label = phrase) => assert.ok(!source.includes(phrase), `Retired ${label} is still present`)
const before = (source: string, first: string, second: string, label: string) => {
  const a = source.indexOf(first)
  const b = source.indexOf(second)
  assert.ok(a >= 0 && b >= 0 && a < b, `${label}: expected ${first} before ${second}`)
}

const pkg = JSON.parse(read('package.json')) as {
  name?: string
  version?: string
  rpgywVersion?: string
  dependencies?: Record<string, string>
}
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.12.1')
assert.equal(pkg.rpgywVersion, '1.12.1')
has(read('lib/version.ts'), "APP_VERSION = '1.12.1'", 'visible app version')

for (const file of [
  'app/page.tsx',
  'app/globals.css',
  'app/layout.tsx',
  'app/robots.ts',
  'app/start/page.tsx',
  'app/play/page.tsx',
  'app/script/page.tsx',
  'app/account/page.tsx',
  'app/support/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'components/start/StartOnboarding.tsx',
  'components/aigm/rpgyw-start-entry.tsx',
  'components/aigm/aigm-gameplay-shell.tsx',
  'components/multiplayer/TableChatPanel.tsx',
  'components/multiplayer/MultiplayerPanelSwitcher.tsx',
  'lib/aigm/campaign-storage.ts',
  'lib/aigm/campaign-persistence.ts',
  'lib/aigm/cloud-campaigns.ts',
  'lib/cloud-campaigns/server.ts',
  'lib/multiplayer/server.ts',
  'lib/usage/server-billing.ts',
  'lib/usage/play-turn-billing.ts',
  'lib/usage/play-cost.ts',
  'lib/usage/audio-cost.ts',
  'lib/shape/settlement.ts',
  'lib/shape/billing.ts',
  'app/api/aigm/gameplay-chat/route.ts',
  'app/api/aigm/character-intake/route.ts',
  'app/api/aigm/character-clarify/route.ts',
  'app/api/start/help/route.ts',
  'app/api/shape/jobs/route.ts',
  'app/api/shape/transform/route.ts',
  'app/api/stripe/webhook/route.ts',
  'app/api/multiplayer/sessions/route.ts',
  'app/api/multiplayer/ably-token/route.ts',
  'supabase/migrations/20260825003000_shared_usage_balance.sql',
  'supabase/migrations/20260825060000_script_commercial_billing.sql',
  'supabase/migrations/20260825120000_play_provider_usage.sql',
  'supabase/migrations/20260828002500_play_turn_voice_billing.sql',
  'supabase/migrations/20260828043000_native_multiplayer_phase1.sql',
  'supabase/migrations/20260828073000_multiplayer_names_multi_character.sql',
  'supabase/migrations/20260828163000_cloud_campaigns.sql',
  'scripts/validate-accessibility.mts',
  'scripts/test-shape-runtime.mts',
  'scripts/test-usage-money.mts',
  'scripts/test-provider-cost.mts',
  'scripts/test-stripe-funding.mts',
  'scripts/test-audio-cost.mts',
  'scripts/test-multiplayer-phase1.mts',
]) assert.ok(exists(file), `Missing ${file}`)

// Dead private-beta access code is deliberately gone.
assert.equal(exists('lib/shape/access.ts'), false, 'Dead Script beta-access helper should stay deleted')

// Environment names describe this product, and the model overrides used by the code are documented.
const env = read('.env.example')
has(env, 'OPENAI_MODEL=gpt-5.6-terra')
has(env, 'OPENAI_GAMEPLAY_MODEL=gpt-5.6-terra')
has(env, 'OPENAI_SHAPE_MODEL=gpt-5.6-terra')
has(env, 'RPGYW_GOD_MODE_PHRASE=')
lacks(env, 'WARDENS_GOD_MODE_PHRASE')
const gameplayRoute = read('app/api/aigm/gameplay-chat/route.ts')
has(gameplayRoute, 'process.env.RPGYW_GOD_MODE_PHRASE')
lacks(gameplayRoute, 'process.env.WARDENS_GOD_MODE_PHRASE')

// Public site is crawlable; API and auth machinery are not crawl targets.
const robots = read('app/robots.ts')
has(robots, "allow: '/'")
has(robots, "disallow: ['/api/', '/auth/']")
lacks(robots, "disallow: '/'")

// Landing page keeps the two purpose accordions, but their wrapper is not a second raised plaque.
const home = read('app/page.tsx')
has(home, 'Why I created RPG Your Way.')
has(home, 'Who benefits from this site?')
has(home, 'Multiplayer testing is underway, with chat.')
lacks(home, 'Multiplayer is now live, with chat.')
const css = read('app/globals.css')
has(css, '.landing-accordion {\n  overflow: visible;\n  border: 0;')
has(css, '.landing-accordion-body { margin-top: .65rem;')
has(css, '  .landing-accordion-body,\n  .feature-card,', 'accordion body in shared raised-plaque system')
lacks(css, 'button.start-choice[aria-pressed="true"]', 'one-off Start campaign-mode CSS patch')
has(css, 'body .start-choice.start-choice--selected {')
has(css, 'background-image: none !important;', 'persistent selected face reset')

// Start uses one explicit persistent selected class for ruleset and solo/multiplayer choices.
const start = read('components/start/StartOnboarding.tsx')
has(start, "campaignMode === 'solo' ? ' start-choice--selected' : ''")
has(start, "campaignMode === 'multiplayer' ? ' start-choice--selected' : ''")
has(start, "ruleset === option.id ? ' start-choice--selected' : ''")

// Included/free AI work still requires an account and is measured for true provider cost.
const billing = read('lib/usage/server-billing.ts')
has(billing, 'export async function recordIncludedProviderUsage(')
has(billing, "included_usage: true")
has(billing, "onConflict: 'user_id,surface,feature,operation_id'")

const intake = read('app/api/aigm/character-intake/route.ts')
const intakePost = intake.slice(intake.indexOf('export async function POST'))
before(intakePost, 'account = await requireUsageAccount()', "fetch('https://api.openai.com/v1/responses'", 'Character Intake authentication gate')
has(intake, "feature: 'character_import_included'")
has(intake, 'verification_provider_cost_microusd')
has(intake, 'terraProviderCostMicrousd(payload.usage) + verificationCostMicrousd')

const clarify = read('app/api/aigm/character-clarify/route.ts')
const clarifyPost = clarify.slice(clarify.indexOf('export async function POST'))
before(clarifyPost, 'account = await requireUsageAccount()', "fetch('https://api.openai.com/v1/responses'", 'Character Clarify authentication gate')
has(clarify, "feature: 'character_import_clarification_included'")

const startHelp = read('app/api/start/help/route.ts')
before(startHelp, 'account = await requireUsageAccount()', "fetch('https://api.openai.com/v1/responses'", 'Start Page Help authentication gate')
has(startHelp, "feature: 'start_page_help_included'")
has(startHelp, 'terraProviderCostMicrousd(payload.usage)')

// Account and transition copy reflect the current cloud architecture.
const account = read('app/account/page.tsx')
has(account, 'Your account keeps purchases, usage, and cloud campaigns together.')
lacks(account, 'Play campaigns stay in this browser unless you export them.')
const startEntry = read('components/aigm/rpgyw-start-entry.tsx')
has(startEntry, 'RPG Your Way can import WardensPC exports that had already reached Play')
lacks(startEntry, 'wait for the rebuilt RPG Your Way onboarding flow')
const gameplayShell = read('components/aigm/aigm-gameplay-shell.tsx')
lacks(gameplayShell, '/#wardens-latest-update')

// Support/legal pages must not describe already-live systems as future work.
const support = read('app/support/page.tsx')
has(support, 'mailto:brett@rpgyourway.com')
lacks(support, 'before live payments are enabled')
const privacy = read('app/legal/privacy/page.tsx')
lacks(privacy, 'build placeholder')
lacks(privacy, 'are now being wired')
const terms = read('app/legal/terms/page.tsx')
lacks(terms, 'build placeholder')
lacks(terms, 'before paid access is switched on')

// Cloud campaign state remains canonical, with revision conflict protection and account membership.
const cloudMigration = read('supabase/migrations/20260828163000_cloud_campaigns.sql')
has(cloudMigration, 'create table if not exists public.campaigns')
has(cloudMigration, 'create table if not exists public.campaign_members')
has(cloudMigration, 'revision bigint not null default 1')
const cloudServer = read('lib/cloud-campaigns/server.ts')
has(cloudServer, 'revision_conflict')
has(cloudServer, 'campaign_members')
const cloudClient = read('lib/aigm/cloud-campaigns.ts')
has(cloudClient, 'expected_revision')
const persistence = read('lib/aigm/campaign-persistence.ts')
has(persistence, 'loadCloudCampaignState')
has(persistence, 'saveCloudCampaignState')

// Billing remains server-authoritative and separates provider cost from customer billing.
has(billing, 'rpgyw_reserve_usage')
has(billing, 'rpgyw_capture_usage')
has(billing, "surface: 'play'")
const providerMigration = read('supabase/migrations/20260825120000_play_provider_usage.sql')
has(providerMigration, 'provider_usage_events')
has(providerMigration, 'unique (user_id, surface, feature, operation_id)')
const playTurnBilling = read('lib/usage/play-turn-billing.ts')
has(playTurnBilling, 'providerTotal')
has(playTurnBilling, 'ttt_provider_microusd')
has(playTurnBilling, 'gameplay_provider_microusd')
has(playTurnBilling, 'tts_provider_microusd')

// Script and Stripe remain on the shared prepaid balance.
const scriptPage = read('app/script/page.tsx')
has(scriptPage, 'same prepaid RPG Your Way usage balance as Play')
const shapeJobs = read('app/api/shape/jobs/route.ts')
has(shapeJobs, 'rpgyw_reserve_usage')
has(shapeJobs, 'settleShapeJobUsage')
lacks(shapeJobs, 'shapeEmailAllowed')
const shapeTransform = read('app/api/shape/transform/route.ts')
has(shapeTransform, 'settleCompletedJob')
lacks(shapeTransform, 'shapeEmailAllowed')
const stripe = read('lib/stripe/server.ts')
has(stripe, 'processingSurplusCents')
has(stripe, 'stripe-surplus')

// Multiplayer remains room-scoped through Ably and uses a separate human Table Chat transcript.
const multiplayer = read('lib/multiplayer/server.ts')
has(multiplayer, 'MAX_MULTIPLAYER_PLAYERS')
has(multiplayer, 'campaign_fingerprint')
const tableChat = read('components/multiplayer/TableChatPanel.tsx')
has(tableChat, 'Table Chat')
has(tableChat, 'not sent to the AIGM')
const storage = read('lib/aigm/campaign-storage.ts')
has(storage, 'Multiplayer table chat is separate')

// Accessibility foundation stays wired and the old exact-format CSS trap stays retired.
const accessibility = read('app/accessibility/page.tsx')
has(accessibility, 'Accessibility')
has(css, 'outline: 3px solid var(--lime);')
assert.match(css, /background:\s*linear-gradient\(\s*180deg,\s*color-mix\(in srgb, var\(--cream-bright\) 97%, white\),\s*var\(--cream\)\s*\) !important;/)

console.log('RPG Your Way 1.12.1 deliberate cleanup pass 1 checks passed.')
