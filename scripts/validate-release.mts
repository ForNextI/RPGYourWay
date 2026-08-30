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
assert.equal(pkg.version, '1.13.15')
assert.equal(pkg.rpgywVersion, '1.13.15')
has(read('lib/version.ts'), "APP_VERSION = '1.13.15'", 'visible app version')

for (const file of [
  'app/page.tsx',
  'app/globals.css',
  'app/layout.tsx',
  'app/robots.ts',
  'app/start/page.tsx',
  'app/play/page.tsx',
  'app/multiplayer/page.tsx',
  'app/script/page.tsx',
  'app/account/page.tsx',
  'app/support/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'components/start/StartOnboarding.tsx',
  'components/start/CampaignHub.tsx',
  'components/aigm/rpgyw-start-entry.tsx',
  'components/ads/AdSenseSlot.tsx',
  'components/aigm/aigm-gameplay-shell.tsx',
  'components/multiplayer/TableChatPanel.tsx',
  'components/multiplayer/MultiplayerPanelSwitcher.tsx',
  'components/multiplayer/MultiplayerCampaignManager.tsx',
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
  'scripts/test-multiplayer-turns.mts',
]) assert.ok(exists(file), `Missing ${file}`)

// Dead private-beta access code is deliberately gone.
assert.equal(exists('lib/shape/access.ts'), false, 'Dead Script beta-access helper should stay deleted')

// Environment names describe this product, and the model overrides used by the code are documented.
const env = read('.env.example')
has(env, 'OPENAI_MODEL=gpt-5.6-terra')
has(env, 'OPENAI_GAMEPLAY_MODEL=gpt-5.6-terra')
has(env, 'OPENAI_SHAPE_MODEL=gpt-5.6-terra')
has(env, 'RPGYW_GOD_MODE_PHRASE=')
has(env, 'NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-7652380497334820')
for (const slotEnv of [
  'NEXT_PUBLIC_ADSENSE_SLOT_LANDING=',
  'NEXT_PUBLIC_ADSENSE_SLOT_START=',
  'NEXT_PUBLIC_ADSENSE_SLOT_SCRIPT=',
  'NEXT_PUBLIC_ADSENSE_SLOT_ACCESSIBILITY=',
]) has(env, slotEnv)
lacks(env, 'WARDENS_GOD_MODE_PHRASE')
const gameplayRoute = read('app/api/aigm/gameplay-chat/route.ts')
has(gameplayRoute, 'process.env.RPGYW_GOD_MODE_PHRASE')
lacks(gameplayRoute, 'process.env.WARDENS_GOD_MODE_PHRASE')

