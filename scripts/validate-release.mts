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
assert.equal(pkg.version, '1.12.76')
assert.equal(pkg.rpgywVersion, '1.12.76')
has(read('lib/version.ts'), "APP_VERSION = '1.12.76'", 'visible app version')

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
  'components/start/CampaignHub.tsx',
  'components/aigm/rpgyw-start-entry.tsx',
  'components/aigm/aigm-gameplay-shell.tsx',
  'components/multiplayer/TableChatPanel.tsx',
  'components/multiplayer/MultiplayerPanelSwitcher.tsx',
  'lib/aigm/campaign-storage.ts',
  'lib/aigm/campaign-persistence.ts',
  'lib/aigm/cloud-campaigns.ts',
  'lib/aigm/campaign-governance.ts',
  'lib/cloud-campaigns/server.ts',
  'lib/cloud-campaigns/governance.ts',
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
  'app/api/campaigns/[campaignId]/governance/route.ts',
  'app/api/multiplayer/sessions/[inviteCode]/heartbeat/route.ts',
  'app/api/multiplayer/sessions/[inviteCode]/turns/[turnId]/route.ts',
  'lib/multiplayer/charge-allocation.ts',
  'lib/multiplayer/turn-billing.ts',
  'supabase/migrations/20260825003000_shared_usage_balance.sql',
  'supabase/migrations/20260825060000_script_commercial_billing.sql',
  'supabase/migrations/20260825120000_play_provider_usage.sql',
  'supabase/migrations/20260828002500_play_turn_voice_billing.sql',
  'supabase/migrations/20260828043000_native_multiplayer_phase1.sql',
  'supabase/migrations/20260828073000_multiplayer_names_multi_character.sql',
  'supabase/migrations/20260828163000_cloud_campaigns.sql',
  'supabase/migrations/20260829000000_campaign_governance.sql',
  'supabase/migrations/20260829023000_multiplayer_public_turns.sql',
  'scripts/validate-accessibility.mts',
  'scripts/test-shape-runtime.mts',
  'scripts/test-usage-money.mts',
  'scripts/test-provider-cost.mts',
  'scripts/test-stripe-funding.mts',
  'scripts/test-audio-cost.mts',
  'scripts/test-multiplayer-phase1.mts',
  'scripts/test-11274-multiplayer-turns.mts',
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
has(home, 'Multiplayer is live, with built-in table chat.')
lacks(home, 'Multiplayer testing is underway, with chat.')
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
has(start, 'Shared Control')
has(start, 'Coordinator Control')
has(start, "multiplayer_administration: campaignMode === 'multiplayer' ? multiplayerAdministration : undefined")

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
const campaignHub = read('components/start/CampaignHub.tsx')
has(startEntry, '<CampaignHub />', 'campaign hub above onboarding')
before(startEntry, '<CampaignHub />', '<StartOnboarding', 'Campaign hub position')
has(campaignHub, 'Existing Campaigns, Controls &amp; Imports')
has(campaignHub, 'RPG Your Way can import WardensPC exports that had already reached Play')
has(campaignHub, 'Your Campaigns')
lacks(campaignHub, 'Campaign controls', 'redundant campaign-controls accordion')
has(campaignHub, 'Continue Adventure')
has(campaignHub, 'Pending decisions')
lacks(campaignHub, 'wait for the rebuilt RPG Your Way onboarding flow')
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

// Multiplayer chat stays lightweight; durable membership and destructive actions live with the cloud campaign.
const multiplayer = read('lib/multiplayer/server.ts')
has(multiplayer, 'MAX_MULTIPLAYER_PLAYERS')
has(multiplayer, 'campaign_fingerprint')
has(multiplayer, 'campaign_id: localCampaignId')
has(multiplayer, "from('campaign_members').upsert")
has(multiplayer, 'beginMultiplayerTurn')
has(multiplayer, 'completeMultiplayerTurn')
has(multiplayer, 'heartbeatMultiplayerSession')
lacks(multiplayer, 'private table testing')
const tableChat = read('components/multiplayer/TableChatPanel.tsx')
has(tableChat, 'Table Chat')
has(tableChat, 'not sent to the AIGM')
lacks(tableChat, 'Leave multiplayer table')
lacks(tableChat, 'Close multiplayer session')
const governanceMigration = read('supabase/migrations/20260829000000_campaign_governance.sql')
has(governanceMigration, 'campaign_governance_proposals')
has(governanceMigration, 'campaign_governance_votes')
has(governanceMigration, "administration_mode in ('solo', 'shared', 'coordinator')")
const governanceServer = read('lib/cloud-campaigns/governance.ts')
has(governanceServer, "proposal_type === 'remove_member'")
has(governanceServer, "proposal_type === 'delete_campaign'")
has(governanceServer, 'eligible.every')
has(governanceServer, 'RECOVERY_WINDOW_MS')
const storage = read('lib/aigm/campaign-storage.ts')
has(storage, 'Multiplayer table chat is separate')
has(storage, "export type MultiplayerAdministrationMode = 'shared' | 'coordinator'")

