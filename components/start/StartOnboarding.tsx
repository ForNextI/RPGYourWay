'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  ShieldCheck,
  Sparkles,
  Upload,
  UsersRound,
  X,
} from 'lucide-react'
import { AI_AGE_BAND_STORAGE_KEY, type AiAgeBand } from '@/lib/site/ai-content-mode'

const RULESETS = [
  { id: 'dnd-5.5e-srd-5.2.1', label: 'D&D 5.5e', detail: '2024 rules · SRD 5.2.1', ready: true },
  { id: 'dnd-5e-srd-5.1', label: 'D&D 5e', detail: '2014 rules · SRD 5.1', ready: false },
  { id: 'dnd-3.5e-srd', label: 'D&D 3.5e', detail: 'Built-in SRD', ready: false },
  { id: 'pathfinder-2e-remaster', label: 'Pathfinder 2e', detail: 'Remaster rules', ready: false },
  { id: 'pathfinder-1e', label: 'Pathfinder 1e', detail: 'Built-in SRD', ready: false },
] as const

type RulesetId = (typeof RULESETS)[number]['id']
type ImportedStatus = 'ready-to-standardize' | 'standardizing' | 'ready'

type PartyMember = {
  id: string
  label: string
  className: string
  portraitUrl?: string
  starter?: boolean
  imported?: boolean
  status: ImportedStatus | 'ready'
  strength?: number
  intelligence?: number
  wisdom?: number
  charisma?: number
  maximumHitPoints?: number
}