// Google Tag Manager and the direct Google Ads tag are installed once at the site root.
// The direct Ads tag remains authoritative until the purchase conversion is deliberately migrated into GTM.
const rootLayout = read('app/layout.tsx')
const css = read('app/globals.css')
has(rootLayout, "const GOOGLE_TAG_MANAGER_ID = 'GTM-W5TL4QHK'", 'Google Tag Manager container ID')
has(rootLayout, 'https://www.googletagmanager.com/gtm.js?id=', 'Google Tag Manager loader')
has(rootLayout, 'https://www.googletagmanager.com/ns.html?id=${GOOGLE_TAG_MANAGER_ID}', 'Google Tag Manager noscript fallback')
has(rootLayout, 'id="google-tag-manager"', 'Google Tag Manager root script')
assert.equal((rootLayout.match(/googletagmanager\.com\/gtm\.js/g) || []).length, 1, 'Google Tag Manager loader should be installed once')
assert.equal((rootLayout.match(/googletagmanager\.com\/ns\.html/g) || []).length, 1, 'Google Tag Manager noscript fallback should be installed once')
before(rootLayout, '<body>', '<noscript>', 'GTM noscript fallback is the first body content')
before(rootLayout, '<noscript>', '<a className="skip-link"', 'GTM noscript fallback precedes visible body content')
has(rootLayout, "const GOOGLE_ADS_TAG_ID = 'AW-18361311478'", 'Google Ads tag ID')
has(rootLayout, 'https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_TAG_ID}', 'Google Ads gtag loader')
has(rootLayout, "gtag('config', '${GOOGLE_ADS_TAG_ID}');", 'Google Ads gtag config')
assert.equal((rootLayout.match(/googletagmanager\.com\/gtag\/js/g) || []).length, 1, 'Google Ads loader should be installed once')
has(rootLayout, "const DEFAULT_GOOGLE_ADSENSE_ACCOUNT = 'ca-pub-7652380497334820'", 'Google AdSense publisher account fallback')
has(rootLayout, 'process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim()', 'Google AdSense public client environment variable')
has(rootLayout, "'google-adsense-account': GOOGLE_ADSENSE_ACCOUNT", 'Google AdSense ownership meta tag')
has(rootLayout, 'pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${GOOGLE_ADSENSE_ACCOUNT}', 'Google AdSense display loader')
lacks(rootLayout, 'GOOGLE_ADSENSE_HAS_AD_UNITS', 'AdSense site code should not depend on configured ad units')
has(rootLayout, 'strategy="beforeInteractive"', 'Google AdSense site code is loaded at the site root before interactive scripts')
assert.equal((rootLayout.match(/google-adsense-account/g) || []).length, 1, 'Google AdSense ownership meta tag should be declared once')
const adsTxt = read('public/ads.txt')
has(adsTxt, 'google.com, pub-7652380497334820, DIRECT, f08c47fec0942fa0', 'Google AdSense ads.txt authorization')
const privacyPage = read('app/legal/privacy/page.tsx')
has(privacyPage, 'advertising delivery and measurement', 'privacy disclosure for advertising delivery and measurement')
has(privacyPage, 'Google AdSense may use cookies', 'privacy disclosure for AdSense delivery')
has(privacyPage, 'signed-in email address', 'privacy disclosure for purchase matching data')

// Manual AdSense inventory is one shared responsive component with four explicit placements.
const adSenseSlot = read('components/ads/AdSenseSlot.tsx')
has(adSenseSlot, "type AdPlacement = 'landing' | 'start' | 'script' | 'accessibility'", 'canonical manual ad placements')
has(adSenseSlot, 'NEXT_PUBLIC_ADSENSE_SLOT_LANDING', 'Landing AdSense slot environment variable')
has(adSenseSlot, 'NEXT_PUBLIC_ADSENSE_SLOT_START', 'Start AdSense slot environment variable')
has(adSenseSlot, 'NEXT_PUBLIC_ADSENSE_SLOT_SCRIPT', 'Script AdSense slot environment variable')
has(adSenseSlot, 'NEXT_PUBLIC_ADSENSE_SLOT_ACCESSIBILITY', 'Accessibility AdSense slot environment variable')
has(adSenseSlot, 'Advertisements', 'policy-safe ad label')
has(adSenseSlot, 'window.adsbygoogle.push({})', 'AdSense request queue')
const landingPage = read('app/page.tsx')
const adScriptPage = read('app/script/page.tsx')
const accessibilityPage = read('app/accessibility/page.tsx')
const adStartEntry = read('components/aigm/rpgyw-start-entry.tsx')
has(landingPage, '<AdSenseSlot placement="landing" />', 'Landing manual ad placement')
has(adScriptPage, '<AdSenseSlot placement="script" />', 'Script manual ad placement')
has(accessibilityPage, '<AdSenseSlot placement="accessibility" />', 'Accessibility manual ad placement')
has(adStartEntry, '!addCharacterMode ? <AdSenseSlot placement="start" /> : null', 'Start manual ad placement excludes add-character flow')
has(css, '.ad-placement--start {')
has(adStartEntry, 'className="start-here-hero" aria-hidden="true">~ Start Here ~</div>', 'decorative Start Here parchment plaque')
has(css, '.start-here-hero {', 'Start Here decorative plaque styling')
assert.equal(adStartEntry.includes('start-here-hero" href='), false, 'Start Here plaque must not be interactive')
assert.equal(css.includes('.start-here-hero:hover'), false, 'Start Here plaque must not have hover behavior')
has(css, 'font-family: "Old English Text MT"', 'Start Here blackletter-style typography')
has(css, 'max-width: 320px;', 'mobile ad width')
has(css, 'height: 100px;', 'mobile ad height')
has(css, 'width: 468px;', 'intermediate ad width')
has(css, 'height: 60px;', 'intermediate ad height')
has(css, 'width: 728px;', 'desktop ad width')
has(css, 'height: 90px;', 'desktop ad height')

