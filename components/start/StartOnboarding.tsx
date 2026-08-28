'use client'

import Image from 'next/image'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react'
import { START_FAQ } from '@/lib/start/help-knowledge'
import { useAccessibleDialog } from '@/components/accessibility/use-accessible-dialog'
import { AigmVoiceControls, type AigmVoiceControlsHandle } from '@/components/aigm/aigm-voice-controls'
import { AI_AGE_BAND_STORAGE_KEY, contentModeForAgeBand, type AiAgeBand } from '@/lib/site/ai-content-mode'
import {
  ADVENTURE_STORAGE_SCHEMA,
  CURRENT_ADVENTURE_KEY,
  emptyGameplayState,
  inferPlayName,
  type CampaignDirection,
  type CampaignMode,
  type CampaignScale,
  type SavedAdventureState,
  type StoredPartyCharacter,
} from '@/lib/aigm/campaign-storage'
import { loadAdventureState, saveAdventureState } from '@/lib/aigm/campaign-persistence'
import { CHARACTER_INTAKE_ANALYSIS_REVISION, CHARACTER_INTAKE_VERSION } from '@/lib/aigm/version'
import type { CharacterIntakeApiError, CharacterIntakeApiResponse, CharacterIntakeResult, CharacterIntakeSettings } from '@/lib/aigm/types'

const RULESETS = [
  { id: 'dnd-5.5e-srd-5.2.1', label: 'D&D 5.5e', detail: '2024 rules · SRD 5.2.1' },
  { id: 'dnd-5e-srd-5.1', label: 'D&D 5e', detail: '2014 rules · SRD 5.1' },
  { id: 'dnd-3.5e-srd', label: 'D&D 3.5e', detail: 'Built-in SRD' },
  { id: 'pathfinder-2e-remaster', label: 'Pathfinder 2e', detail: 'Remaster rules' },
  { id: 'pathfinder-1e', label: 'Pathfinder 1e', detail: 'Built-in SRD' },
] as const

type RulesetId = (typeof RULESETS)[number]['id']
type ImportStatus = 'ready' | 'file-added' | 'importing' | 'needs-required' | 'needs-recommended' | 'error'

type StartDialogueTurn = {
  id: string
  role: 'user' | 'assistant'
  text: string
  required?: Array<{ question: string; reason: string }>
  recommended?: Array<{ question: string; reason: string }>
}

type PartyMember = {
  id: string
  label: string
  className: string
  portraitUrl?: string
  starter?: boolean
  starterSlug?: string
  imported?: boolean
  status: ImportStatus
  file?: File
  result?: CharacterIntakeResult
  model?: string
  sourceText?: string
  sourceFileName?: string
  sourceMimeType?: string
  sourceFileKey?: string
  paidProcessing?: boolean
  error?: string
  clarificationConversation?: StartDialogueTurn[]
  strength?: number
  intelligence?: number
  wisdom?: number
  charisma?: number
  maximumHitPoints?: number
}

type StarterDefinition = PartyMember & { starter: true; starterSlug: string }

const STARTERS: StarterDefinition[] = [
  { id: 'wardens-pc-starter-barbarian', starterSlug: 'barbarian', label: 'Barbarian', className: 'Barbarian', portraitUrl: '/images/starter-characters/barbarian.webp', starter: true, status: 'ready', strength: 15, intelligence: 10, wisdom: 12, charisma: 8, maximumHitPoints: 15 },
  { id: 'wardens-pc-starter-bard', starterSlug: 'bard', label: 'Bard', className: 'Bard', portraitUrl: '/images/starter-characters/bard.webp', starter: true, status: 'ready', strength: 8, intelligence: 14, wisdom: 10, charisma: 17, maximumHitPoints: 9 },
  { id: 'wardens-pc-starter-cleric', starterSlug: 'cleric', label: 'Cleric', className: 'Cleric', portraitUrl: '/images/starter-characters/cleric.webp', starter: true, status: 'ready', strength: 14, intelligence: 10, wisdom: 17, charisma: 12, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-druid', starterSlug: 'druid', label: 'Druid', className: 'Druid', portraitUrl: '/images/starter-characters/druid.webp', starter: true, status: 'ready', strength: 8, intelligence: 13, wisdom: 17, charisma: 10, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-fighter', starterSlug: 'fighter', label: 'Fighter', className: 'Fighter', portraitUrl: '/images/starter-characters/fighter.webp', starter: true, status: 'ready', strength: 17, intelligence: 8, wisdom: 10, charisma: 12, maximumHitPoints: 12 },
  { id: 'wardens-pc-starter-monk', starterSlug: 'monk', label: 'Monk', className: 'Monk', portraitUrl: '/images/starter-characters/monk.webp', starter: true, status: 'ready', strength: 12, intelligence: 10, wisdom: 14, charisma: 8, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-paladin', starterSlug: 'paladin', label: 'Paladin', className: 'Paladin', portraitUrl: '/images/starter-characters/paladin.webp', starter: true, status: 'ready', strength: 17, intelligence: 8, wisdom: 12, charisma: 14, maximumHitPoints: 13 },
  { id: 'wardens-pc-starter-ranger', starterSlug: 'ranger', label: 'Ranger', className: 'Ranger', portraitUrl: '/images/starter-characters/ranger.webp', starter: true, status: 'ready', strength: 12, intelligence: 8, wisdom: 14, charisma: 10, maximumHitPoints: 12 },
  { id: 'wardens-pc-starter-rogue', starterSlug: 'rogue', label: 'Rogue', className: 'Rogue', portraitUrl: '/images/starter-characters/rogue.webp', starter: true, status: 'ready', strength: 12, intelligence: 14, wisdom: 10, charisma: 8, maximumHitPoints: 10 },
  { id: 'wardens-pc-starter-sorcerer', starterSlug: 'sorcerer', label: 'Sorcerer', className: 'Sorcerer', portraitUrl: '/images/starter-characters/sorcerer.webp', starter: true, status: 'ready', strength: 10, intelligence: 8, wisdom: 13, charisma: 17, maximumHitPoints: 8 },
  { id: 'wardens-pc-starter-warlock', starterSlug: 'warlock', label: 'Warlock', className: 'Warlock', portraitUrl: '/images/starter-characters/warlock.webp', starter: true, status: 'ready', strength: 8, intelligence: 13, wisdom: 10, charisma: 17, maximumHitPoints: 9 },
  { id: 'wardens-pc-starter-wizard', starterSlug: 'wizard', label: 'Wizard', className: 'Wizard', portraitUrl: '/images/starter-characters/wizard.webp', starter: true, status: 'ready', strength: 8, intelligence: 17, wisdom: 14, charisma: 10, maximumHitPoints: 8 },
]

const DEFAULT_STARTER_IDS = ['wardens-pc-starter-fighter', 'wardens-pc-starter-wizard', 'wardens-pc-starter-cleric', 'wardens-pc-starter-rogue']

const QUESTION_HELP = [
  'This controls how proactive the Game Master should be. A low number leaves more initiative with you; a high number keeps new events, complications, and opportunities arriving more often.',
  'These ratings tell the Game Master what kinds of play you want emphasized. Several categories can have the same score. A low score means “use sparingly,” not “never.”',
  'These settings control how strongly personal history matters, whether player-character romance is welcome, and how carefully marked secrets should be protected.',
  'This controls how dangerous combat should feel when combat happens. It does not control how often combat occurs.',
  'Use this for material you do not want in the campaign or want handled carefully. Site-wide safety rules still apply whether or not you add anything here.',
  'These ratings shape the opening pace, how strongly a long-term story develops, and how weird or reality-bending the campaign is allowed to become.',
] as const

const CAMPAIGN_TOPICS = ['Humor', 'Serious drama', 'Exploration', 'Mystery', 'Social interaction', 'Combat', 'Tactical challenge', 'Politics and intrigue', 'Puzzles', 'NPC relationships'] as const
const CHARACTER_TOPICS = ['Character backstory usage', 'Inter-party romance', 'Character secret reveals'] as const

function defaultParty() {
  return DEFAULT_STARTER_IDS.map((id) => STARTERS.find((starter) => starter.id === id)!).filter(Boolean)
}

function maxBy<T>(items: T[], score: (item: T) => number) {
  const maximum = Math.max(...items.map(score))
  return items.filter((item) => score(item) === maximum)
}

function recommendLeader(party: PartyMember[]) {
  const candidates = party.filter((member) => [member.charisma, member.intelligence, member.wisdom, member.strength, member.maximumHitPoints].every((value) => typeof value === 'number'))
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

function publicRulesetLabel(ruleset: RulesetId) {
  return RULESETS.find((option) => option.id === ruleset)?.label ?? 'D&D 5.5e'
}

function rulesetIdFromStoredLabel(label: string | undefined): RulesetId {
  const clean = (label || '').trim().toLowerCase()
  return RULESETS.find((option) => option.label.toLowerCase() === clean || option.id.toLowerCase() === clean)?.id ?? 'dnd-5.5e-srd-5.2.1'
}

function classSummary(result: CharacterIntakeResult) {
  return result.character.classes.map((entry) => `${entry.name} ${entry.level}`).join(' / ') || 'Character'
}

function assistantTurnFromCharacterResult(result: CharacterIntakeResult): StartDialogueTurn {
  const required = result.clarification_questions
    .filter((question) => question.priority === 'required')
    .map((question) => ({ question: question.question, reason: question.reason }))
  const recommended = result.clarification_questions
    .filter((question) => question.priority !== 'required')
    .map((question) => ({ question: question.question, reason: question.reason }))
  const fallback = required.length || recommended.length
    ? 'I found a few details worth resolving before this character is ready.'
    : 'That resolves the remaining questions. This character is ready.'
  return { id: crypto.randomUUID(), role: 'assistant', text: result.assistant_message?.trim() || fallback, required, recommended }
}

function narrationForTurn(turn: StartDialogueTurn) {
  const pieces = [turn.text]
  if (turn.required?.length) pieces.push(`Required before this character can be used. ${turn.required.map((question) => question.question).join(' ')}`)
  if (turn.recommended?.length) pieces.push(`Recommended before play. ${turn.recommended.map((question) => question.question).join(' ')}`)
  return pieces.filter(Boolean).join(' ')
}

function memberFromResult(member: PartyMember, payload: CharacterIntakeApiResponse & { paid_processing?: boolean }) : PartyMember {
  const result = payload.result
  const required = result.clarification_questions.some((question) => question.priority === 'required')
  const recommended = result.clarification_questions.some((question) => question.priority !== 'required')
  return {
    ...member,
    label: result.character.name || member.label,
    className: classSummary(result),
    status: required ? 'needs-required' : recommended ? 'needs-recommended' : 'ready',
    result,
    model: payload.model,
    sourceText: payload.source_text ?? member.sourceText ?? '',
    sourceFileName: member.file?.name || member.sourceFileName || `${member.label}.txt`,
    sourceMimeType: member.file?.type || member.sourceMimeType || 'text/plain',
    paidProcessing: Boolean(payload.paid_processing ?? member.paidProcessing),
    error: undefined,
    strength: result.character.ability_scores.strength,
    intelligence: result.character.ability_scores.intelligence,
    wisdom: result.character.ability_scores.wisdom,
    charisma: result.character.ability_scores.charisma,
    maximumHitPoints: result.character.hit_points.maximum,
  }
}

function StartModal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open: true, onClose, initialFocusRef: headingRef })

  return (
    <div className="start-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} className={`start-modal${wide ? ' start-modal--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={headingId}>
        <div className="start-modal-heading"><h2 ref={headingRef} tabIndex={-1} id={headingId}>{title}</h2><button type="button" className="start-modal-x" onClick={onClose} aria-label={`Close ${title}`}><X aria-hidden="true" /></button></div>
        <div className="start-modal-body">{children}</div>
      </section>
    </div>
  )
}