// Public multiplayer serializes one canonical cloud turn and splits the rounded whole-turn cost.
const multiplayerTurnMigration = read('supabase/migrations/20260829023000_multiplayer_public_turns.sql')
has(multiplayerTurnMigration, 'multiplayer_turns_one_live_per_campaign_idx')
has(multiplayerTurnMigration, 'multiplayer_sessions_one_open_per_campaign_idx')
has(multiplayerTurnMigration, 'rpgyw_begin_multiplayer_turn')
has(multiplayerTurnMigration, 'rpgyw_capture_multiplayer_turn')
has(multiplayerTurnMigration, 'Multiplayer payer roster changed before settlement')
has(multiplayerTurnMigration, 'A shared turn is never')
has(multiplayerTurnMigration, 'multiplayer_turn_charges')
has(multiplayerTurnMigration, 'last_seen_at')
const multiplayerBilling = read('lib/multiplayer/turn-billing.ts')
has(multiplayerBilling, 'ACTIVE_SEAT_WINDOW_MS')
has(multiplayerBilling, 'reserveMultiplayerTurnBilling')
has(multiplayerBilling, 'rpgyw_capture_multiplayer_turn')
has(multiplayerBilling, 'evenlyAllocateMultiplayerCharge')
has(multiplayerBilling, 'campaign_mismatch')
has(multiplayerBilling, 'expected_campaign_revision')
const multiplayerHook = read('components/multiplayer/useMultiplayerSession.ts')
has(multiplayerHook, 'prepareTurn')
has(multiplayerHook, 'completeTurn')
has(multiplayerHook, '/heartbeat')
const voiceControls = read('components/aigm/aigm-voice-controls.tsx')
has(voiceControls, 'prepareTurnBilling')
const gameplay = read('components/aigm/aigm-gameplay-shell.tsx')
has(gameplay, 'prepareMultiplayerTurnBilling')
has(gameplay, 'saveAdventureState(window.localStorage, confirmedTurnState, activePartyState)')
has(gameplay, 'The canonical cloud save already succeeded.')
has(gameplayRoute, 'reserveMultiplayerTurnBilling')
has(gameplayRoute, 'multiplayer_invite_code')


// 1.12.75 UI Bible: landing console wording, Start hierarchy, one campaign accordion,
// one accordion screw, and two-arrow full-screen furniture.
const landingCampaignPanel = read('components/LandingCampaignPanel.tsx')
has(landingCampaignPanel, 'Continue Adventure')
lacks(landingCampaignPanel, 'Return to Adventure')
has(start, '<strong id="rules-heading">Start Here</strong>')
has(start, 'Choose This Game System')
lacks(start, 'Use this game system')
has(campaignHub, 'className="campaign-hub-card"')
has(campaignHub, 'className="campaign-hub-summary"')
lacks(campaignHub, 'play-entry-adventure-open')
lacks(campaignHub, 'play-entry-continue')
const fullscreenToggle = read('components/accessibility/fullscreen-toggle.tsx')
has(fullscreenToggle, 'ArrowUpRight')
has(fullscreenToggle, 'ArrowDownLeft')
has(fullscreenToggle, 'fullscreen-arrow-pair')
lacks(fullscreenToggle, 'Maximize2')
lacks(fullscreenToggle, 'Minimize2')
has(css, 'RPG Your Way 1.12.75 — UI Bible pass.')
has(css, `.start-campaign-hub > summary {\n  width: min(38%, 31rem);`)
has(css, '.campaign-hub-card[open] > .campaign-hub-summary')
has(css, `color: var(--forest-deep) !important;\n  box-shadow:`, 'accordion screw keeps forest ink')

// 1.12.76 Landing Page UI Lookbook implementation.
assert.ok(exists('UI-LOOKBOOK.md'), 'Canonical UI lookbook must travel with the source tree')
const lookbook = read('UI-LOOKBOOK.md')
has(lookbook, '## 1.1 Plaque')
has(lookbook, '## 1.2 Nameplate')
has(lookbook, '## 1.3 Button')
has(lookbook, '## 1.6 Bezel')
has(lookbook, '## 1.7 Accordion screw')
has(css, 'RPG Your Way 1.12.76 — Landing Page UI Lookbook overhaul.')
has(css, '--rpgyw-forest: #043a2d;')
has(css, '--rpgyw-olive-dark: #6f7946;')
has(css, '--rpgyw-olive-light: #d6d1a3;')
has(css, '--rpgyw-cream: #f6ead4;')
has(css, '--rpgyw-parchment: #f2dfb8;')
has(css, '.landing-campaign-screen-stage {\n  background: var(--rpgyw-cream) !important;')
has(css, '.landing-campaign-actions {\n  border: 0 !important;')
has(css, '.landing-accordion-summary {\n  border: 1px solid var(--rpgyw-forest-line) !important;')
has(css, '.landing-reason-card {\n  padding: .55rem !important;')
has(css, '.nested-accordion-copy {\n  margin: .5rem .18rem .1rem;')
has(css, 'width: 38px !important;\n  height: 38px !important;', 'standard accordion screw size')
const siteHeader = read('components/SiteHeader.tsx')
has(siteHeader, "from '@/components/accessibility/fullscreen-toggle'")
has(siteHeader, '<FullscreenToggle className="fullscreen-toggle" />')
assert.equal(exists('components/FullscreenToggle.tsx'), false, 'Duplicate legacy fullscreen component should stay removed')

// Accessibility foundation stays wired and the old exact-format CSS trap stays retired.
const accessibility = read('app/accessibility/page.tsx')
has(accessibility, 'Accessibility')
has(css, 'outline: 3px solid var(--lime);')
assert.match(css, /background:\s*linear-gradient\(\s*180deg,\s*color-mix\(in srgb, var\(--cream-bright\) 97%, white\),\s*var\(--cream\)\s*\) !important;/)

console.log('RPG Your Way 1.12.76 landing-page UI overhaul checks passed.')