// Verified paid Stripe checkout publishes one canonical purchase data-layer event for GTM/Reddit,
// while the existing direct Google Ads conversion remains authoritative until deliberately migrated.
const purchaseTracking = read('components/analytics/PurchaseTracking.tsx')
has(purchaseTracking, "event: 'purchase'", 'purchase data-layer event')
has(purchaseTracking, 'trackingWindow.dataLayer.push({ ecommerce: null })', 'purchase ecommerce reset')
has(purchaseTracking, 'email_address: email', 'purchase email matching data')
has(purchaseTracking, 'transaction_id: transactionId', 'purchase transaction id')
has(purchaseTracking, "currency: 'USD'", 'purchase currency')
has(purchaseTracking, 'item_id: itemId', 'purchase item id')
has(purchaseTracking, 'item_name: itemName', 'purchase item name')
has(purchaseTracking, "item_category: 'Play Pack'", 'purchase item category')
has(purchaseTracking, 'price: value', 'purchase item price')
has(purchaseTracking, 'quantity: 1', 'purchase item quantity')
has(purchaseTracking, "AW-18361311478/ub-xCO3YnOocEPbBrbNE", 'Google Ads purchase conversion destination')
has(purchaseTracking, "gtag('event', 'conversion'", 'Google Ads purchase conversion event')
lacks(purchaseTracking, 'alice@site.com', 'sample purchase email')
lacks(purchaseTracking, '+15551234567', 'sample purchase phone')
lacks(purchaseTracking, 'SKU_12345', 'sample purchase SKU')
lacks(purchaseTracking, 'Potato Tee', 'sample purchase item')
lacks(purchaseTracking, 'value: 20.00', 'sample purchase value')
assert.equal(exists('components/analytics/GoogleAdsPurchaseConversion.tsx'), false, 'superseded purchase-only component should stay removed')
const accountPage = read('app/account/page.tsx')
has(accountPage, 'if (finalized.credited) {', 'purchase tracking gated on verified paid checkout')
has(accountPage, 'transactionId: checkoutSessionId', 'Stripe Checkout Session used as purchase transaction id')
has(accountPage, 'value: finalized.pack.priceCents / 100', 'actual Play Pack purchase price used as purchase value')
has(accountPage, 'itemId: finalized.pack.id', 'actual Play Pack id used as purchase item id')
has(accountPage, 'itemName: finalized.pack.name', 'actual Play Pack name used as purchase item name')
has(accountPage, 'email={email}', 'signed-in account email passed to purchase matching data')

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
has(css, '.landing-accordion {\n  overflow: visible;\n  border: 0;')
has(css, '.landing-accordion-body {')
has(css, 'color-mix(in srgb, var(--rpgyw-olive-dark) 90%, var(--rpgyw-cream))', 'landing accordion reveal uses dark-olive plaque')
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
const multiplayerPage = read('app/multiplayer/page.tsx')
const multiplayerManager = read('components/multiplayer/MultiplayerCampaignManager.tsx')
has(startEntry, '<CampaignHub />', 'import hub above onboarding')
before(startEntry, '<CampaignHub />', '<StartOnboarding', 'import hub position')
has(campaignHub, 'Import older adventures', 'Start import-only control')
has(campaignHub, 'RPG Your Way can import WardensPC exports that had already reached Play')
lacks(campaignHub, 'Your Campaigns', 'campaign list retired from Start')
lacks(campaignHub, 'Pending decisions', 'multiplayer governance retired from Start')
lacks(campaignHub, 'Continue Adventure', 'campaign continuation retired from Start import control')
has(multiplayerPage, 'This page is for controlling multiplayer and VTT.', 'Multiplayer creation/management notice')
has(multiplayerPage, 'you will do so in Start, as part of the normal campaign creation workflow.', 'Start remains campaign-creation home')
has(multiplayerPage, '<MultiplayerCampaignManager />', 'Multiplayer management component')
has(multiplayerPage, 'VTT connections are coming next.', 'VTT placeholder')
has(multiplayerManager, 'Campaign and multiplayer controls')
has(multiplayerManager, 'Continue Adventure')
has(multiplayerManager, 'Pending decisions')
has(multiplayerManager, 'Members')
has(multiplayerManager, 'Make coordinator')
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