export function StartOnboarding({ mode = 'new-campaign', multiplayerCode = '' }: { mode?: 'new-campaign' | 'add-character'; multiplayerCode?: string }) {
  const [ageBand, setAgeBand] = useState<AiAgeBand | null>(null)
  const [ageReady, setAgeReady] = useState(false)
  const [ageModalOpen, setAgeModalOpen] = useState(false)
  const [modal, setModal] = useState<'faq' | 'ai-help' | 'starters' | 'import-help' | 'leader' | 'leader-change' | 'question-help' | 'character-questions' | 'character-review' | 'paid-import' | null>(null)
  const [ruleset, setRuleset] = useState<RulesetId>('dnd-5.5e-srd-5.2.1')
  const [rulesOpen, setRulesOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)
  const [party, setParty] = useState<PartyMember[]>([])
  const [existingAdventure, setExistingAdventure] = useState<SavedAdventureState | null>(null)
  const [existingAdventureLoading, setExistingAdventureLoading] = useState(mode === 'add-character')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null)
  const [clarificationText, setClarificationText] = useState('')
  const [clarificationBusy, setClarificationBusy] = useState(false)
  const [questionMode, setQuestionMode] = useState<'pending' | 'answer' | 'skip' | 'complete'>('pending')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [questionHelpIndex, setQuestionHelpIndex] = useState(0)
  const [campaignName, setCampaignName] = useState('')
  const [gmName, setGmName] = useState('')
  const [campaignMode, setCampaignMode] = useState<CampaignMode>('solo')
  const [leaderChoice, setLeaderChoice] = useState<string | 'none' | 'auto'>('auto')
  const [initiative, setInitiative] = useState(5)
  const [danger, setDanger] = useState(6)
  const [exclusions, setExclusions] = useState('')
  const [openingPace, setOpeningPace] = useState(3)
  const [storyDirection, setStoryDirection] = useState(5)
  const [campaignScale, setCampaignScale] = useState(7)
  const [campaignRatings, setCampaignRatings] = useState<Record<string, number>>(() => Object.fromEntries(CAMPAIGN_TOPICS.map((topic) => [topic, 5])))
  const [characterRatings, setCharacterRatings] = useState<Record<string, number>>({ 'Character backstory usage': 7, 'Inter-party romance': 1, 'Character secret reveals': 10 })
  const [helpQuestion, setHelpQuestion] = useState('')
  const [helpConversation, setHelpConversation] = useState<StartDialogueTurn[]>([])
  const [helpError, setHelpError] = useState('')
  const [helpBusy, setHelpBusy] = useState(false)
  const [helpCount, setHelpCount] = useState(0)
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [createError, setCreateError] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const helpVoiceRef = useRef<AigmVoiceControlsHandle | null>(null)
  const helpInputRef = useRef<HTMLTextAreaElement | null>(null)
  const helpEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(AI_AGE_BAND_STORAGE_KEY)
    if (stored === 'adult' || stored === 'teen' || stored === 'under-13') setAgeBand(stored)
    else setAgeModalOpen(true)
    const sessionHelp = Number(window.sessionStorage.getItem('rpgyw-start-help-count:v1') || 0)
    setHelpCount(Number.isFinite(sessionHelp) ? Math.max(0, Math.min(25, sessionHelp)) : 0)
    setAgeReady(true)
  }, [])

  useEffect(() => {
    if (mode !== 'add-character') return
    let cancelled = false
    async function restoreExistingAdventure() {
      const adventureId = window.localStorage.getItem(CURRENT_ADVENTURE_KEY) || ''
      const loaded = adventureId ? await loadAdventureState(window.localStorage, adventureId) : { state: null }
      if (cancelled) return
      const state = loaded.state
      setExistingAdventure(state)
      setExistingAdventureLoading(false)
      setParty([])
      if (state) setRuleset(rulesetIdFromStoredLabel(state.settings.ruleset))
      if (!state) setCreateError('No current campaign is selected. Return to Play or Start and choose a campaign first.')
      else if (state.characters.length >= 6) setCreateError('This campaign already has the maximum of six characters.')
    }
    void restoreExistingAdventure().catch(() => {
      if (!cancelled) {
        setExistingAdventureLoading(false)
        setCreateError('RPG Your Way could not load the current campaign for character addition.')
      }
    })
    return () => { cancelled = true }
  }, [mode])

  useEffect(() => {
    if (mode === 'add-character') {
      setParty((current) => current.filter((member) => member.imported || ruleset === 'dnd-5.5e-srd-5.2.1'))
      return
    }
    if (ruleset === 'dnd-5.5e-srd-5.2.1') setParty((current) => current.length ? current : defaultParty())
    else setParty((current) => current.filter((member) => member.imported))
    setLeaderChoice('auto')
  }, [ruleset, mode])

  const recommendation = useMemo(() => recommendLeader(party), [party])
  const leader = leaderChoice === 'none' ? null : leaderChoice === 'auto' ? recommendation : party.find((member) => member.id === leaderChoice) ?? recommendation
  const activeCharacter = activeCharacterId ? party.find((member) => member.id === activeCharacterId) ?? null : null
  const partyReady = party.length > 0 && party.every((member) => member.status === 'ready')
  const questionsDone = questionMode === 'skip' || questionMode === 'complete'
  const namesReady = Boolean(campaignName.trim() && gmName.trim())
  const playReadyForEngine = ageBand !== 'under-13' && partyReady && questionsDone && namesReady
  const importBusy = party.some((member) => member.status === 'importing') || clarificationBusy
  const activeImportWorkflow = party.find((member) => member.status === 'importing' || member.status === 'needs-required' || member.status === 'needs-recommended') ?? null
  const existingCharacterCount = mode === 'add-character' ? (existingAdventure?.characters.length ?? 0) : 0
  const totalPartyCount = existingCharacterCount + party.length
  const remainingPartySlots = Math.max(0, 6 - totalPartyCount)
  const existingStarterIds = useMemo(() => new Set(existingAdventure?.characters.map((character) => character.starterId).filter((value): value is string => Boolean(value)) ?? []), [existingAdventure])

  function chooseAge(next: AiAgeBand) {
    window.localStorage.setItem(AI_AGE_BAND_STORAGE_KEY, next)
    setAgeBand(next)
    setAgeModalOpen(false)
  }

  function sourceFileKey(file: File) {
    return `${file.name.toLowerCase()}::${file.size}::${file.lastModified}`
  }

  function addFiles(files: File[]) {
    const acceptedExtensions = /\.(pdf|json|xml|txt|md|markdown)$/i
    const allowed = files.filter((file) => file.size > 0 && file.size <= 8 * 1024 * 1024 && acceptedExtensions.test(file.name))
    const rejected = files.length - allowed.length
    const existingKeys = new Set(party.map((member) => member.sourceFileKey).filter((value): value is string => Boolean(value)))
    const uniqueFiles = allowed.filter((file) => !existingKeys.has(sourceFileKey(file)))
    const duplicates = allowed.length - uniqueFiles.length
    const room = Math.max(0, 6 - existingCharacterCount - party.length)
    const additions: PartyMember[] = uniqueFiles.slice(0, room).map((file) => ({
      id: crypto.randomUUID(), label: file.name.replace(/\.[^.]+$/, '') || 'Character file', className: file.name, imported: true, status: 'file-added', file, sourceFileName: file.name, sourceMimeType: file.type || 'application/octet-stream', sourceFileKey: sourceFileKey(file),
    }))
    setParty((current) => [...current, ...additions].slice(0, Math.max(0, 6 - existingCharacterCount)))
    if (rejected) setImportMessage(`${rejected} file${rejected === 1 ? '' : 's'} skipped. Use PDF, JSON, XML, TXT, or Markdown files no larger than 8 MB each.`)
    else if (duplicates) setImportMessage(`${duplicates} duplicate character file${duplicates === 1 ? ' was' : 's were'} already in the party and ${duplicates === 1 ? 'was' : 'were'} not added again.`)
    else if (uniqueFiles.length > room) setImportMessage(`Only ${room} more character${room === 1 ? '' : 's'} can be added. Maximum party size is 6.`)
    else setImportMessage('')
  }

  function addPastedCharacter() {
    const text = pasteText.trim()
    if (!text || totalPartyCount >= 6) return
    const firstLine = text.split(/\r?\n/).find(Boolean)?.slice(0, 60) || 'Pasted character'
    const file = new File([text], `${firstLine.replace(/[^a-z0-9 _-]+/gi, '').slice(0, 50) || 'Pasted character'}.txt`, { type: 'text/plain' })
    const addition: PartyMember = { id: crypto.randomUUID(), label: firstLine, className: 'Pasted character information', imported: true, status: 'file-added', file, sourceText: text, sourceFileName: file.name, sourceMimeType: 'text/plain' }
    setParty((current) => [...current, addition].slice(0, Math.max(0, 6 - existingCharacterCount)))
    setPasteText('')
    setPasteOpen(false)
  }

  function updateMember(memberId: string, updater: (member: PartyMember) => PartyMember) {
    setParty((current) => current.map((member) => member.id === memberId ? updater(member) : member))
  }

  function questionsFor(member: PartyMember) {
    const questions = member.result?.clarification_questions ?? []
    return { required: questions.filter((question) => question.priority === 'required'), recommended: questions.filter((question) => question.priority !== 'required') }
  }

  async function importCharacter(memberId: string, allowPaid = false) {
    const member = party.find((entry) => entry.id === memberId)
    if (!member?.file || importBusy) return
    const otherWorkflow = party.find((entry) => entry.id !== memberId && (entry.status === 'importing' || entry.status === 'needs-required' || entry.status === 'needs-recommended'))
    if (otherWorkflow) {
      setImportMessage(`Finish importing ${otherWorkflow.label} before starting another character.`)
      return
    }
    setImportMessage('')
    updateMember(memberId, (entry) => ({ ...entry, status: 'importing', error: undefined }))
    const form = new FormData()
    form.set('file', member.file)
    form.set('campaign_start_mode', 'new_fully_rested')
    form.set('dont_sweat_small_stuff', 'true')
    form.set('ruleset', publicRulesetLabel(ruleset))
    form.set('content_mode', contentModeForAgeBand(ageBand ?? 'adult'))
    if (allowPaid) form.set('allow_paid', 'true')
    try {
      const response = await fetch('/api/aigm/character-intake', { method: 'POST', body: form })
      const payload = await response.json() as (CharacterIntakeApiResponse & { paid_processing?: boolean }) | CharacterIntakeApiError
      if (!response.ok || !('result' in payload)) {
        if ((payload as CharacterIntakeApiError).code === 'paid_intake_confirmation_required') {
          updateMember(memberId, (entry) => ({ ...entry, status: 'file-added' }))
          setActiveCharacterId(memberId)
          setModal('paid-import')
          return
        }
        updateMember(memberId, (entry) => ({ ...entry, status: 'error', error: (payload as CharacterIntakeApiError).error || 'RPG Your Way could not import this character.' }))
        return
      }
      const hasQuestions = payload.result.clarification_questions.length > 0
      setParty((current) => current.map((entry) => {
        if (entry.id !== memberId) return entry
        const updated = memberFromResult(entry, payload)
        return hasQuestions
          ? { ...updated, clarificationConversation: [assistantTurnFromCharacterResult(payload.result)] }
          : updated
      }))
      setActiveCharacterId(memberId)
      setClarificationText('')
      if (hasQuestions) setModal('character-questions')
    } catch {
      updateMember(memberId, (entry) => ({ ...entry, status: 'error', error: 'The browser could not reach the character import service.' }))
    }
  }

  async function sendCharacterClarification() {
    const answer = clarificationText.trim()
    if (!activeCharacter?.result || !answer || clarificationBusy) return
    const characterId = activeCharacter.id
    const intake = activeCharacter.result
    const settings = activeCharacter.result.intake_settings
    const paidProcessing = Boolean(activeCharacter.paidProcessing)
    const userTurn: StartDialogueTurn = { id: crypto.randomUUID(), role: 'user', text: answer }
    updateMember(characterId, (entry) => ({ ...entry, clarificationConversation: [...(entry.clarificationConversation ?? []), userTurn], error: undefined }))
    setClarificationText('')
    setClarificationBusy(true)
    try {
      const response = await fetch('/api/aigm/character-clarify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake, settings, message: answer, content_mode: contentModeForAgeBand(ageBand ?? 'adult'), bill_usage: paidProcessing }),
      })
      const payload = await response.json() as CharacterIntakeApiResponse | CharacterIntakeApiError
      if (!response.ok || !('result' in payload)) {
        updateMember(characterId, (entry) => ({ ...entry, error: (payload as CharacterIntakeApiError).error || 'RPG Your Way could not process that answer.' }))
        return
      }
      updateMember(characterId, (entry) => {
        const updated = memberFromResult(entry, payload)
        return { ...updated, clarificationConversation: [...(entry.clarificationConversation ?? []), assistantTurnFromCharacterResult(payload.result)] }
      })
    } catch {
      updateMember(characterId, (entry) => ({ ...entry, error: 'The browser could not reach the character clarification service.' }))
    } finally {
      setClarificationBusy(false)
    }
  }

  function skipRecommended(memberId: string) {
    updateMember(memberId, (entry) => ({ ...entry, status: 'ready' }))
    setModal(null)
  }

  function toggleStarter(id: string) {
    setImportMessage('')
    setParty((current) => {
      const exists = current.some((member) => member.id === id)
      if (exists) return current.filter((member) => member.id !== id)
      if (existingStarterIds.has(id) || existingCharacterCount + current.length >= 6) return current
      const starter = STARTERS.find((member) => member.id === id)
      return starter ? [...current, starter] : current
    })
  }

  function removeMember(id: string) {
    setImportMessage('')
    setParty((current) => current.filter((member) => member.id !== id))
    if (activeCharacterId === id) { setActiveCharacterId(null); setModal(null) }
  }

  function openQuestionHelp(index: number) { setQuestionHelpIndex(index); setModal('question-help') }

  async function askStartHelp() {
    const question = helpQuestion.trim()
    if (!question || helpBusy || helpCount >= 25) return
    const userTurn: StartDialogueTurn = { id: crypto.randomUUID(), role: 'user', text: question }
    setHelpConversation((current) => [...current, userTurn])
    setHelpQuestion('')
    setHelpBusy(true)
    setHelpError('')
    helpVoiceRef.current?.prepareNarration()
    try {
      const response = await fetch('/api/start/help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) })
      const payload = await response.json() as { answer?: string; error?: string }
      if (!response.ok || !payload.answer) { setHelpError(payload.error || 'Start Page Help could not answer right now.'); return }
      const answer = payload.answer.trim()
      const next = Math.min(25, helpCount + 1)
      setHelpCount(next)
      window.sessionStorage.setItem('rpgyw-start-help-count:v1', String(next))
      setHelpConversation((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: answer }])
      helpVoiceRef.current?.beginNarration()
      helpVoiceRef.current?.finishNarration(answer)
      window.requestAnimationFrame(() => {
        helpEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        helpInputRef.current?.focus()
      })
    } catch { setHelpError('The browser could not reach Start Page Help.') }
    finally { setHelpBusy(false) }
  }

  function campaignDirectionFromRating(value: number): CampaignDirection { return value <= 3 ? 'mostly_open' : value >= 8 ? 'strong_arc' : 'gentle_story' }
  function campaignScaleFromRating(value: number): CampaignScale { return value <= 3 ? 'grounded' : value <= 5 ? 'occasionally_strange' : value >= 9 ? 'cosmic' : 'epic' }

  async function storedCharacterFor(member: PartyMember, leaderId: string | null): Promise<StoredPartyCharacter> {
    if (member.starter && member.starterSlug) {
      const response = await fetch(`/starter-characters/${member.starterSlug}.json`, { cache: 'force-cache' })
      if (!response.ok) throw new Error(`Could not load the ready-to-play ${member.className}.`)
      const payload = await response.json() as StoredPartyCharacter
      const result = { ...payload.result!, character: { ...payload.result!.character, is_current_party_active_leader: member.id === leaderId } }
      return { ...payload, id: member.id, portraitUrl: member.portraitUrl, starterId: member.id, status: 'ready', result, playName: payload.playName || inferPlayName(result), error: null, conversation: payload.conversation ?? [], fileFingerprint: payload.fileFingerprint || `starter:${member.starterSlug}` }
    }
    if (!member.result) throw new Error(`${member.label} has not been imported yet.`)
    const result = { ...member.result, character: { ...member.result.character, is_current_party_active_leader: member.id === leaderId } }
    return {
      id: member.id, sourceFileName: member.sourceFileName || member.file?.name || `${member.label}.txt`, fileFingerprint: `start:${member.id}`,
      status: 'ready', result, model: member.model || null, conversation: [], error: null, playName: inferPlayName(result),
      sourceText: member.sourceText || '', sourceMimeType: member.sourceMimeType || member.file?.type || 'text/plain', portraitUrl: member.portraitUrl,
    }
  }

  function setupAnswers() {
    if (questionMode === 'skip') return [
      'Game Master initiative: 5 out of 10.',
      'Campaign emphasis: balanced defaults.',
      'Character priorities: balanced defaults.',
      'Combat danger: 6 out of 10.',
      'No additional exclusions supplied.',
      `Ruleset: ${publicRulesetLabel(ruleset)}\nSetting: The Uncharted Realms\nOpening pace: 3 out of 10\nLong-term direction: 5 out of 10\nEventual scale / weirdness: 7 out of 10.`,
    ]
    return [
      `Game Master initiative: ${initiative} out of 10.`,
      `Campaign emphasis:\n${CAMPAIGN_TOPICS.map((topic) => `${topic}: ${campaignRatings[topic]} out of 10`).join('\n')}`,
      `Character priorities:\n${CHARACTER_TOPICS.map((topic) => `${topic}: ${characterRatings[topic]} out of 10`).join('\n')}`,
      `Combat danger: ${danger} out of 10.`,
      exclusions.trim() ? `Additional exclusions or handling notes: ${exclusions.trim()}` : 'No additional exclusions supplied.',
      `Ruleset: ${publicRulesetLabel(ruleset)}\nSetting: The Uncharted Realms\nOpening pace: ${openingPace} out of 10\nLong-term direction: ${storyDirection} out of 10\nEventual scale / weirdness: ${campaignScale} out of 10.`,
    ]
  }

  async function continueToPlay() {
    if (!playReadyForEngine || creatingCampaign) return
    setCreatingCampaign(true); setCreateError('')
    try {
      const leaderId = leader?.id ?? null
      const characters = await Promise.all(party.map((member) => storedCharacterFor(member, leaderId)))
      const now = new Date().toISOString()
      const adventureId = crypto.randomUUID()
      const settings: CharacterIntakeSettings = { campaign_start_mode: 'new_fully_rested', dont_sweat_small_stuff: true, ruleset: publicRulesetLabel(ruleset) }
      const state: SavedAdventureState = {
        storage_schema: ADVENTURE_STORAGE_SCHEMA, version: CHARACTER_INTAKE_VERSION, analysis_revision: CHARACTER_INTAKE_ANALYSIS_REVISION,
        adventure_id: adventureId, adventure_name: campaignName.trim(), game_master_name: gmName.trim().slice(0, 80), campaign_mode: campaignMode,
        campaign_direction: questionMode === 'skip' ? 'gentle_story' : campaignDirectionFromRating(storyDirection),
        campaign_scale: questionMode === 'skip' ? 'epic' : campaignScaleFromRating(campaignScale), lore_fidelity: 7,
        content_mode: contentModeForAgeBand(ageBand ?? 'adult'), created_at: now, updated_at: now, settings, characters,
        setup_answers: setupAnswers(), setup_conversation: [], general_conversation: [], stage: 'complete', gameplay: emptyGameplayState(),
        starter_defaults_seeded: party.some((member) => member.starter), party_choice_confirmed: true, character_assistance_level: 5,
      }
      await saveAdventureState(window.localStorage, state, null)
      window.localStorage.setItem(CURRENT_ADVENTURE_KEY, adventureId)
      window.location.assign('/play')
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'RPG Your Way could not create the campaign.')
      setCreatingCampaign(false)
    }
  }

  async function addCharactersToExistingCampaign() {
    if (mode !== 'add-character' || !existingAdventure || !partyReady || party.length === 0 || creatingCampaign) return
    if (existingAdventure.characters.length + party.length > 6) {
      setCreateError('RPG Your Way parties can contain no more than six characters.')
      return
    }
    setCreatingCampaign(true)
    setCreateError('')
    try {
      const additions = await Promise.all(party.map((member) => storedCharacterFor(member, null)))
      const nextState: SavedAdventureState = {
        ...existingAdventure,
        characters: [...existingAdventure.characters, ...additions],
        updated_at: new Date().toISOString(),
      }
      await saveAdventureState(window.localStorage, nextState, existingAdventure)
      window.localStorage.setItem(CURRENT_ADVENTURE_KEY, nextState.adventure_id)
      const playUrl = multiplayerCode ? `/play?multiplayer=${encodeURIComponent(multiplayerCode)}` : '/play'
      window.location.assign(playUrl)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'RPG Your Way could not add those characters to the campaign.')
      setCreatingCampaign(false)
    }
  }

  if (!ageReady) return null

  if (mode === 'add-character') {
    const currentPartyNames = existingAdventure?.characters.map((character) => character.playName || (character.result ? inferPlayName(character.result) : 'Character')) ?? []
    const playUrl = multiplayerCode ? `/play?multiplayer=${encodeURIComponent(multiplayerCode)}` : '/play'
    return (
      <section className="start-onboarding start-add-character-mode" aria-label="Add characters to the current campaign">
        <div className="start-add-character-header">
          <div>
            <p className="kicker">Existing campaign</p>
            <h1>Add another character</h1>
            {existingAdventure ? <p>Add one or more characters to <strong>{existingAdventure.adventure_name}</strong>. Everything already in the campaign stays exactly where it is.</p> : null}
          </div>
          <a className="start-info-control" href={playUrl}>Back to Play</a>
        </div>

        {existingAdventureLoading ? <p className="auth-message" role="status">Loading the current campaign…</p> : null}
        {createError ? <p className="auth-message auth-message-error" role="alert">{createError}</p> : null}

        {ageBand === 'under-13' ? (
          <section className="start-step start-under13"><div className="start-step-nameplate"><span>Age</span>Age settings</div><h2>AI character import is not available to users under 13.</h2><p>You can change the age selection if it was entered incorrectly.</p><button type="button" className="start-info-control" onClick={() => setAgeModalOpen(true)}>Change age settings</button></section>
        ) : existingAdventure && existingAdventure.characters.length < 6 ? (
          <section className="start-step start-party-step" aria-labelledby="add-party-heading">
            <div className="start-step-nameplate"><span>+</span>Add to Your Party</div>
            <div className="start-step-heading-row"><div><h2 id="add-party-heading">Choose the new character or characters</h2><p>Your current party remains untouched. Add ready-to-play characters, import your own records, or mix both.</p>{currentPartyNames.length ? <p className="start-party-note"><strong>Already in the campaign:</strong> {currentPartyNames.join(', ')}</p> : null}</div></div>

            <div className="start-character-actions start-character-actions--primary">
              <button type="button" className="start-primary-control" onClick={() => setModal('starters')} disabled={ruleset !== 'dnd-5.5e-srd-5.2.1' || remainingPartySlots === 0}>Choose from<br />ready-to-play characters</button>
              <button type="button" className="start-primary-control" onClick={() => fileRef.current?.click()} disabled={remainingPartySlots === 0}>And/or browse for<br />your character files</button>
              <button type="button" className="start-primary-control" onClick={() => setPasteOpen((open) => !open)} disabled={remainingPartySlots === 0}>And/or paste your<br />character&apos;s information</button>
            </div>
            <input ref={fileRef} className="sr-only" type="file" multiple tabIndex={-1} aria-hidden="true" accept=".pdf,.json,.xml,.txt,.md,.markdown,application/pdf,application/json,text/plain,text/markdown,application/xml,text/xml" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
            <div className="start-character-actions start-character-actions--secondary"><button type="button" className="start-info-control" onClick={() => setModal('import-help')}>Character import help</button></div>

            {pasteOpen ? <div className="start-paste-panel"><label><span>Paste your character&apos;s information, then add characters one at a time</span><textarea rows={7} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste the character record here." /></label><div className="start-inline-actions"><button type="button" className="start-primary-control" onClick={addPastedCharacter} disabled={!pasteText.trim() || totalPartyCount >= 6}>Add this character</button><button type="button" className="start-info-control" onClick={() => setPasteOpen(false)}>Cancel</button></div></div> : null}
            {importMessage ? <p className="auth-message" role="status">{importMessage}</p> : null}

            <div className="start-party-grid">
              {party.map((member) => (
                <article className="start-party-card" key={member.id}>
                  {member.portraitUrl ? <Image src={member.portraitUrl} alt="" width={96} height={96} className="start-party-portrait" /> : <div className="start-party-placeholder"><FileText aria-hidden="true" /></div>}
                  <div className="start-party-card-copy">
                    <strong>{member.label}</strong><span>{member.className}</span>
                    {member.imported ? <small className={`start-status start-status--${member.status}`} role="status">{member.status === 'file-added' ? 'File added' : member.status === 'importing' ? 'Importing…' : member.status === 'needs-required' ? 'Required answers needed' : member.status === 'needs-recommended' ? 'Recommended questions' : member.status === 'error' ? 'Import needs attention' : 'Ready'}</small> : <small className="start-status start-status--ready" role="status">Ready</small>}
                    {member.error ? <small className="start-card-error" role="alert">{member.error}</small> : null}
                  </div>
                  <div className="start-party-card-actions">
                    {member.status === 'file-added' || member.status === 'error' ? <button type="button" onClick={() => void importCharacter(member.id)} disabled={importBusy || Boolean(activeImportWorkflow && activeImportWorkflow.id !== member.id)}>Import into RPG Your Way</button> : null}
                    {member.status === 'needs-required' || member.status === 'needs-recommended' ? <button type="button" onClick={() => { setActiveCharacterId(member.id); setClarificationText(''); setModal('character-questions') }}>{member.status === 'needs-required' ? 'Answer required questions' : 'Review recommended questions'}</button> : null}
                    {member.imported && member.status === 'ready' && member.result ? <button type="button" onClick={() => { setActiveCharacterId(member.id); setModal('character-review') }}>Review</button> : null}
                    <button type="button" onClick={() => removeMember(member.id)} disabled={importBusy}>Remove</button>
                  </div>
                </article>
              ))}
            </div>

            <p className="start-party-count start-party-count--main">Current party: {totalPartyCount} · {remainingPartySlots} {remainingPartySlots === 1 ? 'place' : 'places'} remaining · Max party size: 6</p>
            {partyReady && party.length > 0 ? <div className="start-party-confirm"><button type="button" className="start-primary-control" disabled={creatingCampaign} onClick={() => void addCharactersToExistingCampaign()}>{creatingCampaign ? 'Adding characters…' : `Add ${party.length === 1 ? 'this character' : 'these characters'} and return to Play`}</button><p>{party.length} new {party.length === 1 ? 'character is' : 'characters are'} ready.</p></div> : null}
            {party.length ? <button type="button" className="start-reset-link" onClick={() => { if (window.confirm('Clear the characters you are adding?')) { setParty([]); setImportMessage('') } }}>Clear these additions</button> : null}
          </section>
        ) : null}

        {ageModalOpen ? <StartModal title="Before AI gameplay" onClose={() => { if (ageBand) setAgeModalOpen(false) }}><div className="start-age-choices"><button type="button" onClick={() => chooseAge('adult')}>I am 18 or older</button><button type="button" onClick={() => chooseAge('teen')}>I am 13–17 and have permission from a parent or guardian</button><button type="button" onClick={() => chooseAge('under-13')}>I am under 13</button></div></StartModal> : null}
        {modal === 'import-help' ? <StartModal title="Character import help" onClose={() => setModal(null)} wide><p>Add PDF, JSON, XML, TXT, or Markdown character records by browsing for the files, or paste the character information directly. Files may be up to 8 MB.</p><p>After the file is added, choose <strong>Import into RPG Your Way</strong>. RPG Your Way reads the record, converts it into the character structure used during play, and asks only clarifications worth resolving.</p><p>New characters enter the existing campaign fully rested. The current campaign, existing characters, transcript, settings, and story state are not reset.</p><p>Importing a normal character is generally free. If a character is unusually large or complex, RPG Your Way tells you before additional AI processing uses part of your available usage balance.</p><a className="start-inline-link" href="/downloads/rpgyourway-character-update-template-v2.txt" download>Download the blank plain-text character template</a><a className="start-inline-link" href="/legal/privacy">Read the full Privacy information</a></StartModal> : null}
        {modal === 'starters' ? <StartModal title="Add ready-to-play characters" onClose={() => setModal(null)} wide><p className="start-modal-lede">Choose any available characters up to the six-character party limit. These default characters are built for the D&amp;D 5.5e system.</p><div className="start-starter-grid">{STARTERS.map((starter) => { const selected = party.some((member) => member.id === starter.id); const alreadyPresent = existingStarterIds.has(starter.id); const disabled = alreadyPresent || (!selected && remainingPartySlots === 0); return <button type="button" key={starter.id} className={`start-starter-choice${selected ? ' is-selected' : ''}`} onClick={() => toggleStarter(starter.id)} aria-pressed={selected} disabled={disabled}><Image src={starter.portraitUrl!} alt="" width={100} height={100} /><strong>{starter.className}</strong><span>{alreadyPresent ? 'Already in party' : selected ? 'Adding' : 'Add'}</span></button> })}</div><p className="start-party-count">Current party: {totalPartyCount} · {remainingPartySlots} {remainingPartySlots === 1 ? 'place' : 'places'} remaining · Max party size: 6</p></StartModal> : null}
        {modal === 'paid-import' && activeCharacter ? <StartModal title="Additional AI processing" onClose={() => setModal(null)}><p>This character is unusually large or complex. Importing it requires additional AI processing and will use part of your available usage balance.</p><p>No usage will be deducted unless you continue.</p><div className="start-inline-actions"><button type="button" className="start-primary-control" onClick={() => { setModal(null); void importCharacter(activeCharacter.id, true) }}>Continue and use my balance</button><button type="button" className="start-info-control" onClick={() => setModal(null)}>Cancel</button></div></StartModal> : null}
        {modal === 'character-questions' && activeCharacter?.result ? <CharacterQuestionsModal member={activeCharacter} clarificationText={clarificationText} setClarificationText={setClarificationText} busy={clarificationBusy} onSend={() => void sendCharacterClarification()} onSkip={() => skipRecommended(activeCharacter.id)} onClose={() => setModal(null)} /> : null}
        {modal === 'character-review' && activeCharacter?.result ? <StartModal title={`Review ${activeCharacter.result.character.name}`} onClose={() => setModal(null)} wide><div className="start-review-summary">{activeCharacter.result.sheet_summary.map((line) => <p key={line}>{line}</p>)}</div>{activeCharacter.result.detected_issues.length ? <div className="start-review-notices"><h3>Notices</h3>{activeCharacter.result.detected_issues.map((issue, index) => <div className="start-question-card" key={`${issue.category}-${index}`}><strong>{issue.category}</strong><p>{issue.issue}</p><small>{issue.why_it_matters}</small></div>)}</div> : <p>No unresolved notices were recorded.</p>}</StartModal> : null}
      </section>
    )
  }

  return (
    <section className="start-onboarding" aria-label="Start a new campaign">
      {ageBand === 'under-13' ? (
        <>
          <div className="start-top-controls start-top-controls--under13">
            <button type="button" className="start-top-help" onClick={() => setModal('faq')}><CircleHelp aria-hidden="true" />I need help with all of this</button>
            <button type="button" className="start-top-help" onClick={() => setAgeModalOpen(true)}><ShieldCheck aria-hidden="true" />Change age settings</button>
          </div>
          <section className="start-step start-under13"><div className="start-step-nameplate"><span>Age</span>Age settings</div><h2>AI gameplay is not available to users under 13.</h2><p>You can change the age selection above if it was entered incorrectly.</p></section>
        </>
      ) : (
        <>
          {activeStep === 1 ? <section className="start-rules-step" aria-labelledby="rules-heading">
            <div className="start-step-nameplate start-step-nameplate--rules"><span>1</span><strong id="rules-heading">Choose the game system</strong></div>
            <div className="start-rules-card start-rules-card--single-step">
              <button type="button" className="start-rules-current start-rules-current--display" aria-expanded={rulesOpen} aria-controls="start-rules-panel" onClick={() => setRulesOpen((open) => !open)}><span className="start-rules-current-copy"><strong>{publicRulesetLabel(ruleset)}{ruleset === 'dnd-5.5e-srd-5.2.1' ? ' (default)' : ''}</strong><span>or choose a different one</span></span><span className="accordion-plus start-rules-accordion-plus" aria-hidden="true" /></button>
              {rulesOpen ? <div className="start-rules-panel" id="start-rules-panel"><div className="start-rules-grid">{RULESETS.map((option) => <button key={option.id} type="button" className={`start-choice${ruleset === option.id ? ' start-choice--selected' : ''}`} aria-pressed={ruleset === option.id} onClick={() => setRuleset(option.id)}><strong>{option.label}</strong><span>{option.detail}</span></button>)}</div></div> : null}
              <div className="start-rules-confirm">
                <button type="button" className="start-primary-control start-rules-confirm-button" onClick={() => { setRulesOpen(false); setActiveStep(2) }}>Use this game system</button>
                <p><strong>Selected:</strong> {publicRulesetLabel(ruleset)}</p>
              </div>
            </div>
          </section> : null}

          {activeStep === 2 ? <section className="start-step start-party-step" aria-labelledby="party-heading">
            <div className="start-step-nameplate"><span>2</span>Gather Your Party</div>
            <div className="start-step-heading-row"><div><h2 id="party-heading" className="sr-only">Gather Your Party</h2><p>{ruleset === 'dnd-5.5e-srd-5.2.1' ? 'Fighter, Wizard, Cleric, and Rogue are loaded. Keep them, change them, or mix in your own characters.' : 'Add your own characters for this ruleset. The current ready-to-play library uses D&D 5.5e.'}</p><p className="start-party-note">Names and portraits can be changed later on the Play page through the Characters sidebar.</p></div></div>
            <div className="start-character-actions start-character-actions--primary">
              <button type="button" className="start-primary-control" onClick={() => setModal('starters')} disabled={ruleset !== 'dnd-5.5e-srd-5.2.1'}>Choose from<br />ready-to-play characters</button>
              <button type="button" className="start-primary-control" onClick={() => fileRef.current?.click()}>And/or browse for<br />your character files</button>
              <button type="button" className="start-primary-control" onClick={() => setPasteOpen((open) => !open)}>And/or paste your<br />character&apos;s information</button>
            </div>
            <input ref={fileRef} className="sr-only" type="file" multiple tabIndex={-1} aria-hidden="true" accept=".pdf,.json,.xml,.txt,.md,.markdown,application/pdf,application/json,text/plain,text/markdown,application/xml,text/xml" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = '' }} />
            <div className="start-character-actions start-character-actions--secondary"><button type="button" className="start-info-control" onClick={() => setModal('import-help')}>Character import help</button></div>
            {pasteOpen ? <div className="start-paste-panel"><label><span>Paste your character&apos;s information, then add characters one at a time</span><textarea rows={7} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste the character record here." /></label><div className="start-inline-actions"><button type="button" className="start-primary-control" onClick={addPastedCharacter} disabled={!pasteText.trim() || totalPartyCount >= 6}>Add this character</button><button type="button" className="start-info-control" onClick={() => setPasteOpen(false)}>Cancel</button></div></div> : null}
            {importMessage ? <p className="auth-message" role="status">{importMessage}</p> : null}

            <div className="start-party-grid">
              {party.map((member) => (
                <article className="start-party-card" key={member.id}>
                  {member.portraitUrl ? <Image src={member.portraitUrl} alt="" width={96} height={96} className="start-party-portrait" /> : <div className="start-party-placeholder"><FileText aria-hidden="true" /></div>}
                  <div className="start-party-card-copy">
                    <strong>{member.label}</strong><span>{member.className}</span>
                    {member.imported ? <small className={`start-status start-status--${member.status}`} role="status">{member.status === 'file-added' ? 'File added' : member.status === 'importing' ? 'Importing…' : member.status === 'needs-required' ? 'Required answers needed' : member.status === 'needs-recommended' ? 'Recommended questions' : member.status === 'error' ? 'Import needs attention' : 'Ready'}</small> : <small className="start-status start-status--ready" role="status">Ready</small>}
                    {member.error ? <small className="start-card-error" role="alert">{member.error}</small> : null}
                  </div>
                  <div className="start-party-card-actions">
                    {member.status === 'file-added' || member.status === 'error' ? <button type="button" onClick={() => void importCharacter(member.id)} disabled={importBusy || Boolean(activeImportWorkflow && activeImportWorkflow.id !== member.id)}>Import into RPG Your Way</button> : null}
                    {member.status === 'needs-required' || member.status === 'needs-recommended' ? <button type="button" onClick={() => { setActiveCharacterId(member.id); setClarificationText(''); setModal('character-questions') }}>{member.status === 'needs-required' ? 'Answer required questions' : 'Review recommended questions'}</button> : null}
                    {member.imported && member.status === 'ready' && member.result ? <button type="button" onClick={() => { setActiveCharacterId(member.id); setModal('character-review') }}>Review</button> : null}
                    <button type="button" onClick={() => removeMember(member.id)} disabled={importBusy}>Remove</button>
                  </div>
                </article>
              ))}
            </div>

            <p className="start-party-count start-party-count--main">Current party: {totalPartyCount} · {remainingPartySlots} {remainingPartySlots === 1 ? 'place' : 'places'} remaining · Max party size: 6</p>
            {partyReady ? <div className="start-party-confirm"><button type="button" className="start-primary-control" onClick={() => { setImportMessage(''); setActiveStep(3) }}>Use this party</button><p>{party.length} {party.length === 1 ? 'character is' : 'characters are'} ready.</p></div> : null}
            <button type="button" className="start-reset-link" onClick={() => { if (window.confirm('Reset this setup and start again?')) window.location.reload() }}>Or reset everything and start again</button>
          </section> : null}

          {activeStep === 3 && partyReady ? <section className="start-step start-settings-step" aria-labelledby="questions-heading">
            <div className="start-step-nameplate"><span>3</span>Adjustable gameplay settings</div>
            <div className={questionMode === 'answer' ? 'start-settings-bezel' : 'start-settings-body'}>
              {questionMode === 'pending' ? <div className="start-question-choice" id="questions-heading"><button type="button" className="start-primary-control start-big-control" onClick={() => { setQuestionMode('answer'); setQuestionIndex(0) }}>Customize</button><button type="button" className="start-info-control start-big-control" onClick={() => setQuestionMode('skip')}>Use default settings</button></div> : questionMode === 'skip' ? <div className="start-complete-plaque"><Sparkles aria-hidden="true" /><div><strong>Using the default gameplay settings.</strong><span>You can still change campaign guidance later.</span></div><button type="button" onClick={() => setQuestionMode('pending')}>Change</button></div> : questionMode === 'complete' ? <div className="start-complete-plaque"><Sparkles aria-hidden="true" /><div><strong>Your campaign guidance is set.</strong><span>Six short questions answered.</span></div><button type="button" onClick={() => { setQuestionMode('answer'); setQuestionIndex(0) }}>Review</button></div> : <div className="start-question-panel">
                <div className="start-question-progress">Question {questionIndex + 1} of 6</div>
                {questionIndex === 0 ? <><h2>How often should your Game Master introduce new events, complications, and opportunities?</h2><RatingControl ariaLabel="Game Master initiative frequency" value={initiative} onChange={setInitiative} low="Mostly follow my lead" high="Keep things coming" /></> : null}
                {questionIndex === 1 ? <CampaignMix values={campaignRatings} onChange={(topic, value) => setCampaignRatings((current) => ({ ...current, [topic]: value }))} /> : null}
                {questionIndex === 2 ? <CharacterPriorities values={characterRatings} onChange={(topic, value) => setCharacterRatings((current) => ({ ...current, [topic]: value }))} /> : null}
                {questionIndex === 3 ? <><h2>How dangerous should combat be?</h2><RatingControl ariaLabel="Combat danger" value={danger} onChange={setDanger} low="Forgiving" high="Deadly consequences" /></> : null}
                {questionIndex === 4 ? <><h2>What do you not want to appear in your game?</h2><textarea className="start-question-textarea" aria-label="Content to exclude or handle carefully" value={exclusions} onChange={(event) => setExclusions(event.target.value)} rows={3} placeholder="Anything else you want left out, kept offscreen, or handled carefully." /><p className="start-question-note">Sexual assault and sexual or romantic content involving anyone under 18 are always excluded.</p></> : null}
                {questionIndex === 5 ? <><h2>How should the campaign grow?</h2><div className="start-rating-stack"><RatingControl label="Opening pace" value={openingPace} onChange={setOpeningPace} low="Calm opening" high="Immediate danger" /><RatingControl label="Long-term story direction" value={storyDirection} onChange={setStoryDirection} low="Mostly open-ended" high="Strong escalating campaign arc" /><RatingControl label="How weird do you want your campaign to get?" value={campaignScale} onChange={setCampaignScale} low="Grounded and local" high="Reality-bending and cosmic" /></div></> : null}
                <div className="start-question-footer"><button type="button" className="start-text-help" onClick={() => openQuestionHelp(questionIndex)}>Explain this question</button><div className="start-question-nav"><button type="button" className="start-secondary-control" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))}><ChevronLeft aria-hidden="true" />Back</button><button type="button" className="start-primary-control" onClick={() => questionIndex === 5 ? setQuestionMode('complete') : setQuestionIndex((index) => Math.min(5, index + 1))}>{questionIndex === 5 ? 'Continue' : <>Next<ChevronRight aria-hidden="true" /></>}</button></div></div>
              </div>}
            </div>
            {questionsDone ? <div className="start-settings-leader"><div className="start-leader-card"><div className="start-leader-main"><span>Proposed party leader:</span><strong>{leader?.label ?? 'None'}</strong></div><div className="start-leader-controls"><button type="button" onClick={() => setModal('leader-change')}>Change</button><button type="button" className={leaderChoice === 'none' ? 'is-selected' : ''} aria-pressed={leaderChoice === 'none'} onClick={() => setLeaderChoice('none')}>None</button></div><button type="button" className="start-leader-explain" onClick={() => setModal('leader')}>How did we choose this leader?</button></div><button type="button" className="start-primary-control start-step-continue" onClick={() => setActiveStep(4)}>Continue</button></div> : null}
            <button type="button" className="start-reset-link" onClick={() => { if (window.confirm('Reset this setup and start again?')) window.location.reload() }}>Or reset everything and start again</button>
          </section> : null}

          {activeStep === 4 && questionsDone ? <section className="start-step" aria-labelledby="names-heading"><div className="start-step-nameplate"><span>4</span><strong id="names-heading">The naming of the names</strong></div><div className="start-name-grid"><label className="start-field"><span className="sr-only">Campaign name</span><span className="start-field-bezel"><input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Descriptive campaign name here — have fun" /></span></label><label className="start-field"><span className="sr-only">Game Master name</span><span className="start-field-bezel"><input value={gmName} onChange={(event) => setGmName(event.target.value)} placeholder="Game Master name" /></span></label></div><div className="start-question-block"><div className="start-question-heading"><div><span className="start-question-number">Cloud</span><strong>How are you playing?</strong></div></div><div className="start-rules-grid"><button type="button" className={`start-choice${campaignMode === 'solo' ? ' is-selected' : ''}`} aria-pressed={campaignMode === 'solo'} onClick={() => setCampaignMode('solo')}><strong>Solo</strong><span>Just me. This campaign saves to my account and follows me between signed-in devices.</span></button><button type="button" className={`start-choice${campaignMode === 'multiplayer' ? ' is-selected' : ''}`} aria-pressed={campaignMode === 'multiplayer'} onClick={() => setCampaignMode('multiplayer')}><strong>Multiplayer</strong><span>Shared campaign. Create it in the cloud now, then invite other players from the campaign.</span></button></div></div></section> : null}
          {activeStep === 4 && questionsDone ? <section className="start-play-step" aria-label="Continue to Play"><button type="button" className="start-play-button" disabled={!namesReady || !playReadyForEngine || creatingCampaign} onClick={() => void continueToPlay()}>{creatingCampaign ? 'Creating campaign…' : 'Onward'}</button>{createError ? <p className="auth-message auth-message-error" role="alert">{createError}</p> : null}</section> : null}
          {activeStep === 4 && questionsDone ? <button type="button" className="start-reset-link" onClick={() => { if (window.confirm('Reset this setup and start again?')) window.location.reload() }}>Or reset everything and start again</button> : null}
        </>
      )}

      {ageModalOpen ? <StartModal title="Before you begin, which applies to you?" onClose={() => { if (ageBand) setAgeModalOpen(false) }}><div className="start-age-choices"><button type="button" onClick={() => chooseAge('adult')}>I am 18 or older</button><button type="button" onClick={() => chooseAge('teen')}>I am 13–17 and have permission from a parent or guardian</button><button type="button" onClick={() => chooseAge('under-13')}>I am under 13</button></div></StartModal> : null}
      {modal === 'faq' ? <StartModal title="I need help with all of this" onClose={() => setModal(null)} wide><div className="start-faq-list">{START_FAQ.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div><div className="start-faq-more"><strong>Still need help?</strong><p>Start Page Help can answer questions about setting up your campaign.</p><button type="button" className="start-primary-control" onClick={() => setModal('ai-help')}>My question wasn&apos;t above. I still need help.</button></div></StartModal> : null}
      {modal === 'ai-help' ? <StartModal title="Start Page Help" onClose={() => setModal(null)} wide><p className="start-modal-lede">Ask about the choices on this page or about getting a campaign started. You have {Math.max(0, 25 - helpCount)} of 25 free questions remaining in this onboarding session.</p><div className="start-ai-dialogue" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Start Page Help conversation">{helpConversation.map((turn) => <div key={turn.id} className={`start-ai-turn start-ai-turn--${turn.role}`}><strong>{turn.role === 'assistant' ? 'Start Page Help' : 'You'}</strong><p>{turn.text}</p>{turn.role === 'assistant' ? <button type="button" data-aigm-manual-listen="true" className="start-listen-link" onClick={() => helpVoiceRef.current?.replay(turn.text)}><Volume2 aria-hidden="true" />Listen</button> : null}</div>)}{helpBusy ? <div className="start-ai-turn start-ai-turn--assistant"><strong>Start Page Help</strong><p>Thinking…</p></div> : null}<div ref={helpEndRef} /></div><div className="start-ai-composer"><label><span>Your question</span><span className="start-field-bezel"><textarea ref={helpInputRef} rows={4} value={helpQuestion} onChange={(event) => setHelpQuestion(event.target.value)} placeholder="What do you want help with?" /></span></label><div className="start-ai-composer-actions"><AigmVoiceControls ref={helpVoiceRef} profile="onboarding" assistantName="Start Page Help" currentMessage={helpQuestion} onTranscriptUpdate={setHelpQuestion} onError={setHelpError} disabled={helpBusy || helpCount >= 25} /><button type="button" className="start-primary-control" disabled={!helpQuestion.trim() || helpBusy || helpCount >= 25} onClick={() => void askStartHelp()}>{helpBusy ? 'Checking…' : 'Ask Start Page Help'}</button></div>{helpError ? <p className="auth-message auth-message-error" role="alert">{helpError}</p> : null}<small>{Math.max(0, 25 - helpCount)} questions remaining.</small></div></StartModal> : null}
      {modal === 'import-help' ? <StartModal title="Character import help" onClose={() => setModal(null)} wide><p>Add PDF, JSON, XML, TXT, or Markdown character records by browsing for the files, or paste the character information directly. Files may be up to 8 MB.</p><p>After the file is added, choose <strong>Import into RPG Your Way</strong>. RPG Your Way will read the record, convert it into the character structure used during play, and ask only the clarifications that are worth resolving.</p><p><strong>New campaign</strong> and <strong>Don&apos;t sweat the small stuff</strong> are applied automatically. New campaign starts the character fully rested. Don&apos;t sweat the small stuff assumes ordinary inexpensive class necessities while still tracking consequential equipment and priced or consumed components.</p><p>Importing a normal character is generally free. If a character is unusually large or complex, RPG Your Way will tell you before additional AI processing uses part of your available usage balance.</p><p>Names and portraits can be changed later on the Play page through the Characters sidebar.</p><p>Character information is sent to the AI service when RPG Your Way imports or uses the character. Signed-in campaigns are saved automatically to your RPG Your Way account. Browser storage is used only as a local cache and legacy-import bridge.</p><a className="start-inline-link" href="/downloads/rpgyourway-character-update-template-v2.txt" download>Download the blank plain-text character template</a><a className="start-inline-link" href="/legal/privacy">Read the full Privacy information</a></StartModal> : null}
      {modal === 'starters' ? <StartModal title="Choose these ready-to-play characters" onClose={() => setModal(null)} wide><p className="start-modal-lede">Choose up to six. These default characters are built for the D&amp;D 5.5e system.</p><div className="start-starter-grid">{STARTERS.map((starter) => { const selected = party.some((member) => member.id === starter.id); return <button type="button" key={starter.id} className={`start-starter-choice${selected ? ' is-selected' : ''}`} onClick={() => toggleStarter(starter.id)} aria-pressed={selected}><Image src={starter.portraitUrl!} alt="" width={100} height={100} /><strong>{starter.className}</strong><span>{selected ? 'In party' : 'Add'}</span></button> })}</div><p className="start-party-count">Current party: {totalPartyCount} · {remainingPartySlots} {remainingPartySlots === 1 ? 'place' : 'places'} remaining · Max party size: 6</p></StartModal> : null}
      {modal === 'paid-import' && activeCharacter ? <StartModal title="Additional AI processing" onClose={() => setModal(null)}><p>This character is unusually large or complex. Importing it requires additional AI processing and will use part of your available usage balance.</p><p>No usage will be deducted unless you continue.</p><div className="start-inline-actions"><button type="button" className="start-primary-control" onClick={() => { setModal(null); void importCharacter(activeCharacter.id, true) }}>Continue and use my balance</button><button type="button" className="start-info-control" onClick={() => setModal(null)}>Cancel</button></div></StartModal> : null}
      {modal === 'character-questions' && activeCharacter?.result ? <CharacterQuestionsModal member={activeCharacter} clarificationText={clarificationText} setClarificationText={setClarificationText} busy={clarificationBusy} onSend={() => void sendCharacterClarification()} onSkip={() => skipRecommended(activeCharacter.id)} onClose={() => setModal(null)} /> : null}
      {modal === 'character-review' && activeCharacter?.result ? <StartModal title={`Review ${activeCharacter.result.character.name}`} onClose={() => setModal(null)} wide><div className="start-review-summary">{activeCharacter.result.sheet_summary.map((line) => <p key={line}>{line}</p>)}</div>{activeCharacter.result.detected_issues.length ? <div className="start-review-notices"><h3>Notices</h3>{activeCharacter.result.detected_issues.map((issue, index) => <div className="start-question-card" key={`${issue.category}-${index}`}><strong>{issue.category}</strong><p>{issue.issue}</p><small>{issue.why_it_matters}</small></div>)}</div> : <p>No unresolved notices were recorded.</p>}<p className="start-modal-lede">Names and portraits can be changed later on the Play page through the Characters sidebar.</p></StartModal> : null}
      {modal === 'leader-change' ? <StartModal title="Change party leader" onClose={() => setModal(null)}><div className="start-leader-choice-list">{party.map((member) => <button type="button" className="start-primary-control" key={member.id} onClick={() => { setLeaderChoice(member.id === recommendation?.id ? 'auto' : member.id); setModal(null) }}>{member.label}{member.id === recommendation?.id ? ' — proposed' : ''}</button>)}</div></StartModal> : null}
      {modal === 'leader' ? <StartModal title="How did we choose this leader?" onClose={() => setModal(null)} wide><p>RPG Your Way uses Brett&apos;s homebrew leadership rule. Each numbered step starts again with the entire party.</p><ol className="start-leader-rule"><li><strong>Charisma.</strong> If one character has the highest Charisma outright, that character leads. If the highest Charisma is tied, continue.</li><li><strong>Intelligence or Wisdom.</strong> Start over with the whole party and compare each character&apos;s higher Intelligence or Wisdom score. If tied, Charisma breaks the tie.</li><li><strong>Strength.</strong> Start over with the whole party again. Highest Strength wins. If tied, Charisma breaks the tie. If that still does not settle it, the tied characters fight for leadership.</li></ol><p><strong>Strength override:</strong> if one character&apos;s Strength is at least 5 points higher than the party&apos;s highest Charisma, Intelligence, or Wisdom score, that character leads instead.</p><p>Leadership is a recommendation, not a requirement. You can choose another character or use no active leader.</p></StartModal> : null}
      {modal === 'question-help' ? <StartModal title={`Explain question ${questionHelpIndex + 1}`} onClose={() => setModal(null)}><p>{QUESTION_HELP[questionHelpIndex]}</p></StartModal> : null}
    </section>
  )
}