const STARTERS: PartyMember[] = [
  { id: 'wardens-pc-starter-barbarian', label: 'Barbarian', className: 'Barbarian', portraitUrl: '/images/starter-characters/barbarian.webp', starter: true, status: 'ready', strength: 15, intelligence: 10, wisdom: 12, charisma: 8, maximumHitPoints: 15 },
  { id: 'wardens-pc-starter-bard', label: 'Bard', className: 'Bard', portraitUrl: '/images/starter-characters/bard.webp', starter: true, status: 'ready', strength: 8, intelligence: 14, wisdom: 10, charisma: 17, maximumHitPoints: 9 },
  { id: 'wardens-pc-starter-cleric', label: 'Cleric', className: 'Cleric', portraitUrl: '/images/starter-characters/cleric.webp', starter: true, status: 'ready', strength: 14, intelligence: 10, wisdom: 17, charisma: 12, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-druid', label: 'Druid', className: 'Druid', portraitUrl: '/images/starter-characters/druid.webp', starter: true, status: 'ready', strength: 8, intelligence: 13, wisdom: 17, charisma: 10, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-fighter', label: 'Fighter', className: 'Fighter', portraitUrl: '/images/starter-characters/fighter.webp', starter: true, status: 'ready', strength: 17, intelligence: 8, wisdom: 10, charisma: 12, maximumHitPoints: 12 },
  { id: 'wardens-pc-starter-monk', label: 'Monk', className: 'Monk', portraitUrl: '/images/starter-characters/monk.webp', starter: true, status: 'ready', strength: 12, intelligence: 10, wisdom: 14, charisma: 8, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-paladin', label: 'Paladin', className: 'Paladin', portraitUrl: '/images/starter-characters/paladin.webp', starter: true, status: 'ready', strength: 17, intelligence: 8, wisdom: 12, charisma: 14, maximumHitPoints: 13 },
  { id: 'wardens-pc-starter-ranger', label: 'Ranger', className: 'Ranger', portraitUrl: '/images/starter-characters/ranger.webp', starter: true, status: 'ready', strength: 12, intelligence: 8, wisdom: 14, charisma: 10, maximumHitPoints: 12 },
  { id: 'wardens-pc-starter-rogue', label: 'Rogue', className: 'Rogue', portraitUrl: '/images/starter-characters/rogue.webp', starter: true, status: 'ready', strength: 12, intelligence: 14, wisdom: 10, charisma: 8, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-sorcerer', label: 'Sorcerer', className: 'Sorcerer', portraitUrl: '/images/starter-characters/sorcerer.webp', starter: true, status: 'ready', strength: 10, intelligence: 8, wisdom: 13, charisma: 17, maximumHitPoints: 8 },
  { id: 'wardens-pc-starter-warlock', label: 'Warlock', className: 'Warlock', portraitUrl: '/images/starter-characters/warlock.webp', starter: true, status: 'ready', strength: 8, intelligence: 13, wisdom: 10, charisma: 17, maximumHitPoints: 9 },
  { id: 'wardens-pc-starter-wizard', label: 'Wizard', className: 'Wizard', portraitUrl: '/images/starter-characters/wizard.webp', starter: true, status: 'ready', strength: 8, intelligence: 17, wisdom: 14, charisma: 10, maximumHitPoints: 8 },
]

const DEFAULT_STARTER_IDS = [
  'wardens-pc-starter-fighter',
  'wardens-pc-starter-wizard',
  'wardens-pc-starter-cleric',
  'wardens-pc-starter-rogue',
]

const FAQ_ITEMS = [
  ['Do I need to know D&D or Pathfinder before I start?', 'No. You can learn while you play. The Game Master can explain rules when they matter, suggest possible actions, and offer choices when that helps.'],
  ['What are the game rules choices?', 'They tell RPG Your Way which rules framework to use. Every new campaign begins in The Uncharted Realms; there is no separate setting choice.'],
  ['What are ready-to-play characters?', 'They are complete D&D 5.5e characters that can begin immediately. The default party is Fighter, Wizard, Cleric, and Rogue, and you can replace any of them.'],
  ['What does importing a character do?', 'Importing gives RPG Your Way the source record. It has the file or pasted information, but it has not interpreted it yet.'],
  ['What does standardizing a character do?', 'Standardizing interprets the supplied record and puts the information into the consistent character structure RPG Your Way uses during play. Your original file is not changed.'],
  ['Does character import cost anything?', 'Importing a normal character is generally free. If a character record is unusually large or complex, standardizing it may require additional AI processing. RPG Your Way will tell you before any of your usage balance is used.'],
  ['Do I have to use four characters?', 'No. The four-character party is only the default. You can play with fewer characters or build a party of up to six.'],
  ['What is the party leader?', 'RPG Your Way recommends one character as the party leader using the party’s abilities. Leadership is optional, and you can change the recommendation or choose no active leader.'],
  ['Do I have to answer the campaign questions?', 'No. Skip them and RPG Your Way will use sensible defaults. Answer them when you want more control over tone, pacing, danger, story emphasis, and boundaries.'],
  ['When does paid gameplay usage begin?', 'Normal Play and Script AI processing use your account balance. Start-page help is free within its question limit. Ordinary character standardization is included; unusually demanding character records may require paid processing after you are told first.'],
] as const

const QUESTION_HELP = [
  'This controls how proactive the Game Master should be. A low number leaves more initiative with you; a high number keeps new events, complications, and opportunities arriving more often.',
  'These ratings tell the Game Master what kinds of play you want emphasized. Several categories can have the same score. A low score means “use sparingly,” not “never.”',
  'These settings control how strongly personal history matters, whether player-character romance is welcome, and how carefully marked secrets should be protected.',
  'This controls how dangerous combat should feel when combat happens. It does not control how often combat occurs.',
  'Use this for material you do not want in the campaign or want handled carefully. Site-wide safety rules still apply whether or not you add anything here.',
  'These ratings shape how quickly the opening moves, how strongly a long-term story develops, and how large or strange the campaign may eventually become. The setting is always The Uncharted Realms.',
] as const

function defaultParty() {
  return DEFAULT_STARTER_IDS.map((id) => STARTERS.find((starter) => starter.id === id)!).filter(Boolean)
}

function maxBy<T>(items: T[], score: (item: T) => number) {
  const maximum = Math.max(...items.map(score))
  return items.filter((item) => score(item) === maximum)
}

function recommendLeader(party: PartyMember[]) {
  const candidates = party.filter((member) =>
    [member.charisma, member.intelligence, member.wisdom, member.strength, member.maximumHitPoints].every((value) => typeof value === 'number'),
  )
  if (candidates.length !== party.length || candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const strongest = maxBy(candidates, (member) => member.strength!)
  const mentalCeiling = Math.max(...candidates.flatMap((member) => [member.charisma!, member.intelligence!, member.wisdom!]))
  if (strongest.length === 1 && strongest[0].strength! >= mentalCeiling + 5) return strongest[0]

  const charisma = maxBy(candidates, (member) => member.charisma!)
  if (charisma.length === 1) return charisma[0]
  const mental = maxBy(candidates, (member) => Math.max(member.intelligence!, member.wisdom!))
  if (mental.length === 1) return mental[0]
  const mentalCharisma = maxBy(mental, (member) => member.charisma!)
  if (mentalCharisma.length === 1) return mentalCharisma[0]
  const strength = maxBy(candidates, (member) => member.strength!)
  if (strength.length === 1) return strength[0]
  const strengthCharisma = maxBy(strength, (member) => member.charisma!)
  if (strengthCharisma.length === 1) return strengthCharisma[0]
  return maxBy(strengthCharisma, (member) => member.maximumHitPoints!)[0] ?? strengthCharisma[0]
}

function StartModal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="start-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section className={`start-modal${wide ? ' start-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="start-modal-heading">
          <h2>{title}</h2>
          <button type="button" className="start-modal-x" onClick={onClose} aria-label="Close"><X aria-hidden="true" /></button>
        </div>
        <div className="start-modal-body">{children}</div>
      </section>
    </div>
  )
}

export function StartOnboarding() {
  const [ageBand, setAgeBand] = useState<AiAgeBand | null>(null)
  const [ageReady, setAgeReady] = useState(false)
  const [ageModalOpen, setAgeModalOpen] = useState(false)
  const [modal, setModal] = useState<'faq' | 'ai-help' | 'starters' | 'starter-help' | 'import-help' | 'leader' | 'question-help' | null>(null)
  const [ruleset, setRuleset] = useState<RulesetId>('dnd-5.5e-srd-5.2.1')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [party, setParty] = useState<PartyMember[]>([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [questionMode, setQuestionMode] = useState<'pending' | 'answer' | 'skip' | 'complete'>('pending')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questionHelpIndex, setQuestionHelpIndex] = useState(0)
  const [campaignName, setCampaignName] = useState('')
  const [gmName, setGmName] = useState('')
  const [voice, setVoice] = useState<'fable' | 'marin'>('fable')
  const [leaderChoice, setLeaderChoice] = useState<string | 'none' | 'auto'>('auto')
  const [initiative, setInitiative] = useState(5)
  const [danger, setDanger] = useState(6)
  const [exclusions, setExclusions] = useState('')
  const [openingPace, setOpeningPace] = useState(3)
  const [storyDirection, setStoryDirection] = useState(5)
  const [campaignScale, setCampaignScale] = useState(7)
  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(AI_AGE_BAND_STORAGE_KEY)
    if (stored === 'adult' || stored === 'teen' || stored === 'under-13') {
      setAgeBand(stored)
    } else {
      setAgeModalOpen(true)
    }
    setAgeReady(true)
  }, [])

  useEffect(() => {
    if (!ruleset) return
    if (ruleset === 'dnd-5.5e-srd-5.2.1') {
      setParty((current) => current.length ? current : defaultParty())
    } else {
      setParty((current) => current.filter((member) => member.imported))
    }
    setLeaderChoice('auto')
  }, [ruleset])

  const recommendation = useMemo(() => recommendLeader(party), [party])
  const leader = leaderChoice === 'none'
    ? null
    : leaderChoice === 'auto'
      ? recommendation
      : party.find((member) => member.id === leaderChoice) ?? recommendation

  const partyReady = party.length > 0 && party.every((member) => member.status === 'ready')
  const questionsDone = questionMode === 'skip' || questionMode === 'complete'
  const namesReady = Boolean(campaignName.trim() && gmName.trim())
  const playReadyForEngine = ageBand !== 'under-13' && Boolean(ruleset) && partyReady && questionsDone && namesReady

  function chooseAge(next: AiAgeBand) {
    window.localStorage.setItem(AI_AGE_BAND_STORAGE_KEY, next)
    setAgeBand(next)
    setAgeModalOpen(false)
  }

  function importFiles(files: File[]) {
    const acceptedExtensions = /\.(pdf|json|xml|txt|md|markdown)$/i
    const allowed = files.filter((file) => file.size <= 8 * 1024 * 1024 && acceptedExtensions.test(file.name))
    const rejected = files.length - allowed.length
    const room = Math.max(0, 6 - party.length)
    const additions = allowed.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      label: file.name.replace(/\.[^.]+$/, '') || 'Imported character',
      className: 'Imported character',
      imported: true,
      status: 'ready-to-standardize' as const,
    }))
    setParty((current) => [...current, ...additions].slice(0, 6))
    if (rejected) setImportMessage(`${rejected} file${rejected === 1 ? '' : 's'} skipped. Use PDF, JSON, XML, TXT, or Markdown files no larger than 8 MB each.`)
    else if (allowed.length > room) setImportMessage(`Only ${room} more character${room === 1 ? '' : 's'} can be added. Maximum party size is 6.`)
    else setImportMessage('')
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    importFiles(Array.from(event.dataTransfer.files))
  }

  function addPastedCharacter() {
    if (!pasteText.trim() || party.length >= 6) return
    const firstLine = pasteText.trim().split(/\r?\n/).find(Boolean)?.slice(0, 60) || 'Pasted character'
    setParty((current) => [...current, {
      id: crypto.randomUUID(),
      label: firstLine,
      className: 'Pasted character',
      imported: true,
      status: 'ready-to-standardize' as const,
    }].slice(0, 6))
    setPasteText('')
    setPasteOpen(false)
  }

  function standardize(memberId: string) {
    setParty((current) => current.map((member) => member.id === memberId ? { ...member, status: 'standardizing' } : member))
    window.setTimeout(() => {
      setParty((current) => current.map((member) => member.id === memberId ? { ...member, status: 'ready' } : member))
    }, 700)
  }

  function standardizeAll() {
    const pending = party.filter((member) => member.status === 'ready-to-standardize').map((member) => member.id)
    if (!pending.length) return
    setParty((current) => current.map((member) => pending.includes(member.id) ? { ...member, status: 'standardizing' } : member))
    window.setTimeout(() => {
      setParty((current) => current.map((member) => pending.includes(member.id) ? { ...member, status: 'ready' } : member))
    }, 850)
  }

  function toggleStarter(id: string) {
    setParty((current) => {
      const exists = current.some((member) => member.id === id)
      if (exists) return current.filter((member) => member.id !== id)
      if (current.length >= 6) return current
      const starter = STARTERS.find((member) => member.id === id)
      return starter ? [...current, starter] : current
    })
  }

  function openQuestionHelp(index: number) {
    setQuestionHelpIndex(index)
    setModal('question-help')
  }

  if (!ageReady) return null

  return (
    <section className="start-onboarding" aria-label="Start a new campaign">
      {ageBand === 'under-13' ? (
        <>
          <div className="start-top-controls start-top-controls--under13">
            <button type="button" className="start-top-help" onClick={() => setModal('faq')}><CircleHelp aria-hidden="true" />I need help with all of this</button>
            <button type="button" className="start-top-help" onClick={() => setAgeModalOpen(true)}><ShieldCheck aria-hidden="true" />Change age settings</button>
          </div>
          <section className="start-step start-under13" aria-labelledby="under13-heading">
            <div className="start-step-nameplate"><span>Age</span>Age settings</div>
            <h2 id="under13-heading">AI gameplay is not available to users under 13.</h2>
            <p>You can change the age selection above if it was entered incorrectly.</p>
          </section>
        </>
      ) : (
        <>
          <div className="start-top-controls" aria-label="Start page controls">
            <button
              type="button"
              className="start-rules-toggle"
              aria-expanded={rulesOpen}
              aria-controls="start-rules-panel"
              onClick={() => setRulesOpen((open) => !open)}
            >
              <span>Choose the game rules</span>
              <small>{RULESETS.find((option) => option.id === ruleset)?.label ?? 'D&D 5.5e'}{ruleset === 'dnd-5.5e-srd-5.2.1' ? ' · Default' : ''}</small>
            </button>
            <button type="button" className="start-top-help" onClick={() => setModal('faq')}><CircleHelp aria-hidden="true" />I need help with all of this</button>
            <button type="button" className="start-top-help" onClick={() => setAgeModalOpen(true)}><ShieldCheck aria-hidden="true" />Change age settings</button>
          </div>

          {rulesOpen ? (
            <section className="start-rules-panel" id="start-rules-panel" aria-label="Choose the game rules">
              <div className="start-rules-grid">
                {RULESETS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`start-choice${ruleset === option.id ? ' start-choice--selected' : ''}`}
                    aria-pressed={ruleset === option.id}
                    onClick={() => setRuleset(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
              <p className="start-fixed-setting"><strong>Setting:</strong> The Uncharted Realms</p>
            </section>
          ) : null}

          {ruleset ? (
            <section className="start-step" aria-labelledby="party-heading">
              <div className="start-step-nameplate"><span>2</span>Choose your party</div>
              <div className="start-step-heading-row">
                <div>
                  <h2 id="party-heading">Your party</h2>
                  <p>{ruleset === 'dnd-5.5e-srd-5.2.1' ? 'The traditional four-character party is loaded. Keep it, change it, or mix in your own characters.' : 'Add your own characters for this ruleset. The current ready-to-play library uses D&D 5.5e.'}</p>
                </div>
                <button type="button" className="start-text-help" onClick={() => setModal('starter-help')}>About ready-to-play characters</button>
              </div>

              <div className="start-party-grid">
                {party.map((member) => (
                  <article className="start-party-card" key={member.id}>
                    {member.portraitUrl ? <Image src={member.portraitUrl} alt="" width={96} height={96} className="start-party-portrait" /> : <div className="start-party-placeholder"><FileText aria-hidden="true" /></div>}
                    <div className="start-party-card-copy">
                      <strong>{member.label}</strong>
                      <span>{member.className}</span>
                      {member.imported ? <small className={`start-status start-status--${member.status}`}>{member.status === 'ready-to-standardize' ? 'Imported — ready to standardize' : member.status === 'standardizing' ? 'Standardizing…' : 'Ready'}</small> : <small className="start-status start-status--ready">Ready</small>}
                    </div>
                    <div className="start-party-card-actions">
                      {member.status === 'ready-to-standardize' ? <button type="button" onClick={() => standardize(member.id)}>Standardize</button> : null}
                      <button type="button" aria-label={`Remove ${member.label}`} onClick={() => setParty((current) => current.filter((item) => item.id !== member.id))}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="start-character-actions">
                {ruleset === 'dnd-5.5e-srd-5.2.1' ? <button type="button" className="start-primary-control" onClick={() => setModal('starters')}><UsersRound aria-hidden="true" />Choose ready-to-play characters</button> : null}
                <button type="button" className="start-primary-control" onClick={() => fileRef.current?.click()} disabled={party.length >= 6}><Upload aria-hidden="true" />Browse for character files</button>
                <button type="button" className="start-primary-control" onClick={() => setPasteOpen((value) => !value)} disabled={party.length >= 6}><FileText aria-hidden="true" />Paste character information</button>
                <button type="button" className="start-text-help" onClick={() => setModal('import-help')}>Character import help</button>
              </div>
              <input ref={fileRef} className="sr-only" type="file" multiple accept=".pdf,.json,.xml,.txt,.md,text/plain,text/markdown,application/pdf,application/json,application/xml,text/xml" onChange={(event) => importFiles(Array.from(event.target.files ?? []))} />

              <div className="start-drop-zone" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
                <Upload aria-hidden="true" />
                <strong>Drag character files here</strong>
                <span>PDF · JSON · XML · TXT · Markdown · up to 8 MB per record</span>
              </div>

              {importMessage ? <p className="auth-message auth-message-error" role="alert">{importMessage}</p> : null}

              {pasteOpen ? (
                <div className="start-paste-panel">
                  <label>
                    <span>Paste character information</span>
                    <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={7} placeholder="Paste the character record here. Clear ordinary text is fine." />
                  </label>
                  <div className="start-inline-actions">
                    <button type="button" className="start-primary-control" onClick={addPastedCharacter}>Import pasted character</button>
                    <button type="button" className="start-secondary-control" onClick={() => setPasteOpen(false)}>Cancel</button>
                  </div>
                </div>
              ) : null}

              {party.some((member) => member.status === 'ready-to-standardize') ? (
                <div className="start-standardize-bar">
                  <div>
                    <strong>{party.filter((member) => member.status === 'ready-to-standardize').length === 1 ? 'Imported character ready.' : 'Imported characters ready.'}</strong>
                    <span>Import means RPG Your Way received it. Standardize means RPG Your Way understood it.</span>
                  </div>
                  <button type="button" className="start-primary-control" onClick={standardizeAll}>Standardize {party.filter((member) => member.status === 'ready-to-standardize').length === 1 ? 'for RPG Your Way' : 'these characters for RPG Your Way'}</button>
                </div>
              ) : null}
              <p className="start-preview-note">UI review build: character standardization demonstrates the interface states locally. No character information is sent to AI from this Start page yet.</p>

              {partyReady ? (
                <div className="start-leader-card">
                  <div className="start-leader-main">
                    <span>This is your leader</span>
                    <strong>{leader ? leader.label : leaderChoice === 'none' ? 'No active leader' : 'Recommendation pending'}</strong>
                  </div>
                  <div className="start-leader-controls">
                    <button type="button" className={leaderChoice === 'auto' ? 'is-selected' : ''} onClick={() => setLeaderChoice('auto')}>Keep</button>
                    <label>
                      <span className="sr-only">Change party leader</span>
                      <select value={leaderChoice !== 'auto' && leaderChoice !== 'none' ? leaderChoice : ''} onChange={(event) => event.target.value && setLeaderChoice(event.target.value)}>
                        <option value="">Change</option>
                        {party.map((member) => <option value={member.id} key={member.id}>{member.label}</option>)}
                      </select>
                    </label>
                    <button type="button" className={leaderChoice === 'none' ? 'is-selected' : ''} onClick={() => setLeaderChoice('none')}>None</button>
                  </div>
                  <button type="button" className="start-leader-explain" onClick={() => setModal('leader')}>How did we choose this leader?</button>
                </div>
              ) : null}
            </section>
          ) : null}

          {partyReady ? (
            <section className="start-step" aria-labelledby="questions-heading">
              <div className="start-step-nameplate"><span>3</span>Tell the Game Master what kind of campaign you want</div>
              {questionMode === 'pending' ? (
                <div className="start-question-choice" id="questions-heading">
                  <button type="button" className="start-primary-control start-big-control" onClick={() => { setQuestionMode('answer'); setQuestionIndex(0) }}>Answer the questions</button>
                  <button type="button" className="start-secondary-control start-big-control" onClick={() => setQuestionMode('skip')}>Skip the questions</button>
                </div>
              ) : questionMode === 'skip' ? (
                <div className="start-complete-plaque"><Sparkles aria-hidden="true" /><div><strong>Using the standard campaign defaults.</strong><span>You can change campaign guidance later.</span></div><button type="button" onClick={() => setQuestionMode('pending')}>Change</button></div>
              ) : questionMode === 'complete' ? (
                <div className="start-complete-plaque"><Sparkles aria-hidden="true" /><div><strong>Your campaign guidance is set.</strong><span>Six short questions answered.</span></div><button type="button" onClick={() => { setQuestionMode('answer'); setQuestionIndex(0) }}>Review</button></div>
              ) : (
                <div className="start-question-panel">
                  <div className="start-question-progress">Question {questionIndex + 1} of 6</div>
                  {questionIndex === 0 ? (
                    <>
                      <h2>How often should your Game Master introduce new events, complications, and opportunities?</h2>
                      <RatingControl value={initiative} onChange={setInitiative} low="Mostly follow my lead" high="Keep things coming" />
                    </>
                  ) : null}
                  {questionIndex === 1 ? <CampaignMix /> : null}
                  {questionIndex === 2 ? <CharacterPriorities /> : null}
                  {questionIndex === 3 ? (
                    <>
                      <h2>How dangerous should combat be?</h2>
                      <RatingControl value={danger} onChange={setDanger} low="Forgiving" high="Deadly consequences" />
                    </>
                  ) : null}
                  {questionIndex === 4 ? (
                    <>
                      <h2>What do you not want to appear in your game?</h2>
                      <textarea value={exclusions} onChange={(event) => setExclusions(event.target.value)} rows={6} placeholder="Anything else you want left out, kept offscreen, or handled carefully." />
                      <p className="start-question-note">Sexual assault and sexual or romantic content involving anyone under 18 are always excluded.</p>
                    </>
                  ) : null}
                  {questionIndex === 5 ? (
                    <>
                      <h2>How should the campaign grow?</h2>
                      <div className="start-rating-stack">
                        <RatingControl label="Opening pace" value={openingPace} onChange={setOpeningPace} low="Calm opening" high="Immediate danger" />
                        <RatingControl label="Long-term story" value={storyDirection} onChange={setStoryDirection} low="Mostly open" high="Strong story arc" />
                        <RatingControl label="Eventual scale" value={campaignScale} onChange={setCampaignScale} low="Grounded" high="Cosmic" />
                      </div>
                      <p className="start-fixed-setting"><strong>Setting:</strong> The Uncharted Realms</p>
                    </>
                  ) : null}
                  <div className="start-question-footer">
                    <button type="button" className="start-text-help" onClick={() => openQuestionHelp(questionIndex)}>Explain this question</button>
                    <div className="start-question-nav">
                      <button type="button" className="start-secondary-control" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))}><ChevronLeft aria-hidden="true" />Back</button>
                      <button type="button" className="start-primary-control" onClick={() => questionIndex === 5 ? setQuestionMode('complete') : setQuestionIndex((index) => Math.min(5, index + 1))}>{questionIndex === 5 ? 'Continue' : <>Next<ChevronRight aria-hidden="true" /></>}</button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          {questionsDone ? (
            <section className="start-step" aria-labelledby="names-heading">
              <div className="start-step-nameplate"><span>4</span>Name the campaign and Game Master</div>
              <div className="start-name-grid" id="names-heading">
                <label className="start-field"><span>Campaign name</span><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="The Sharn Chronicles" /></label>
                <label className="start-field"><span>AI Game Master name</span><input value={gmName} onChange={(event) => setGmName(event.target.value)} placeholder="Malcolm" /></label>
              </div>
              <div className="start-voice-row" role="group" aria-label="Game Master voice">
                <span>Game Master voice</span>
                <button type="button" className={voice === 'fable' ? 'is-selected' : ''} onClick={() => setVoice('fable')}>Male · Fable</button>
                <button type="button" className={voice === 'marin' ? 'is-selected' : ''} onClick={() => setVoice('marin')}>Female · Marin</button>
              </div>
            </section>
          ) : null}

          {namesReady && questionsDone ? (
            <section className="start-play-step" aria-label="Start playing">
              <button type="button" className="start-play-button" disabled aria-disabled="true">PLAY</button>
              <p>{playReadyForEngine ? 'The 1.8 onboarding interface is ready for UI review. Campaign creation will be wired underneath it next.' : 'Finish the required choices above.'}</p>
            </section>
          ) : null}
        </>
      )}

      {ageModalOpen ? (
        <StartModal title="Before you begin, which applies to you?" onClose={() => { if (ageBand) setAgeModalOpen(false) }}>
          <div className="start-age-choices">
            <button type="button" onClick={() => chooseAge('adult')}>I am 18 or older</button>
            <button type="button" onClick={() => chooseAge('teen')}>I am 13–17 and have permission from a parent or guardian</button>
            <button type="button" onClick={() => chooseAge('under-13')}>I am under 13</button>
          </div>
        </StartModal>
      ) : null}

      {modal === 'faq' ? (
        <StartModal title="I need help with all of this" onClose={() => setModal(null)} wide>
          <div className="start-faq-list">
            {FAQ_ITEMS.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
          <div className="start-faq-more">
            <strong>Still need help?</strong>
            <p>Start Page Help can answer questions about setting up your campaign.</p>
            <button type="button" className="start-primary-control" onClick={() => setModal('ai-help')}>My question wasn&apos;t above. I still need help.</button>
          </div>
        </StartModal>
      ) : null}

      {modal === 'ai-help' ? (
        <StartModal title="Start Page Help" onClose={() => setModal(null)}>
          <p className="start-modal-lede">Ask about the choices on this page or about getting a campaign started. Start Page Help will be limited to 25 free questions per onboarding session.</p>
          <div className="start-ai-preview">
            <label><span>Your question</span><textarea rows={5} placeholder="What do you want help with?" /></label>
            <button type="button" className="start-primary-control" disabled>Ask Start Page Help</button>
            <small>AI help will be connected after the 1.8 UI review. 25 questions available.</small>
          </div>
        </StartModal>
      ) : null}

      {modal === 'starter-help' ? (
        <StartModal title="About ready-to-play characters" onClose={() => setModal(null)}>
          <p>Ready-to-play characters are complete characters that can begin immediately.</p>
          <p>RPG Your Way starts with a balanced Fighter, Wizard, Cleric, and Rogue party. Keep them, replace them, choose different ready-to-play characters, or mix them with your own.</p>
          <p>The current ready-to-play library uses D&amp;D 5.5e rules.</p>
        </StartModal>
      ) : null}

      {modal === 'import-help' ? (
        <StartModal title="Character import help" onClose={() => setModal(null)} wide>
          <p>Import PDF, JSON, XML, TXT, or Markdown character records, or paste the character information directly. Files may be up to 8 MB.</p>
          <p>Clear ordinary text works well. The record does not need to follow a special template.</p>
          <p><strong>Imported characters are not interpreted until you choose Standardize for RPG Your Way.</strong></p>
          <p>Importing your character is generally free. If you have a large, complex character, standardizing it may require additional AI processing. If so, RPG Your Way will tell you before using part of your available usage balance.</p>
          <p>Character information is sent to the AI service when RPG Your Way standardizes or uses the character. Campaign records remain in the browser unless the campaign is exported.</p>
          <a className="start-inline-link" href="/downloads/rpgyourway-character-update-template-v2.txt" download>Download the blank plain-text character template</a>
          <a className="start-inline-link" href="/legal/privacy">Read the full Privacy information</a>
        </StartModal>
      ) : null}

      {modal === 'starters' ? (
        <StartModal title="Choose ready-to-play characters" onClose={() => setModal(null)} wide>
          <p className="start-modal-lede">Choose up to six. The current library uses D&amp;D 5.5e.</p>
          <div className="start-starter-grid">
            {STARTERS.map((starter) => {
              const selected = party.some((member) => member.id === starter.id)
              return (
                <button type="button" key={starter.id} className={`start-starter-choice${selected ? ' is-selected' : ''}`} onClick={() => toggleStarter(starter.id)} aria-pressed={selected}>
                  <Image src={starter.portraitUrl!} alt="" width={100} height={100} />
                  <strong>{starter.className}</strong>
                  <span>{selected ? 'In party' : 'Add'}</span>
                </button>
              )
            })}
          </div>
          <p className="start-party-count">Current party: {party.length} · Max party size: 6</p>
        </StartModal>
      ) : null}

      {modal === 'leader' ? (
        <StartModal title="How did we choose this leader?" onClose={() => setModal(null)} wide>
          <p>RPG Your Way uses Brett&apos;s homebrew leadership rule. Each numbered step starts again with the entire party.</p>
          <ol className="start-leader-rule">
            <li><strong>Charisma.</strong> If one character has the highest Charisma outright, that character leads. If the highest Charisma is tied, continue.</li>
            <li><strong>Intelligence or Wisdom.</strong> Start over with the whole party and compare each character&apos;s higher Intelligence or Wisdom score. If tied, Charisma breaks the tie.</li>
            <li><strong>Strength.</strong> Start over with the whole party again. Highest Strength wins. If tied, Charisma breaks the tie. If that still does not settle it, the tied characters fight for leadership.</li>
          </ol>
          <p><strong>Strength override:</strong> if one character&apos;s Strength is at least 5 points higher than the party&apos;s highest Charisma, Intelligence, or Wisdom score, that character leads instead.</p>
          <p>Leadership is a recommendation, not a requirement. You can choose another character or use no active leader.</p>
        </StartModal>
      ) : null}

      {modal === 'question-help' ? (
        <StartModal title={`Explain question ${questionHelpIndex + 1}`} onClose={() => setModal(null)}>
          <p>{QUESTION_HELP[questionHelpIndex]}</p>
        </StartModal>
      ) : null}
    </section>
  )
}

function RatingControl({ value, onChange, low, high, label }: { value: number; onChange: (value: number) => void; low: string; high: string; label?: string }) {
  return (
    <div className="start-rating-control">
      {label ? <strong>{label}</strong> : null}
      <div className="start-rating-scale">
        {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
          <button type="button" key={number} className={value === number ? 'is-selected' : ''} aria-pressed={value === number} onClick={() => onChange(number)}>{number}</button>
        ))}
      </div>
      <div className="start-rating-labels"><span>{low}</span><span>{high}</span></div>
    </div>
  )
}

function CampaignMix() {
  const topics = ['Humor', 'Serious drama', 'Exploration', 'Mystery', 'Social interaction', 'Combat', 'Tactical challenge', 'Politics and intrigue', 'Puzzles', 'NPC relationships']
  return (
    <>
      <h2>How much of each do you want in the campaign?</h2>
      <div className="start-mini-ratings">
        {topics.map((topic) => <label key={topic}><span>{topic}</span><select defaultValue="5" aria-label={`${topic} rating`}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>)}
      </div>
    </>
  )
}

function CharacterPriorities() {
  const topics = [
    ['Backstory influence', 7],
    ['Player-character romance', 1],
    ['Secret privacy', 10],
  ] as const
  return (
    <>
      <h2>How much should these character choices matter?</h2>
      <div className="start-mini-ratings start-mini-ratings--three">
        {topics.map(([topic, value]) => <label key={topic}><span>{topic}</span><select defaultValue={String(value)} aria-label={`${topic} rating`}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label>)}
      </div>
    </>
  )
}