// The current UI contract is semantic. Validation protects the lookbook and canonical
// primitives instead of pinning release-by-release CSS archaeology.
const landingCampaignPanel = read('components/LandingCampaignPanel.tsx')
has(landingCampaignPanel, 'Continue Adventure')
lacks(landingCampaignPanel, 'Return to Adventure')
has(start, '<strong id="rules-heading">New Campaign</strong>')
has(start, 'Choose This Game System')
lacks(start, 'Use this game system')
has(multiplayerManager, 'className="campaign-hub-card"')
has(multiplayerManager, 'className="campaign-hub-summary"')
lacks(multiplayerManager, 'play-entry-adventure-open')
lacks(multiplayerManager, 'play-entry-continue')

const fullscreenToggle = read('components/accessibility/fullscreen-toggle.tsx')
has(fullscreenToggle, 'ArrowUpRight')
has(fullscreenToggle, 'ArrowDownLeft')
has(fullscreenToggle, 'fullscreen-arrow-pair')
lacks(fullscreenToggle, 'ArrowDownRight')
lacks(fullscreenToggle, 'ArrowUpLeft')
assert.equal(exists('components/FullscreenToggle.tsx'), false, 'Duplicate legacy fullscreen component should stay removed')

assert.ok(exists('UI-LOOKBOOK.md'), 'Canonical UI lookbook must travel with the source tree')
const lookbook = read('UI-LOOKBOOK.md')
for (const heading of ['## 1.1 Plaque', '## 1.2 Nameplate', '## 1.3 Button', '## 1.6 Bezel', '## 1.7 Accordion screw']) has(lookbook, heading)
has(lookbook, '**35 px × 35 px** nominal size', 'canonical 35 px accordion screw')
has(lookbook, 'The visible brass surround on a canonical raised object is **2 px**', 'canonical 2 px brass surround')
has(lookbook, '# 22. Current page-specific composition rules')
lacks(lookbook, '1.12.80')
lacks(lookbook, '1.12.81')
lacks(lookbook, '1.12.82')
lacks(lookbook, '1.12.83')
lacks(lookbook, '1.12.84')