function CharacterQuestionsModal({ member, clarificationText, setClarificationText, busy, onSend, onSkip, onClose }: { member: PartyMember; clarificationText: string; setClarificationText: (value: string) => void; busy: boolean; onSend: () => void; onSkip: () => void; onClose: () => void }) {
  const questions = member.result?.clarification_questions ?? []
  const required = questions.filter((question) => question.priority === 'required')
  const recommended = questions.filter((question) => question.priority !== 'required')
  const fallbackTurn = useMemo(() => member.result ? assistantTurnFromCharacterResult(member.result) : null, [member.result])
  const conversation = member.clarificationConversation?.length ? member.clarificationConversation : fallbackTurn ? [fallbackTurn] : []
  const voiceRef = useRef<AigmVoiceControlsHandle | null>(null)
  const answerRef = useRef<HTMLTextAreaElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const lastSpokenIdRef = useRef<string | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const lastAssistant = [...conversation].reverse().find((turn) => turn.role === 'assistant') ?? null

  useEffect(() => {
    if (!lastAssistant || lastSpokenIdRef.current === lastAssistant.id) return
    lastSpokenIdRef.current = lastAssistant.id
    const frame = window.requestAnimationFrame(() => {
      voiceRef.current?.prepareNarration()
      voiceRef.current?.beginNarration()
      voiceRef.current?.finishNarration(narrationForTurn(lastAssistant))
      endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      if (questions.length) answerRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [lastAssistant?.id, questions.length])

  return <StartModal title={`Finish importing ${member.result?.character.name || member.label}`} onClose={onClose} wide>
    <div className="start-ai-dialogue start-ai-dialogue--character" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Character import conversation">
      {conversation.map((turn) => <div key={turn.id} className={`start-ai-turn start-ai-turn--${turn.role}`}>
        <strong>{turn.role === 'assistant' ? 'RPG Your Way' : 'You'}</strong>
        <p>{turn.text}</p>
        {turn.role === 'assistant' && turn.required?.length ? <section className="start-clarification-tier start-clarification-tier--required"><h3>Required before this character can be used</h3><p>RPG Your Way needs these answers before it can use this character correctly.</p>{turn.required.map((question, index) => <div className="start-question-card" key={`${turn.id}-required-${index}`}><strong>{question.question}</strong><small>{question.reason}</small></div>)}</section> : null}
        {turn.role === 'assistant' && turn.recommended?.length ? <section className="start-clarification-tier"><h3>Recommended before play</h3><p>You can play without these answers, but resolving them now can prevent guesses or interruptions later during play.</p>{turn.recommended.map((question, index) => <div className="start-question-card" key={`${turn.id}-recommended-${index}`}><strong>{question.question}</strong><small>{question.reason}</small></div>)}</section> : null}
        {turn.role === 'assistant' ? <button type="button" data-aigm-manual-listen="true" className="start-listen-link" onClick={() => voiceRef.current?.replay(narrationForTurn(turn))}><Volume2 aria-hidden="true" />Listen</button> : null}
      </div>)}
      {busy ? <div className="start-ai-turn start-ai-turn--assistant"><strong>RPG Your Way</strong><p>Working through that answer…</p></div> : null}
      <div ref={endRef} />
    </div>
    {questions.length ? <div className="start-ai-composer start-ai-composer--character"><label className="start-clarification-answer"><span>Your answer</span><span className="start-field-bezel"><textarea ref={answerRef} rows={4} value={clarificationText} onChange={(event) => setClarificationText(event.target.value)} placeholder="Answer the questions for this character. You can answer more than one at once." /></span></label><div className="start-ai-composer-actions"><AigmVoiceControls ref={voiceRef} profile="onboarding" assistantName="RPG Your Way" currentMessage={clarificationText} onTranscriptUpdate={setClarificationText} onError={setVoiceError} disabled={busy} /><button type="button" className="start-primary-control" disabled={!clarificationText.trim() || busy} onClick={onSend}>{busy ? 'Working…' : 'Send answers'}</button>{!required.length && recommended.length ? <button type="button" className="start-info-control" disabled={busy} onClick={onSkip}>Continue without these answers</button> : null}</div></div> : <div className="start-inline-actions"><button type="button" className="start-primary-control" onClick={onClose}>Done</button></div>}
    {member.error ? <p className="auth-message auth-message-error" role="alert">{member.error}</p> : null}
    {voiceError ? <p className="auth-message auth-message-error" role="alert">{voiceError}</p> : null}
  </StartModal>
}

function RatingControl({ value, onChange, low, high, label, ariaLabel }: { value: number; onChange: (value: number) => void; low: string; high: string; label?: string; ariaLabel?: string }) {
  const descriptionId = useId()
  const accessibleLabel = ariaLabel || label || 'Rating'
  return <div className="start-rating-control" role="group" aria-label={accessibleLabel} aria-describedby={descriptionId}>{label ? <strong>{label}</strong> : null}<div className="start-rating-scale">{Array.from({ length: 10 }, (_, index) => index + 1).map((number) => <button type="button" key={number} className={value === number ? 'is-selected' : ''} aria-pressed={value === number} aria-label={`${accessibleLabel}: ${number} of 10`} onClick={() => onChange(number)}>{number}</button>)}</div><div id={descriptionId} className="start-rating-labels"><span>{low}</span><span>{high}</span></div></div>
}

function MiniRatingSelect({ topic, value, onChange }: { topic: string; value: number; onChange: (value: number) => void }) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null)
  return (
    <div className="start-mini-rating-item">
      <span>{topic}</span>
      <details ref={detailsRef} className="start-mini-rating-menu">
        <summary aria-label={`${topic} rating, ${value} of 10`}>
          <strong>{value}</strong>
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="start-mini-rating-options" aria-label={`${topic} rating choices`}>
          {Array.from({ length: 10 }, (_, index) => index + 1).map((number) => (
            <button
              type="button"
              key={number}
              className={number === value ? 'is-selected' : ''}
              aria-pressed={number === value}
              aria-label={`${topic}: ${number} of 10`}
              onClick={() => {
                onChange(number)
                if (detailsRef.current) detailsRef.current.open = false
              }}
            >
              {number}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}

function CampaignMix({ values, onChange }: { values: Record<string, number>; onChange: (topic: string, value: number) => void }) {
  return <><h2>How much of each do you want in the campaign?</h2><div className="start-mini-ratings">{CAMPAIGN_TOPICS.map((topic) => <MiniRatingSelect key={topic} topic={topic} value={values[topic]} onChange={(value) => onChange(topic, value)} />)}</div></>
}

function CharacterPriorities({ values, onChange }: { values: Record<string, number>; onChange: (topic: string, value: number) => void }) {
  return <><h2>How much should these character choices matter?</h2><div className="start-mini-ratings start-mini-ratings--three">{CHARACTER_TOPICS.map((topic) => <MiniRatingSelect key={topic} topic={topic} value={values[topic]} onChange={(value) => onChange(topic, value)} />)}</div></>
}
