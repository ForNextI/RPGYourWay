import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative: string) => fs.existsSync(path.join(root, relative))

const pkg = JSON.parse(read('package.json')) as { name?: string; version?: string; rpgywVersion?: string; dependencies?: Record<string,string> }
assert.equal(pkg.name, 'rpg-your-way')
assert.equal(pkg.version, '1.7.27')
assert.equal(pkg.rpgywVersion, '1.7.27')
assert.match(read('lib/version.ts'), /APP_VERSION = '1\.7\.27'/)

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
assert.match(home, /href="\/start">Start New Campaign<\/Link>/)
assert.match(home, /<LandingCampaignPanel \/>/)
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
assert.match(playAccess, /voice_available:\s*true/)
const speech = read('app/api/aigm/speech/route.ts')
const transcribe = read('app/api/aigm/transcribe/route.ts')
assert.doesNotMatch(speech, /if \(!account\.ownerQa\)/)
assert.doesNotMatch(transcribe, /if \(!account\.ownerQa\)/)

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


const gameplay179 = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(gameplay179, /aigm-conversation-column/)
assert.match(gameplay179, /aigm-message-wrap/)
assert.match(gameplay179, /Initiative <span className="inline-block whitespace-nowrap">&amp; Dice<\/span>/)
assert.doesNotMatch(gameplay179, /\b(?:bg|text|border)-accent(?:-foreground)?(?:\/[\w.-]+)?\b/)
const css179 = read('app/globals.css')
assert.match(css179, /RPG Your Way 1\.7\.9 recovered Play layout and color cleanup/)
assert.match(css179, /grid-template-columns:\s*minmax\(260px, \.78fr\) minmax\(0, 2\.4fr\) minmax\(250px, \.86fr\)/)
assert.match(css179, /\.aigm-assistant-message\s*\{\s*max-width:\s*calc\(100% - 3rem\)/)
const access179 = read('app/api/play/access/route.ts')
assert.match(access179, /voice_available:\s*true/)
assert.doesNotMatch(access179, /voice_available:\s*account\.ownerQa/)

console.log('RPG Your Way 1.7.9 recovery, voice-validator, and Play presentation checks passed.')


const gameplay1710 = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(gameplay1710, /aigm-gameplay-title-row/)
assert.match(gameplay1710, /rows=\{2\}/)
assert.match(gameplay1710, /onReorder=\{reorderPartyCharacter\}/)
assert.match(gameplay1710, /pointerDraggingRef/)
assert.match(gameplay1710, /aigm-session-help/)
assert.match(gameplay1710, /data-open=\{sessionToolsOpen/)
assert.doesNotMatch(gameplay1710, /Current party<\/p>/)
const authPanel1710 = read('components/AuthPanel.tsx')
assert.match(authPanel1710, /Confirm password/)
assert.match(authPanel1710, /name="confirmPassword"/)
const authActions1710 = read('app/account/actions.ts')
assert.match(authActions1710, /password !== confirmPassword/)
const authPrompt1710 = read('components/AuthPrompt.tsx')
assert.match(authPrompt1710, /Not now\. I just want to look around\./)
const css1710 = read('app/globals.css')
assert.match(css1710, /RPG Your Way 1\.7\.12 Play space-reclamation and account-entry cleanup/)
assert.match(css1710, /minmax\(230px, \.68fr\) minmax\(0, 2\.85fr\) minmax\(240px, \.72fr\)/)
assert.match(css1710, /aigm-session-tools\[data-open="true"\]/)
assert.match(css1710, /\.auth-not-now \{[\s\S]*width: 100%/)

console.log('RPG Your Way 1.7.12 Play space and account-entry checks passed.')


const gameplay1714 = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(gameplay1714, /Accept what fate sends your way/)
assert.match(gameplay1714, /Fate is a fickle mistress/)
assert.match(gameplay1714, />How many dice\?<\/label>/)
assert.match(gameplay1714, />Of which kind\?<\/p>/)
assert.match(gameplay1714, /Can I direct my game\?/)
assert.match(gameplay1714, /Drag to reorder/)
assert.match(gameplay1714, /const \[dragging, setDragging\] = useState\(false\)/)

const siteHeader1714 = read('components/SiteHeader.tsx')
assert.match(siteHeader1714, /\{ href: '\/start', label: 'Start' \}/)
assert.match(siteHeader1714, /\{ href: '\/account', label: 'Account' \}/)

const playPage1714 = read('app/play/page.tsx')
assert.match(playPage1714, /play-page-frame/)
assert.match(playPage1714, /<SiteHeader \/>/)
assert.match(playPage1714, /<MotionPreferenceProvider>/)
assert.match(playPage1714, /<AigmGameplayShell \/>/)

const landing1714 = read('app/page.tsx')
assert.match(landing1714, /~~ Warning: AI GM ahead ~~/)
assert.match(landing1714, /Open Now/)
assert.match(landing1714, /Tabletop gaming is best in person\. No question\./)
assert.match(landing1714, /Why I created RPG Your Way\./)
assert.match(landing1714, /Who benefits from this site\?/)
assert.match(landing1714, /<LandingCampaignPanel \/>/)
assert.match(landing1714, />Start New Campaign<\/Link>/)

const campaignPanel1714 = read('components/LandingCampaignPanel.tsx')
assert.match(campaignPanel1714, /Return to Adventure/)
assert.match(campaignPanel1714, /available_display/)
assert.match(campaignPanel1714, /loadAdventureState/)
assert.match(campaignPanel1714, /CURRENT_ADVENTURE_KEY/)

const css1714 = read('app/globals.css')
assert.match(css1714, /RPG Your Way 1\.7\.14 Play \+ landing return pass/)
assert.match(css1714, /translateY\(calc\(-100% \+ 4px\)\)/)
assert.match(css1714, /\.landing-return-grid/)
assert.match(css1714, /\.landing-campaign-snippet/)
assert.match(css1714, /\.fullscreen-nav-gap\s*\{\s*margin-left:\s*\.25rem/)

console.log('RPG Your Way 1.7.16 landing-validator hotfix checks passed.')

const landingCampaignCurrent = read('components/LandingCampaignPanel.tsx')
assert.match(landingCampaignCurrent, /Return to Adventure/)


const landing1717 = read('app/page.tsx')
assert.match(landing1717, />Start New Campaign<\/Link>/)
assert.match(landing1717, /<WhyCreatedAccordion \/>/)
assert.match(landing1717, /<AudienceAccordion \/>/)

const campaign1717 = read('components/LandingCampaignPanel.tsx')
assert.match(campaign1717, /Return to Adventure/)
assert.doesNotMatch(campaign1717, /Return to Playing/)

const css1717 = read('app/globals.css')
assert.match(css1717, /RPG Your Way 1\.7\.17 landing console \+ repository cleanup/)
assert.match(css1717, /\.landing-ai-warning \.landing-notice-card h1/)
assert.match(css1717, /\.landing-player-stack\s*\{/)
assert.match(css1717, /\.landing-new-player\.button/)
assert.match(css1717, /\.landing-return-button\.button/)

console.log('RPG Your Way 1.7.17 landing console and repository cleanup checks passed.')


const landing1718 = read('app/page.tsx')
assert.match(landing1718, /landing-reason-created/)
assert.match(landing1718, /landing-reason-audience/)
assert.match(landing1718, />Start New Campaign<\/Link>/)
assert.match(landing1718, /Why I created RPG Your Way\./)
assert.match(landing1718, /Who benefits from this site\?/)

const campaign1718 = read('components/LandingCampaignPanel.tsx')
assert.match(campaign1718, /const limit = 360/)
assert.match(campaign1718, /clean\.slice\(-limit\)/)
assert.match(campaign1718, /landing-campaign-summary-card/)
assert.match(campaign1718, /landing-balance-control/)
assert.match(campaign1718, /Return to Adventure/)
assert.match(campaign1718, /<span>\{campaign\.snippet/)

const css1718 = read('app/globals.css')
assert.match(css1718, /RPG Your Way 1\.7\.18 dimensional flat landing system/)
assert.match(css1718, /--landing-mint:/)
assert.match(css1718, /--landing-olive:/)
assert.match(css1718, /\.landing-open-now \.landing-notice-card h2/)
assert.match(css1718, /\.landing-thesis-strip p/)
assert.match(css1718, /\.landing-reason-card summary/)
assert.match(css1718, /\.landing-campaign-summary-card/)
assert.match(css1718, /\.landing-campaign-snippet > span/)
assert.match(css1718, /\.landing-balance-control/)
assert.match(css1718, /grid-template-columns: minmax\(0, \.85fr\) minmax\(0, 1\.45fr\)/)

console.log('RPG Your Way 1.7.18 dimensional landing console checks passed.')


const landing1719 = read('app/page.tsx')
assert.match(landing1719, /landing-notice-pair-section/)
assert.match(landing1719, /shell landing-notice-grid/)
assert.match(landing1719, /landing-reason-created/)
assert.match(landing1719, /landing-reason-audience/)
assert.doesNotMatch(landing1719, /className="hero-unique landing-reason-card/)
assert.doesNotMatch(landing1719, /className="hero-audience landing-reason-card/)

const campaign1719 = read('components/LandingCampaignPanel.tsx')
assert.match(campaign1719, /const limit = 360/)
assert.match(campaign1719, /clean\.slice\(-limit\)/)
assert.match(campaign1719, /landing-campaign-summary-card/)
assert.match(campaign1719, /landing-balance-control/)
assert.match(campaign1719, /Return to Adventure/)

const css1719 = read('app/globals.css')
assert.match(css1719, /RPG Your Way 1\.7\.19 dimensional landing language/)
assert.match(css1719, /--landing-brass-light:/)
assert.match(css1719, /\.landing-notice-grid/)
assert.match(css1719, /\.landing-notice-grid \.landing-notice-card h1/)
assert.match(css1719, /\.landing-reason-card summary/)
assert.match(css1719, /\.landing-player-stack,\n\.landing-return-logo/)
assert.match(css1719, /\.landing-campaign-summary-card/)
assert.match(css1719, /\.landing-campaign-snippet > span\s*\{\s*-webkit-line-clamp: 5;/)
assert.match(css1719, /\.landing-balance-control\s*\{/)
assert.match(css1719, /\.landing-return-logo\s*\{/)
assert.match(css1719, /aspect-ratio: 1 \/ 1;/)
assert.match(css1719, /white-space: nowrap;/)

console.log('RPG Your Way 1.7.19 dimensional landing language checks passed.')


const campaign1720 = read('components/LandingCampaignPanel.tsx')
assert.match(campaign1720, /const limit = 360/)
assert.match(campaign1720, /clean\.slice\(-limit\)/)

console.log('RPG Your Way 1.7.20 validator tail-limit hotfix checks passed.')


const landing1721 = read('app/page.tsx')
assert.match(landing1721, /className="landing-notice-body"/)
assert.match(landing1721, /WardensPC campaigns brought over by export/)
assert.match(landing1721, /Script<\/strong> is open too\./)
assert.match(landing1721, /VTT comes later\./)
if (landing1721.includes('const features')) {
  assert.match(landing1721, /Play a long-running campaign without waiting for everybody to be free at the same time\.|Run an ongoing tabletop campaign without waiting for a whole group to be free at the same moment\./)
  assert.match(landing1721, /Play one character or run a party of up to six\.|Play one character or manage a full party\./)
  assert.match(landing1721, /Type or talk to your Game Master\.|The interface is being built mobile-first/)
}

const css1721 = read('app/globals.css')
assert.match(css1721, /RPG Your Way 1\.7\.21 dimensional controls \+ human-language pass/)
assert.match(css1721, /--rpgyw-control-hover: var\(--lime\)/)
assert.match(css1721, /\.site-header \.brand:hover/)
assert.match(css1721, /\.landing-notice-body/)
assert.match(css1721, /\.landing-reason-card \.accordion-plus/)
assert.match(css1721, /border: 2px solid var\(--rpgyw-brass-edge\)/)
assert.match(css1721, /color: var\(--rpgyw-control-hover\) !important/)
assert.match(css1721, /body :where\(button, \.button, \.fake-button, summary, \[role="button"\]\)/)

console.log('RPG Your Way 1.7.21 dimensional controls and language checks passed.')


const css1722 = read('app/globals.css')
assert.match(css1722, /RPG Your Way 1\.7\.22 header hover \+ dimensional utility controls/)
assert.match(css1722, /\.site-header \.main-nav a:hover,[\s\S]*background: var\(--forest-deep\);[\s\S]*color: var\(--lime\) !important/)
assert.match(css1722, /\.site-header \.brand-mark[\s\S]*border: 2px solid var\(--landing-brass-mid\)/)
assert.match(css1722, /\.site-header \.fullscreen-toggle[\s\S]*border: 2px solid var\(--landing-brass-mid\)/)
assert.match(css1722, /\.site-header \.fullscreen-toggle:hover,[\s\S]*background: var\(--forest-deep\);[\s\S]*color: var\(--lime\) !important/)
assert.match(css1722, /\.landing-reason-card summary:hover \.landing-accordion-prompt/)
assert.match(read('components/SiteHeader.tsx'), /className="brand-mark"/)
assert.match(read('components/FullscreenToggle.tsx'), /className="fullscreen-toggle"/)

console.log('RPG Your Way 1.7.22 header hover and dimensional utility-control checks passed.')

const css1723 = read('app/globals.css')
assert.match(css1723, /RPG Your Way 1\.7\.23 visual unification/)
assert.match(css1723, /\.shape-main > \.shape-shell,[\s\S]*background: transparent/)
assert.match(css1723, /\.account-intro[\s\S]*border: 2px solid var\(--rpgyw-brass-edge\)/)
assert.match(css1723, /\.aigm-die-button,[\s\S]*background:/)
assert.match(css1723, /\.aigm-send-roll,[\s\S]*var\(--landing-olive-19\)/)
assert.match(css1723, /\.medieval-page--play button:not\(:disabled\):hover,[\s\S]*background: var\(--forest-deep\) !important;[\s\S]*color: var\(--lime\) !important/)
assert.match(read('components/aigm/aigm-gameplay-shell.tsx'), /aigm-die-button/)
assert.match(read('components/aigm/aigm-gameplay-shell.tsx'), /aigm-character-card--leader/)
assert.match(read('app/account/page.tsx'), /className="account-intro"/)

console.log('RPG Your Way 1.7.23 visual-unification checks passed.')


const css1724 = read('app/globals.css')
assert.match(css1724, /RPG Your Way 1\.7\.24 Play visual correction/)
assert.match(css1724, /\.aigm-dice-mode-button[\s\S]*border: 1px solid var\(--rpgyw-brass-edge\)/)
assert.match(css1724, /\.aigm-characters-heading h2[\s\S]*font-size: clamp/)
assert.match(css1724, /\.aigm-conversation-stage[\s\S]*background: var\(--forest-deep\)/)
assert.match(css1724, /\.aigm-conversation-olive-frame[\s\S]*var\(--landing-olive-19-deep\)/)
assert.match(css1724, /\.aigm-conversation-scroll[\s\S]*border: 2px solid var\(--landing-brass-dark\)/)
const gameplay1724 = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(gameplay1724, /aigm-dice-mode-toggle/)
assert.match(gameplay1724, /aigm-conversation-stage/)
assert.match(gameplay1724, /aigm-conversation-olive-frame/)

console.log('RPG Your Way 1.7.24 Play visual-correction checks passed.')


const css1725 = read('app/globals.css')
assert.match(css1725, /RPG Your Way 1\.7\.25 Play rail repair \+ landing bezel/)
assert.match(css1725, /\.aigm-dice-mode-toggle[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
assert.match(css1725, /\.aigm-party-capacity[\s\S]*text-align: center/)
assert.match(css1725, /\.landing-campaign-screen-stage[\s\S]*background: var\(--forest-deep\)/)
assert.match(css1725, /\.landing-campaign-screen-olive-frame[\s\S]*var\(--landing-olive-19-deep\)/)
const gameplay1725 = read('components/aigm/aigm-gameplay-shell.tsx')
assert.match(gameplay1725, /Current party:/)
assert.match(gameplay1725, /Max party size:/)
assert.doesNotMatch(gameplay1725, /\{readyCharacters\.length\} · Max 6/)
assert.match(read('components/LandingCampaignPanel.tsx'), /landing-campaign-screen-stage/)
assert.match(read('components/LandingCampaignPanel.tsx'), /landing-campaign-screen-olive-frame/)

console.log('RPG Your Way 1.7.25 Play rail and landing-bezel checks passed.')

const authPanel1726 = read('components/AuthPanel.tsx')
assert.match(authPanel1726, /<span>Email address<\/span>/)
assert.match(authPanel1726, /name="email"/)
assert.match(authPanel1726, /name="confirmPassword"/)
assert.doesNotMatch(authPanel1726, /confirmEmail/)
assert.doesNotMatch(authPanel1726, /Confirm your email address/)
const authActions1726 = read('app/account/actions.ts')
assert.doesNotMatch(authActions1726, /confirmEmail/)
assert.doesNotMatch(authActions1726, /email addresses do not match/)
assert.match(authActions1726, /Enter your email address and choose a password\./)
assert.match(authActions1726, /password !== confirmPassword/)
const authPrompt1726 = read('components/AuthPrompt.tsx')
assert.ok(authPrompt1726.indexOf('Not now. I just want to look around.') < authPrompt1726.indexOf('<AuthPanel'), 'Not-now control must appear above the sign-in/create-account cards.')
const css1726 = read('app/globals.css')
assert.match(css1726, /RPG Your Way 1\.7\.26 account-entry cleanup/)
assert.match(css1726, /\.auth-dialog-footer \{ display: block; margin: 0 0 \.8rem; \}/)

console.log('RPG Your Way 1.7.26 account-entry cleanup checks passed.')


const css1727 = read('app/globals.css')
const header1727 = read('components/SiteHeader.tsx')
assert.match(css1727, /RPG Your Way 1\.7\.27 account dimensional pass \+ quiet-at-rest accents/)
assert.match(css1727, /\.account-main \.account-intro,[\s\S]*border: 2px solid var\(--rpgyw-brass-edge\) !important/)
assert.match(css1727, /\.account-main \.auth-card,[\s\S]*var\(--landing-mint-19\)/)
assert.match(css1727, /\.feature-card:nth-child\(2\) \.feature-eyebrow \{\s*color: var\(--cream-bright\);/)
assert.match(css1727, /\.kofi-support-button \{[\s\S]*color: var\(--lime\);/)
assert.match(css1727, /\.kofi-support-button:hover \{[\s\S]*color: var\(--lime\);/)
assert.match(header1727, /className="nav-external-arrow"/)
assert.match(header1727, />↗<\/span>/)
assert.match(header1727, /opens in a new tab/)

console.log('RPG Your Way 1.7.27 account styling, quiet accents, and Read external-link cue checks passed.')