// One palette and one geometry set own the finished interface.
for (const token of [
  '--rpgyw-forest: #043a2d;',
  '--rpgyw-forest-line: #07563f;',
  '--rpgyw-olive-dark: #6f7946;',
  '--rpgyw-olive-light: #d6d1a3;',
  '--rpgyw-cream: #f6ead4;',
  '--rpgyw-parchment: #f2dfb8;',
  '--rpgyw-lime: #c1dc4d;',
  '--rpgyw-brass-dark: #7a6031;',
  '--rpgyw-brass-mid: #a88a4d;',
  '--rpgyw-brass-light: #d7bd7b;',
  '--rpgyw-rim-spread: 2px;',
  '--rpgyw-accordion-screw: 35px;',
  '--rpgyw-radius-control: 14px;',
  '--rpgyw-radius-card: 18px;',
  '--rpgyw-radius-plaque: 20px;',
  '--rpgyw-face-cream:',
  '--rpgyw-face-olive-light:',
  '--rpgyw-face-olive-dark:',
  '--rpgyw-face-forest:',
  '--rpgyw-raised-light-shadow:',
  '--rpgyw-raised-dark-shadow:',
]) has(css, token)
for (const retired of [
  '--cream-bright', '--forest-deep', '--landing-mint', '--landing-olive', '--rpgyw-pale-olive',
  'RPG Your Way 1.12.', 'width: 38px !important;\n  height: 38px !important;',
]) lacks(css, retired)
assert.doesNotMatch(css, /border:\s*(?:1|3)px solid var\(--rpgyw-brass-(?:mid|light)\)(?:\s*!important)?;/, 'Pure brass object surrounds must use the canonical 2 px width')
has(css, 'body :where(button, .button, summary, [role="button"]):not(:disabled):hover,', 'single application hover language')
has(css, 'color: var(--rpgyw-lime) !important;', 'hover/focus copy uses canonical lime')
has(css, 'width: var(--rpgyw-accordion-screw);')
has(css, 'height: var(--rpgyw-accordion-screw);')
assert.equal((css.match(/^\.accordion-plus\s*\{/gm) ?? []).length, 1, 'Accordion screw hardware must have one physical recipe')
has(css, 'span:not(.accordion-plus)', 'accordion hardware is excluded from copy hover recoloring')
lacks(css, '.landing-reason-card .accordion-plus,', 'landing accordions must not override screw hardware')
has(css, '.aigm-conversation-olive-frame {', 'Play conversation olive bezel rail')
has(css, '.aigm-conversation-scroll {', 'Play conversation parchment opening')
has(css, 'border: 2px solid var(--rpgyw-brass-mid);', 'brass is available for true inner openings')


// Retired UI species stay retired rather than lingering behind the final cascade.
for (const retiredSelector of [
  '.shape-steps', '.landing-notice-card', '.landing-notice-grid', '.landing-thesis-strip',
  '.start-standardize-bar', '.start-onboarding-intro', '.start-fixed-setting', '.start-voice-row', '.fake-button',
]) lacks(css, retiredSelector)
assert.equal(exists('public/rpgyw-logo.png'), false, 'Unused superseded 2.4 MB logo asset should stay removed')
assert.equal(exists('scripts/test-11274-multiplayer-turns.mts'), false, 'Version-number-named multiplayer test should stay retired')

// Accessibility foundation and Motion controls use the same visual dialect.
const accessibility = read('app/accessibility/page.tsx')
has(accessibility, 'Accessibility')
has(css, 'outline: 3px solid var(--rpgyw-lime);')
const motionPreference = read('components/accessibility/motion-preference.tsx')
has(motionPreference, 'motion-settings-control--compact')
lacks(motionPreference, 'border-amber')
lacks(motionPreference, 'bg-black')

// Informational pages use one canonical prose-card family.
for (const file of [
  'app/support/page.tsx', 'app/legal/privacy/page.tsx', 'app/legal/terms/page.tsx',
  'app/read/page.tsx', 'app/accessibility/page.tsx', 'app/not-found.tsx',
]) has(read(file), 'prose-page', `${file} canonical prose page`)
has(css, '.inner-main > .shell.prose-page {')

// Start and Play retain the finished composition while sharing the common primitives.
lacks(start, 'start-rules-subtitle', 'redundant New Campaign subtitle')
has(start, 'id="start-new-campaign"', 'Start Here destination anchor')
lacks(start, 'Six short questions answered.', 'redundant completed-guidance subtitle')
has(start, 'start-complete-plaque start-complete-plaque--guidance', 'completed guidance modifier')
has(css, '.start-play-button {')
has(css, 'width: min(34%, 32rem);', 'desktop Onward is centered at roughly one-third width')
has(css, '.start-play-step {\n  display: flex;\n  justify-content: center;', 'Onward is centered')
has(css, '@media (max-width: 640px) {\n  .start-play-button {\n    width: 100%;', 'Onward expands on mobile')
has(css, '.start-mini-rating-item > span {')
has(css, '.start-leader-card > .start-leader-main > span {')
has(css, '.medieval-page--play .aigm-party-capacity {')
has(css, '.medieval-page--play #dice-quantity {')
has(gameplayShell, 'src="/images/dragon-dice-selector.webp"', 'dragon dice selector artwork')
has(gameplayShell, 'className="aigm-dice-art-button aigm-dice-art-button--percentile"', 'percentile dice hit area')
has(css, '.aigm-dice-art-selector {', 'dragon dice selector')
has(css, 'border: 0;', 'frameless dragon dice selector')
has(gameplayShell, 'className="aigm-dice-selection-feedback"', 'centered die-selection feedback')
has(gameplayShell, 'setDieSelectionFeedback(`d${sides}`)', 'die-selection feedback names the die kind')
lacks(css, '.aigm-dice-art-label {', 'retired per-cell die labels')
lacks(gameplayShell, 'className="aigm-die-button', 'retired generic die buttons')
assert.equal(exists('public/images/dragon-dice-selector.webp'), true, 'Dragon dice selector artwork should ship with Play')
has(css, '.medieval-page--play .aigm-gameplay-message-input {')
has(gameplayShell, '<BookOpen className="size-3.5" aria-hidden="true" />Can I direct my game?</button>', 'story-direction help lives in Session tools')
has(gameplayShell, 'Current saved turn: ${partyState?.gameplay.turn_count ?? 0}', 'transcript session note includes current saved turn')

// Gather Your Party follows the current dark-plaque/light-card hierarchy and exposes character-creation resources.
const startOnboarding = read('components/start/StartOnboarding.tsx')
has(startOnboarding, 'Where to generate characters', 'character-generation helper')
has(startOnboarding, 'How to import characters', 'character-import helper')
has(startOnboarding, "name: 'D&D Beyond'", 'D&D Beyond character resource')
has(startOnboarding, "name: 'Roll20 Characters'", 'Roll20 character resource')
has(startOnboarding, "name: 'MythWeaver'", 'MythWeaver character resource')
has(startOnboarding, "name: 'Dungeon Master’s Vault'", 'Dungeon Master’s Vault resource')
has(startOnboarding, "name: 'Shard Tabletop'", 'Shard Tabletop resource')
has(startOnboarding, "name: 'Pathbuilder 2e'", 'Pathbuilder 2e resource')
has(startOnboarding, "name: 'Pathfinder Nexus / Demiplane'", 'Pathfinder Nexus resource')
has(startOnboarding, "name: 'Wanderer’s Guide'", 'Wanderer’s Guide resource')
has(startOnboarding, "name: 'PathCompanion'", 'PathCompanion resource')
has(startOnboarding, "name: 'Myth-Weavers'", 'Myth-Weavers resource')
has(startOnboarding, 'className="start-remove-control"', 'cream Remove control hook')
has(startOnboarding, '>Use this party</button>', 'Use This Party action')
has(css, '.start-step.start-party-step {', 'dark-olive Gather Your Party plaque')
has(css, '.start-party-card-actions .start-remove-control {', 'cream Remove recipe')
has(css, '.start-character-builder-summary {', 'character resource accordion recipe')
has(css, '.start-character-builder-reveal {', 'character resource cream reveal')
has(css, '.start-forest-control {', 'forest helper/confirmation button recipe')
has(css, '.start-import-hub > summary {', 'dark-olive Start import control')
const siteHeader = read('components/SiteHeader.tsx')
has(siteHeader, "{ href: '/multiplayer', label: 'Multiplayer' }", 'Multiplayer primary-navigation item')
before(siteHeader, "{ href: '/play', label: 'Play' }", "{ href: '/multiplayer', label: 'Multiplayer' }", 'Play before Multiplayer navigation')
before(siteHeader, "{ href: '/multiplayer', label: 'Multiplayer' }", "{ href: '/script', label: 'Script' }", 'Multiplayer before Script navigation')
has(css, '.multiplayer-page-notice {', 'Multiplayer management notice styling')
has(css, '.multiplayer-campaign-manager {', 'Multiplayer campaign-control plaque')
has(css, '.multiplayer-vtt-card {', 'VTT future-work plaque')

// Script is the actual three-step converter and accepts outside campaign records.
const scriptPageUi = read('app/script/page.tsx')
const shapeWorkspace = read('components/ShapeWorkspace.tsx')
lacks(scriptPageUi, 'className="shape-steps"', 'obsolete Script explainer strip')
has(scriptPageUi, 'another text-to-play game, another game system, or a tabletop campaign you recorded digitally', 'Script accepts outside campaign records')
has(shapeWorkspace, 'Any useful digital record of the campaign you actually played.', 'Script source guidance accepts outside records')
lacks(shapeWorkspace, '<p className="kicker">Script workbench</p>', 'redundant Script workbench kicker')
before(shapeWorkspace, 'id="shape-step-1-title">Upload or drop transcript', 'id="shape-step-2-title">Answer the questions', 'Script step order 1 → 2')
before(shapeWorkspace, 'id="shape-step-2-title">Answer the questions', 'id="shape-step-3-title">See maximum usage', 'Script step order 2 → 3')
has(css, '.shape-script-step--questions .shape-script-step-nameplate {')
has(shapeWorkspace, "fetch('/api/shape/jobs?active=1'", 'Script revisits resume only active jobs')
has(shapeWorkspace, "shape-workbench--completed", 'completed Script result modifier')
has(shapeWorkspace, "setDescriptionLevel('light')", 'Script another resets description level')
has(shapeWorkspace, "setProjectTitle('')", 'Script another resets project title')
has(css, '.shape-workbench--completed {', 'completed Script dark-olive plaque')
has(css, '.shape-workbench--completed .shape-actions .button {', 'completed Script actions use one canonical family')

// Character record material/state language is explicit and consistent.
has(gameplayShell, 'className="character-record-section group"', 'character-record accordions')
has(gameplayShell, 'accordion-plus character-record-section-screw', 'character record uses canonical screw')
has(css, '.character-record-section-summary,\n.character-record-section:nth-child(even) > .character-record-section-summary,', 'closed character record summaries share one face')
has(css, '.character-record-section[open] > .character-record-section-summary,', 'open character record summary state')
has(css, '.character-record-section-body,\n.character-record-nested-body {', 'character-record reveal backing')
has(css, 'background: var(--rpgyw-olive-dark) !important;', 'dark-olive record reveal')
has(css, '.character-sheet-header-controls .character-remove-button--confirm {')

// Account/Auth follows the same accordion, button, and text-entry materials.
has(accountPage, 'account-access-details--signed-in', 'compact signed-in account control')
has(accountPage, 'play-pack-section--catalog', 'Play Pack catalog material modifier')
has(accountPage, 'usage-activity--purchase-history', 'Purchase history material modifier')
has(css, '.account-main .account-access-details--signed-in {')
has(css, 'width: min(50%, 34rem);', 'signed-in account control desktop width')
has(css, '.account-main .play-pack-section--catalog {')
has(css, '.account-main .usage-activity--purchase-history {')
has(css, '.account-main .account-access-details[open] > summary {')
has(css, 'background: var(--rpgyw-forest);')
has(css, '.account-main .account-access-body {')
has(css, 'background: var(--rpgyw-olive-dark);')
has(css, '.auth-form input {')
has(css, 'background: var(--rpgyw-parchment);')
lacks(css, '.account-delete-submit {\n  background: red', 'red delete slab')

console.log('RPG Your Way 1.13.15 release and canonical UI checks passed.')
