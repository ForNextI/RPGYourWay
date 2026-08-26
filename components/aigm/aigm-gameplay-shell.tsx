'use client'

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Dices,
  Download,
  FileDown,
  HeartPulse,
  Headphones,
  HelpCircle,
  LoaderCircle,
  ImagePlus,
  LockKeyhole,
  MessageSquareText,
  Minus,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Swords,
  UnlockKeyhole,
  UserRound,
  Volume2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { type ChangeEvent, FormEvent, type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AigmVoiceControls, type AigmVoiceControlsHandle } from '@/components/aigm/aigm-voice-controls'
import { ExportGameHelpDialog, StoryDirectionDialog, VoiceGuidedPlayDialog } from '@/components/aigm/aigm-play-guidance-dialogs'
import { CharacterAssistanceDialog } from '@/components/aigm/character-assistance-dialog'
import { LevelUpDialog } from '@/components/aigm/level-up-dialog'
import { MotionSettingsControl, useMotionPreference } from '@/components/accessibility/motion-preference'
import { FullscreenToggle } from '@/components/accessibility/fullscreen-toggle'
import { useAccessibleDialog } from '@/components/accessibility/use-accessible-dialog'
import type { CharacterEditApiResponse, CharacterIntakeResult } from '@/lib/aigm/types'
import { getInitiativeModifier, normalizeCharacterIntakeResult, normalizePrintableCheckboxes } from '@/lib/aigm/character-intake-normalize'
import { appearanceDetail, classSummary, cleanSpellDisplayEntries, visibleCharacterKnowledge } from '@/lib/aigm/character-display'
import {
  canonicalizeCharacterRecord,
  characterBiography,
  characterFeatureEntries,
  characterProficiencies,
  featureDisplayText,
  normalizedRecordName,
} from '@/lib/aigm/character-record'
import { dnd55ClassFeatureNamesThroughLevel, dnd55ClassMetadata, dnd55SubclassFeatureNamesThroughLevel } from '@/lib/aigm/multiclassing'
import {
  CURRENT_ADVENTURE_KEY,
  campaignBackupFilename,
  defaultVoiceGuidedPlaySettings,
  emptyGameplayState,
  playNameFor,
  initialLiveState,
  normalizeLiveState,
  normalizeVoiceGuidedPlaySettings,
  mergeLiveStateUpdate,
  reconcileLiveStateAfterRecordEdit,
  type CampaignMemoryEntry,
  type CampaignRetcon,
  type CharacterAdvancementProfile,
  type CharacterClassLevelHistory,
  type CharacterLiveState,
  type DmSecretsState,
  type GameplayMessage,
  type GameplayState,
  type InitiativeEntry,
  type SavedAdventureState,
  type StoredPartyCharacter,
  type VoiceGuidedPlaySettings,
} from '@/lib/aigm/campaign-storage'
import { campaignMigrationSample, DIRECT_RECENT_MESSAGE_COUNT, isContinuityAuditRequest, searchCampaignHistory, shouldCheckCampaignNotes } from '@/lib/aigm/campaign-memory'
import { loadAdventureState, saveAdventureState } from '@/lib/aigm/campaign-persistence'
import { establishedNpcNames, mergeCampaignMemory, mergeCampaignRetcons, stampCampaignMemoryUpdates } from '@/lib/aigm/campaign-entities'

const DICE = [4, 6, 8, 10, 12, 20, 100] as const
const MAX_DICE_QUANTITY = 20
const OWNER_GOD_MODE_SESSION_KEY = 'wardens-owner-god-mode'
const STORY_DIRECTION_SEEN_KEY = 'wardenspc:aigm:story-direction-seen:v1'

interface CharacterEditApiError {
  error?: string
  details?: string
  request_id?: string
}

interface CharacterRecordMigrationResponse {
  characters?: Array<{ id: string; result: CharacterIntakeResult }>
}

interface GameplayApiResponse {
  dm_secrets?: DmSecretsState
  memory_updates?: CampaignMemoryEntry[]
  retcon_updates?: CampaignRetcon[]
  game_master_name?: string
  message?: string
  campaign_summary?: string
  scene?: string
  combat_suggested?: boolean
  npc_initiative?: Array<{
    name: string
    modifier: number
    roll: number
    total: number
  }>
  character_record_updates?: Array<{
    character_id: string
    total_level: number
    classes: Array<{ name: string; level: number; subclass: string }>
    proficiency_bonus: string
    maximum_hit_points: number
    features_to_add: string[]
    spell_slots: Array<{ level: string; total_shown: string; used_shown: string }>
    cantrips_to_add: string[]
    prepared_or_known_spells_to_add: string[]
    spellbook_or_other_spells_to_add: string[]
    player_corrections: string[]
  }>
  level_up_ready_character_ids?: string[]
  level_up_resolved_character_ids?: string[]
  character_updates?: Array<{
    character_id: string
    current_hit_points?: number
    maximum_hit_points?: number
    temporary_hit_points?: number
    armor_class?: number
    conditions?: string[]
    concentration?: string
    death_save_successes?: number
    death_save_failures?: number
    resources?: Array<{ name: string; current: string; maximum: string }>
    spell_slots?: Array<{ level: string; total: string; used: string }>
    currency?: { cp: number; sp: number; ep: number; gp: number; pp: number }
    notes?: string[]
  }>
  error?: string
  details?: string
  request_id?: string
  owner_god_mode_active?: boolean
  content_mode_explanation_given?: boolean
  code?: string
  add_usage_url?: string
  usage_billing?: {
    billed_microusd?: number
    balance_microusd?: number | null
    owner_qa_exempt?: boolean
    settlement_warning?: string | null
  }
}

interface GameplayStreamEvent {
  type?: 'message_delta' | 'result' | 'error'
  delta?: string
  payload?: GameplayApiResponse
  error?: string
}

async function readGameplayStream(response: Response, onMessageDelta: (delta: string) => void) {
  if (!response.body) throw new Error('The gameplay AIGM returned no readable stream.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: GameplayApiResponse | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as GameplayStreamEvent
      if (event.type === 'message_delta' && event.delta) onMessageDelta(event.delta)
      else if (event.type === 'result' && event.payload) result = event.payload
      else if (event.type === 'error') throw new Error(event.error || 'The gameplay AIGM stream failed.')
    }
  }

  if (!result) throw new Error('The gameplay AIGM stream ended before the turn was complete.')
  return result
}

function signedNumber(value: number | null | undefined) {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return safeValue >= 0 ? `+${safeValue}` : String(safeValue)
}

function rollDie(sides: number) {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return (buffer[0] % sides) + 1
}

function nowMessage(
  role: GameplayMessage['role'],
  text: string,
  sequence: number,
  turnNumber: number | null,
  exchangeId: string | null,
): GameplayMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    created_at: new Date().toISOString(),
    sequence,
    turn_number: turnNumber,
    exchange_id: exchangeId,
  }
}

function uniqueText(items: string[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const clean = item.trim()
    if (!clean) return false
    const key = clean.toLocaleLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}


function bookendText(items: string[], maximum: number) {
  const clean = items.filter((item) => item.trim())
  if (clean.length <= maximum) return clean
  const beginning = Math.ceil(maximum / 2)
  return [...clean.slice(0, beginning), ...clean.slice(-(maximum - beginning))]
}


function liveStateFor(character: StoredPartyCharacter): CharacterLiveState | null {
  if (!character.result) return null
  return normalizeLiveState(character.liveState, character.result)
}

function classAndSpeciesLine(result: CharacterIntakeResult) {
  return [classSummary(result), result.character.species].filter(Boolean).join(' · ')
}

function abbreviatedAlignment(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return '—'
  const known: Record<string, string> = {
    'lawful good': 'LG',
    'neutral good': 'NG',
    'chaotic good': 'CG',
    'lawful neutral': 'LN',
    neutral: 'N',
    'true neutral': 'N',
    'chaotic neutral': 'CN',
    'lawful evil': 'LE',
    'neutral evil': 'NE',
    'chaotic evil': 'CE',
  }
  return known[clean.toLocaleLowerCase('en-US')] ?? clean
}

function classLevelSummary(result: CharacterIntakeResult) {
  return (result.character.classes ?? []).map((entry) => `${entry.name} ${entry.level}`).join(' / ') || 'Class not found'
}

function subclassSummary(result: CharacterIntakeResult) {
  return (result.character.classes ?? [])
    .map((entry) => entry.subclass.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' / ')
}

function compactParty(characters: StoredPartyCharacter[]) {
  return characters.flatMap((character) => {
    const result = character.result
    if (!result) return []
    const liveState = liveStateFor(character) ?? initialLiveState(result)
    return [{
      id: character.id,
      name: playNameFor(character),
      full_name: result.character.name,
      sex: result.character.sex,
      pronouns: result.character.pronouns,
      age: result.character.age,
      alignment: result.character.alignment,
      class_summary: classSummary(result),
      classes: result.character.classes,
      species: result.character.species,
      background: result.character.background,
      level: result.character.total_level,
      is_current_party_active_leader: result.character.is_current_party_active_leader === true,
      armor_class: liveState.armor_class,
      hit_points: `${liveState.current_hit_points}/${liveState.maximum_hit_points}`,
      initiative_modifier: getInitiativeModifier(result),
      proficiency_bonus: result.character.proficiency_bonus,
      ability_scores: result.character.ability_scores,
      saving_throws: result.character.saving_throws,
      skills: result.character.skills,
      attacks: bookendText(result.character.attacks.map((attack) => `${attack.name}: ${attack.attack_bonus}, ${attack.damage}${attack.properties.length > 0 ? `; ${attack.properties.join(', ')}` : ''}`), 30),
      armor_and_shields: bookendText(result.character.armor_and_shields.map((item) => `${item.name}${item.quantity ? ` x${item.quantity}` : ''}${item.sheet_status ? `; ${item.sheet_status}` : ''}`), 20),
      equipment: bookendText(result.character.equipment_highlights.map((item) => `${item.name}${item.quantity ? ` x${item.quantity}` : ''}${item.sheet_status ? `; ${item.sheet_status}` : ''}`), 80),
      features: characterFeatureEntries(result, character.advancementProfiles ?? []).slice(0, 80).map((feature) => ({
        id: feature.id,
        name: feature.name,
        detail: feature.detail,
        category: feature.category,
        class_name: feature.class_name,
        subclass_name: feature.subclass_name,
        level_gained: feature.level_gained,
        source: feature.source,
      })),
      proficiencies: characterProficiencies(result),
      record_resources: bookendText(result.character.resources.map((resource) => `${resource.name}: ${resource.current_shown_on_sheet || '?'} of ${resource.maximum_or_frequency || '?'}`), 40),
      spellcasting: {
        ability: result.character.spellcasting.ability,
        save_dc: result.character.spellcasting.save_dc,
        attack_bonus: result.character.spellcasting.attack_bonus,
        cantrips: bookendText(cleanSpellDisplayEntries(result.character.spellcasting.cantrips), 30),
        prepared_or_known_spells: bookendText(cleanSpellDisplayEntries(result.character.spellcasting.prepared_or_known_spells), 60),
        spellbook_or_other_spells: bookendText(cleanSpellDisplayEntries(result.character.spellcasting.spellbook_or_other_spells), 80),
      },
      currency: liveState.currency,
      valuables: result.character.valuables,
      languages: bookendText(result.character.languages, 30),
      senses: bookendText(result.character.senses, 20),
      personality_goals_and_fears: bookendText(result.character.personality_goals_and_fears, 30),
      relationships_and_organizations: bookendText(result.character.relationships_and_organizations, 40),
      story_facts: bookendText(result.character.story_facts.map((fact) => `${fact.fact} [visibility: ${fact.likely_visibility}]`), 30),
      additional_details: bookendText(result.additional_details, 50),
      live_state: liveState,
    }]
  })
}

function CharacterCard({
  character,
  onOpen,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onReorder,
  isDragTarget,
  onDragTarget,
}: {
  character: StoredPartyCharacter
  onOpen: (characterId: string) => void
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: (characterId: string) => void
  onMoveDown: (characterId: string) => void
  onReorder: (characterId: string, targetCharacterId: string) => void
  isDragTarget: boolean
  onDragTarget: (characterId: string | null) => void
}) {
  const result = character.result
  const holdTimerRef = useRef<number | null>(null)
  const pointerDraggingRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number; pointerType: string } | null>(null)
  const pointerTargetRef = useRef(character.id)
  const suppressClickRef = useRef(false)
  if (!result) return null
  const live = liveStateFor(character) ?? initialLiveState(result)
  const name = playNameFor(character)
  const isLeader = result.character.is_current_party_active_leader === true
  const classes = classLevelSummary(result)
  const subclasses = subclassSummary(result)

  function clearHoldTimer() {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }

  function beginPointerDrag(target: HTMLButtonElement, pointerId: number) {
    pointerDraggingRef.current = true
    setDragging(true)
    suppressClickRef.current = true
    try { target.setPointerCapture(pointerId) } catch { /* capture is best-effort */ }
    onDragTarget(character.id)
  }

  function finishPointerDrag(target: HTMLButtonElement, commit: boolean) {
    clearHoldTimer()
    const start = pointerStartRef.current
    const wasDragging = pointerDraggingRef.current
    if (wasDragging && commit && pointerTargetRef.current !== character.id) {
      onReorder(character.id, pointerTargetRef.current)
    }
    pointerDraggingRef.current = false
    setDragging(false)
    pointerStartRef.current = null
    onDragTarget(null)
    if (start) {
      try { target.releasePointerCapture(start.pointerId) } catch { /* release is best-effort */ }
    }
    if (wasDragging) window.setTimeout(() => { suppressClickRef.current = false }, 120)
  }

  return (
    <article
      data-character-id={character.id}
      data-drag-target={isDragTarget ? 'true' : 'false'}
      className={`aigm-character-card group/card relative overflow-hidden rounded-2xl border bg-card transition focus-within:ring-2 focus-within:ring-ring ${isLeader ? 'aigm-character-card--leader' : 'border-border hover:border-primary/60'}`}
    >
      <button
        type="button"
        onClick={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault()
            return
          }
          onOpen(character.id)
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          clearHoldTimer()
          const target = event.currentTarget
          const start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, pointerType: event.pointerType }
          pointerStartRef.current = start
          pointerTargetRef.current = character.id
          if (event.pointerType === 'mouse') {
            try { target.setPointerCapture(start.pointerId) } catch { /* capture is best-effort */ }
            return
          }
          holdTimerRef.current = window.setTimeout(() => beginPointerDrag(target, start.pointerId), 450)
        }}
        onPointerMove={(event) => {
          const start = pointerStartRef.current
          if (!start) return
          const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y)
          if (!pointerDraggingRef.current) {
            if (start.pointerType === 'mouse') {
              if (event.buttons === 1 && distance > 6) beginPointerDrag(event.currentTarget, start.pointerId)
            } else if (distance > 9) {
              clearHoldTimer()
              pointerStartRef.current = null
              return
            }
          }
          if (!pointerDraggingRef.current) return
          event.preventDefault()
          const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-character-id]')
          const targetId = hit?.dataset.characterId
          if (targetId) {
            pointerTargetRef.current = targetId
            onDragTarget(targetId)
          }
        }}
        onPointerUp={(event) => {
          if (pointerDraggingRef.current) event.preventDefault()
          finishPointerDrag(event.currentTarget, true)
        }}
        onPointerCancel={(event) => finishPointerDrag(event.currentTarget, false)}
        onContextMenu={(event) => { if (pointerDraggingRef.current) event.preventDefault() }}
        className="w-full p-3 text-left transition hover:bg-secondary/65 focus-visible:outline-none"
        aria-label={`Open ${name} character record. Drag to reorder the party.`}
      >
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] grid-rows-3 gap-x-3 gap-y-0.5">
          <div className="relative row-span-3 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background/70">
            {character.portraitUrl ? <img src={character.portraitUrl} alt="" className="size-full object-contain" /> : <HeartPulse className="size-6 text-muted-foreground" aria-hidden="true" />}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-x-2 text-[10px] leading-tight">
            <span className="shrink-0 whitespace-nowrap"><strong className="text-foreground">HP</strong> {live.current_hit_points}/{live.maximum_hit_points}{live.temporary_hit_points > 0 ? ` +${live.temporary_hit_points}` : ''}</span>
            <span className="shrink-0 whitespace-nowrap"><strong className="text-foreground">AC</strong> {live.armor_class || '—'}</span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-x-2 text-[10px] leading-tight text-muted-foreground">
            <span className="shrink-0 whitespace-nowrap">{result.character.age ? `Age ${result.character.age}` : 'Age —'}</span>
            <span className="shrink-0 whitespace-nowrap text-right font-semibold text-foreground/85" title={result.character.alignment || 'Alignment not recorded'}>{abbreviatedAlignment(result.character.alignment)}</span>
          </div>
          <div className="flex min-w-0 items-center gap-x-2 text-[10px] leading-tight text-muted-foreground">
            <span className="min-w-0 flex-1 truncate" title={result.character.sex || undefined}>{result.character.sex || 'Sex —'}</span>
            <span className="shrink-0 whitespace-nowrap text-right" title={result.character.pronouns || undefined}>{result.character.pronouns || 'Pronouns —'}</span>
          </div>
        </div>

        <p className="aigm-character-summary mt-1.5 break-words font-display text-sm font-bold leading-snug text-foreground">
          {isLeader && <span className="aigm-leader-badge mr-1.5 inline-flex rounded-full px-2 py-0.5 align-middle text-[9px] font-black uppercase tracking-[0.14em]">Leader</span>}
          <span>{name}</span>
          <span className="font-sans font-semibold text-foreground/85"> · {classes}{subclasses ? ` · ${subclasses}` : ''}</span>
        </p>
      </button>

            {dragging ? (
        <div className="aigm-character-drag-cue pointer-events-none absolute inset-x-2 bottom-2 z-30 flex items-center justify-center gap-1.5 rounded-lg border border-primary/55 bg-card/95 px-2 py-1.5 text-[11px] font-black text-primary shadow-md" aria-hidden="true">
          <ArrowUp className="size-3.5" />
          <ArrowDown className="size-3.5" />
          <span>Drag to reorder</span>
        </div>
      ) : null}

<div className="aigm-character-reorder aigm-character-reorder-accessible absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 rounded-lg border border-border/80 bg-card/95 p-0.5 shadow-sm" aria-label={`Reorder ${name} in the party`}>
        <button type="button" onClick={() => onMoveUp(character.id)} disabled={!canMoveUp} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${name} up in party order`} title={`Move ${name} up`}><ArrowUp className="size-3.5" aria-hidden="true" /></button>
        <button type="button" onClick={() => onMoveDown(character.id)} disabled={!canMoveDown} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${name} down in party order`} title={`Move ${name} down`}><ArrowDown className="size-3.5" aria-hidden="true" /></button>
      </div>
    </article>
  )
}

function RecordSection({
  title,
  children,
  open,
  onOpenChange,
}: {
  title: string
  children: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <details
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      className="group rounded-2xl border border-border bg-background/50"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display font-bold">
        {title}
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="border-t border-border px-4 py-4">{children}</div>
    </details>
  )
}

function NestedRecordSection({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <details className={`group/nested wardens-accordion overflow-hidden rounded-xl border border-border bg-card ${className}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-bold text-primary">
        {title}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open/nested:rotate-90" aria-hidden="true" />
      </summary>
      <div className="border-t border-border p-3 sm:p-4">{children}</div>
    </details>
  )
}

const DEFAULT_RECORD_SECTIONS: Record<string, boolean> = {
  live: true,
  identity: true,
  classes: true,
  abilities: true,
  senses: false,
  attacks: true,
  equipment: true,
  resources: true,
  spellcasting: false,
  features: true,
  personality: true,
  additional: false,
  intake: false,
  source: false,
}

function storedRecordSections(characterId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_RECORD_SECTIONS }
  try {
    const raw = window.localStorage.getItem(`aigm-character-record-sections:v1:${characterId}`)
    const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {}
    const stored: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'boolean') stored[key] = value
    }
    return { ...DEFAULT_RECORD_SECTIONS, ...stored }
  } catch {
    return { ...DEFAULT_RECORD_SECTIONS }
  }
}

function RecordList({ items, empty = '' }: { items: string[]; empty?: string }) {
  const normalizedItems = items.map(normalizePrintableCheckboxes).filter(Boolean)
  if (normalizedItems.length === 0) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null
  return (
    <ul className="grid gap-2 text-sm">
      {normalizedItems.map((item, index) => <li key={`${item}-${index}`} className="rounded-xl bg-secondary px-3 py-2.5 leading-relaxed">{item}</li>)}
    </ul>
  )
}

interface SpellRulesDetail {
  name: string
  text: string
  source: string
  license: string
}

function SpellDisclosure({ spell, ruleset }: { spell: string; ruleset: string }) {
  const [detail, setDetail] = useState<SpellRulesDetail | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadDetail() {
    if (detail !== undefined || loading || !/(?:5\.5e|2024)/i.test(ruleset)) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/aigm/rules-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'spell', name: spell, ruleset }),
      })
      const payload = await response.json() as { detail?: SpellRulesDetail | null; error?: string }
      if (!response.ok) throw new Error(payload.error || 'The spell reference could not be loaded.')
      setDetail(payload.detail ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The spell reference could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <details className="group/spell wardens-accordion overflow-hidden rounded-xl bg-secondary" onToggle={(event) => { if (event.currentTarget.open) void loadDetail() }}>
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-foreground">
        <span className="inline-flex items-center gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open/spell:rotate-90" aria-hidden="true" />{spell}</span>
      </summary>
      <div className="border-t border-border px-3 py-3 text-sm leading-relaxed text-muted-foreground">
        {loading ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Looking up the built-in SRD spell description…</span> : null}
        {error ? <p>{error}</p> : null}
        {detail === null ? <p>No built-in SRD spell description was found for this entry. Use the character’s supplied source material when applicable.</p> : null}
        {detail ? <><p className="whitespace-pre-wrap">{detail.text}</p><p className="mt-2 text-xs">{detail.source} · {detail.license}</p></> : null}
      </div>
    </details>
  )
}

function SpellRecordList({ items, ruleset }: { items: string[]; ruleset: string }) {
  const normalizedItems = items.map(normalizePrintableCheckboxes).filter(Boolean)
  if (normalizedItems.length === 0) return null
  return <div className="grid gap-2">{normalizedItems.map((spell, index) => <SpellDisclosure key={`${spell}-${index}`} spell={spell} ruleset={ruleset} />)}</div>
}

interface CharacterIdentityUpdate {
  fullName?: string
  playName?: string
  portraitUrl?: string
  initiativeModifier?: number
}

function CharacterSheetOverlay({
  character,
  onClose,
  onUpdate,
  onSaveRecord,
  canLevelUp,
  onLevelUp,
  ruleset,
  startInRecordEditor = false,
}: {
  character: StoredPartyCharacter
  onClose: () => void
  onUpdate: (characterId: string, update: CharacterIdentityUpdate) => void
  onSaveRecord: (characterId: string, proposedResult: CharacterIntakeResult, proposedPlayName: string) => void
  canLevelUp: boolean
  onLevelUp: (characterId: string) => void
  ruleset: string
  startInRecordEditor?: boolean
}) {
  const result = character.result
  const portraitInputRef = useRef<HTMLInputElement | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: true, onClose, initialFocusRef: headingRef })
  const [editingIdentity, setEditingIdentity] = useState(false)
  const [draftName, setDraftName] = useState(result?.character.name ?? '')
  const [draftPlayName, setDraftPlayName] = useState(playNameFor(character))
  const [draftPortraitUrl, setDraftPortraitUrl] = useState(character.portraitUrl)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState(startInRecordEditor)
  const [showSmartLevelingHelp, setShowSmartLevelingHelp] = useState(false)
  const [recordEditText, setRecordEditText] = useState('')
  const [recordEditReading, setRecordEditReading] = useState(false)
  const [recordEditError, setRecordEditError] = useState<string | null>(null)
  const [recordEditProposal, setRecordEditProposal] = useState<CharacterEditApiResponse | null>(null)
  const [recordSections, setRecordSections] = useState<Record<string, boolean>>(DEFAULT_RECORD_SECTIONS)

  useEffect(() => {
    setEditingIdentity(false)
    setDraftName(result?.character.name ?? '')
    setDraftPlayName(playNameFor(character))
    setDraftPortraitUrl(character.portraitUrl)
    setIdentityError(null)
    setEditingRecord(startInRecordEditor)
    setShowSmartLevelingHelp(false)
    setRecordEditText('')
    setRecordEditReading(false)
    setRecordEditError(null)
    setRecordEditProposal(null)
    setRecordSections(storedRecordSections(character.id))
  }, [character.id, character.portraitUrl, result?.character.name, character.playName, startInRecordEditor])

  function setRecordSectionOpen(section: string, open: boolean) {
    setRecordSections((current) => {
      if (current[section] === open) return current
      const next = { ...current, [section]: open }
      try { window.localStorage.setItem(`aigm-character-record-sections:v1:${character.id}`, JSON.stringify(next)) } catch { /* display preference only */ }
      return next
    })
  }

  function recordSectionProps(section: string) {
    return {
      open: recordSections[section] ?? DEFAULT_RECORD_SECTIONS[section] ?? false,
      onOpenChange: (open: boolean) => setRecordSectionOpen(section, open),
    }
  }

  if (!result) return null

  const live = liveStateFor(character) ?? initialLiveState(result)

  function saveIdentity() {
    const fullName = draftName.replace(/\s+/g, ' ').trim()
    const playName = draftPlayName.replace(/\s+/g, ' ').trim().slice(0, 12)
    if (!fullName) {
      setIdentityError('Enter the character name.')
      return
    }
    if (!playName) {
      setIdentityError('Enter the name used during play.')
      return
    }
    onUpdate(character.id, { fullName, playName, portraitUrl: draftPortraitUrl })
    setIdentityError(null)
    setEditingIdentity(false)
  }

  function changePortrait(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setIdentityError('Choose an image file for the portrait.')
      return
    }
    if (file.size > 3_000_000) {
      setIdentityError('Portraits must be smaller than 3 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setDraftPortraitUrl(reader.result)
      setIdentityError(null)
    }
    reader.onerror = () => setIdentityError('The portrait could not be read.')
    reader.readAsDataURL(file)
  }


  function openRecordEditor() {
    setEditingRecord(true)
    setEditingIdentity(false)
    setRecordEditError(null)
    setRecordEditProposal(null)
  }

  function closeRecordEditor() {
    if (recordEditReading) return
    setEditingRecord(false)
    setRecordEditText('')
    setRecordEditError(null)
    setRecordEditProposal(null)
  }

  async function readRecordChanges() {
    const editText = recordEditText.trim()
    if (!editText) {
      setRecordEditError('Paste the additions or corrections first.')
      return
    }

    setRecordEditReading(true)
    setRecordEditError(null)
    setRecordEditProposal(null)

    try {
      const response = await fetch('/api/aigm/character-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rpgyw-operation-id': crypto.randomUUID() },
        body: JSON.stringify({
          current_result: result,
          current_play_name: playNameFor(character),
          edit_text: editText,
          source_text: character.sourceText || '',
          advancement_profiles: character.advancementProfiles ?? [],
        }),
      })
      const payload = (await response.json()) as CharacterEditApiResponse & CharacterEditApiError
      if (!response.ok || !payload.proposed_result) {
        throw new Error([
          payload.error || 'The AIGM could not read those character changes.',
          payload.details,
          payload.request_id ? `Reference: ${payload.request_id}` : '',
        ].filter(Boolean).join(' '))
      }
      setRecordEditProposal(payload)
    } catch (caught) {
      setRecordEditError(caught instanceof Error ? caught.message : 'The browser could not reach the character editor.')
    } finally {
      setRecordEditReading(false)
    }
  }

  function handleRecordEditKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!recordEditReading && recordEditText.trim()) void readRecordChanges()
  }

  function saveRecordChanges() {
    if (!recordEditProposal?.can_save) return
    onSaveRecord(character.id, recordEditProposal.proposed_result, recordEditProposal.proposed_play_name)
    setEditingRecord(false)
    setRecordEditText('')
    setRecordEditError(null)
    setRecordEditProposal(null)
  }
  const scores = result.character.ability_scores
  const abilityRows = [
    ['STR', scores.strength],
    ['DEX', scores.dexterity],
    ['CON', scores.constitution],
    ['INT', scores.intelligence],
    ['WIS', scores.wisdom],
    ['CHA', scores.charisma],
  ] as const
  const knowledge = visibleCharacterKnowledge(result)
  const biography = characterBiography(result)
  const appearance = biography.appearance || appearanceDetail(result)
  const proficiencies = characterProficiencies(result)
  const features = characterFeatureEntries(result, character.advancementProfiles ?? [])
  const storyFacts = knowledge.storyFacts.map((fact) => `${fact.fact}${fact.likely_visibility ? ` (${fact.likely_visibility.replaceAll('_', ' ')})` : ''}`)
  const spellcasting = result.character.spellcasting
  const visibleCantrips = cleanSpellDisplayEntries(spellcasting.cantrips)
  const visiblePreparedSpells = cleanSpellDisplayEntries(spellcasting.prepared_or_known_spells)
  const visibleSpellbookSpells = cleanSpellDisplayEntries(spellcasting.spellbook_or_other_spells)
  const hasSpellcasting = Boolean(spellcasting.ability || spellcasting.save_dc || spellcasting.attack_bonus || visibleCantrips.length || visiblePreparedSpells.length || visibleSpellbookSpells.length || live.spell_slots.length)
  const isDnd55 = /(?:5\.5e|2024)/i.test(ruleset)
  const featureMatchesName = (featureName: string, name: string) => normalizedRecordName(featureName) === normalizedRecordName(name)
  const classDisplayData = result.character.classes.map((classEntry) => {
    const classKey = classEntry.name.trim().toLocaleLowerCase('en-US')
    const classRecord = (character.classRecords ?? []).find((record) => record.class_name.trim().toLocaleLowerCase('en-US') === classKey)
    const classProfile = (character.advancementProfiles ?? []).find((profile) => (profile.profile_kind ?? 'class') === 'class' && profile.class_name.trim().toLocaleLowerCase('en-US') === classKey)
    const subclassProfile = (character.advancementProfiles ?? []).find((profile) => profile.profile_kind === 'subclass' && profile.class_name.trim().toLocaleLowerCase('en-US') === classKey && (profile.subclass_name || '').trim().toLocaleLowerCase('en-US') === classEntry.subclass.trim().toLocaleLowerCase('en-US'))
    const metadata = isDnd55 ? dnd55ClassMetadata(classEntry.name) : null
    const hitDie = classRecord?.hit_point_die || classProfile?.hit_point_die || metadata?.hitDie
    const classNames = [
      ...(isDnd55 ? dnd55ClassFeatureNamesThroughLevel(classEntry.name, classEntry.level) : []),
      ...(classProfile?.levels.flatMap((row) => row.level <= classEntry.level ? row.features : []) ?? []),
      ...(classRecord?.levels.flatMap((row) => row.class_level <= classEntry.level ? row.class_feature_names : []) ?? []),
      ...features.filter((feature) => feature.category === 'class' && normalizedRecordName(feature.class_name) === classKey).map((feature) => feature.name),
    ].map((name) => name.replace(/\s+/g, ' ').trim()).filter((name) => name && !/\bsubclass(?: feature)?$/i.test(name))
    const subclassNames = classEntry.subclass ? [
      ...(isDnd55 ? dnd55SubclassFeatureNamesThroughLevel(classEntry.name, classEntry.subclass, classEntry.level) : []),
      ...(subclassProfile?.levels.flatMap((row) => row.level <= classEntry.level ? row.features : []) ?? []),
      ...(classRecord?.levels.flatMap((row) => row.class_level <= classEntry.level && row.subclass_name.trim().toLocaleLowerCase('en-US') === classEntry.subclass.trim().toLocaleLowerCase('en-US') ? row.subclass_feature_names : []) ?? []),
      ...features.filter((feature) => feature.category === 'subclass' && normalizedRecordName(feature.class_name) === classKey && normalizedRecordName(feature.subclass_name) === normalizedRecordName(classEntry.subclass)).map((feature) => feature.name),
    ].map((name) => name.replace(/\s+/g, ' ').trim()).filter(Boolean) : []
    const uniqueClassNames = classNames.filter((name, index, list) => list.findIndex((candidate) => normalizedRecordName(candidate) === normalizedRecordName(name)) === index)
    const uniqueSubclassNames = subclassNames.filter((name, index, list) => list.findIndex((candidate) => normalizedRecordName(candidate) === normalizedRecordName(name)) === index)
    const classFeatures = uniqueClassNames.map((name) => features.find((feature) => featureMatchesName(feature.name, name)))
    const subclassFeatures = uniqueSubclassNames.map((name) => features.find((feature) => featureMatchesName(feature.name, name)))
    const currentClassProgression = classProfile?.levels.find((row) => row.level === classEntry.level)?.progression_values ?? []
    const currentSubclassProgression = subclassProfile?.levels.find((row) => row.level === classEntry.level)?.progression_values ?? []
    const relatedSubclassResources = classEntry.subclass ? result.character.resources.filter((resource) => uniqueSubclassNames.some((name) => {
      const resourceKey = normalizedRecordName(resource.name)
      const nameKey = normalizedRecordName(name)
      return nameKey.length >= 5 && (resourceKey.includes(nameKey) || nameKey.includes(resourceKey))
    })) : []
    const trackedHp = classRecord?.levels.reduce((sum, row) => sum + (row.hit_points_gained ?? 0), 0) ?? 0
    return { classEntry, classRecord, hitDie, uniqueClassNames, uniqueSubclassNames, classFeatures, subclassFeatures, currentClassProgression, currentSubclassProgression, relatedSubclassResources, trackedHp }
  })
  const classifiedFeatureKeys = new Set(classDisplayData.flatMap((data) => [...data.uniqueClassNames, ...data.uniqueSubclassNames]).map(normalizedRecordName))
  const otherFeatures = features.filter((feature) => !classifiedFeatureKeys.has(normalizedRecordName(feature.name)))
  const proficiencyGroups: Array<[string, string[]]> = [
    ['Armor training', proficiencies.armor],
    ['Shield training', proficiencies.shields],
    ['Weapon proficiencies', proficiencies.weapons],
    ['Tool proficiencies', proficiencies.tools],
    ['Vehicle proficiencies', proficiencies.vehicles],
    ['Gaming sets', proficiencies.gaming_sets],
    ['Musical instruments', proficiencies.musical_instruments],
    ['Other training', proficiencies.other_training],
  ]

  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-hidden bg-background/92 p-2 outline-none backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="character-sheet-title">
      <div className="character-sheet-dialog relative flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-primary/45 bg-card shadow-2xl">
        <div className="character-sheet-header border-b border-border bg-secondary/55 px-4 py-4 sm:px-6">
          <div className="character-sheet-heading-row flex items-start justify-between gap-4">
            <div className="character-sheet-heading-main flex min-w-0 items-start gap-4">
              <div className="character-sheet-portrait flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background/75 sm:size-24">
                {character.portraitUrl ? <img src={character.portraitUrl} alt="" className="size-full object-contain" /> : <UserRound className="size-10 text-muted-foreground" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-primary">Character record</p>
                <h2 ref={headingRef} tabIndex={-1} id="character-sheet-title" className="mt-1 font-display text-2xl font-bold sm:text-3xl">{result.character.name}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Name used in play: <span className="font-semibold text-foreground">{playNameFor(character)}</span><span aria-hidden="true"> · </span><span className="font-semibold text-foreground">{classSummary(result)}</span></p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{[result.character.species, result.character.sex, result.character.pronouns, result.character.age ? `Age ${result.character.age}` : '', result.character.alignment, result.character.background].filter(Boolean).join(' · ')}</p>
                <div className="character-sheet-actions mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={openRecordEditor} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
                    <ClipboardPaste className="size-4" aria-hidden="true" />Edit character sheet
                  </button>
                  <button type="button" onClick={() => { setEditingIdentity((current) => !current); setEditingRecord(false); setRecordEditProposal(null); setRecordEditError(null) }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 text-xs font-bold text-primary">
                    <Pencil className="size-4" aria-hidden="true" />Edit name and profile picture
                  </button>
                  <button type="button" onClick={() => onLevelUp(character.id)} disabled={!canLevelUp} title={canLevelUp ? 'This character has earned a level.' : 'The AIGM will make Level Up available when this character earns a level.'} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-45">
                    <Sparkles className="size-4" aria-hidden="true" />Level Up
                  </button>
                  <button type="button" onClick={() => setShowSmartLevelingHelp((open) => !open)} aria-expanded={showSmartLevelingHelp} className="character-smart-level-button inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary/45 bg-primary/10 px-3 text-xs font-bold text-primary transition hover:bg-primary/15">
                    <HelpCircle className="size-4" aria-hidden="true" />Smart way to level
                  </button>
                </div>
                {showSmartLevelingHelp && (
                  <div className="mt-3 max-w-2xl rounded-2xl border border-primary/35 bg-background/90 p-4 text-sm leading-relaxed shadow-sm" role="dialog" aria-label="Smart way to level your character">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg font-bold text-foreground">Smart way to level your character</p>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
                          <li>Level the character completely in the character sheet, rules source, or character manager you already use.</li>
                          <li>When RPG Your Way has marked the character ready, return here and click <strong className="text-foreground">Level Up</strong>.</li>
                          <li>In the Level Up window, choose <strong className="text-foreground">Use Edit Character Sheet</strong> and paste the completed level-up changes.</li>
                        </ol>
                        <p className="mt-2 text-xs text-muted-foreground">RPG Your Way will reconcile the finished changes with the permanent record. Edit Character Sheet accepts text, so copy or extract the relevant finished changes from a screenshot or PDF before pasting them there.</p>
                      </div>
                      <button type="button" onClick={() => setShowSmartLevelingHelp(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close smart leveling help"><X className="size-4" aria-hidden="true" /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background transition hover:border-primary/55 hover:text-primary" aria-label="Close character record">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          {editingIdentity && (
            <div className="mt-4 grid gap-3 rounded-2xl border border-primary/35 bg-background/80 p-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-muted-foreground">Character name
                <input value={draftName} placeholder="Enter full character name here" onChange={(event) => setDraftName(event.target.value)} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground" />
              </label>
              <label className="text-xs font-bold text-muted-foreground">Name used in play
                <input value={draftPlayName} maxLength={12} placeholder="Enter chosen play name here" onChange={(event) => setDraftPlayName(event.target.value)} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground" />
              </label>
              <div className="rounded-xl border border-border bg-card p-3 sm:col-span-2">
                <p className="text-xs font-bold text-muted-foreground">Profile picture</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
                    {draftPortraitUrl ? <img src={draftPortraitUrl} alt="Profile picture preview" className="size-full object-contain" /> : <UserRound className="size-7 text-muted-foreground" aria-hidden="true" />}
                  </div>
                  <button type="button" onClick={() => portraitInputRef.current?.click()} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-bold text-muted-foreground hover:border-primary/45 hover:text-foreground">
                    <ImagePlus className="size-4" aria-hidden="true" />{draftPortraitUrl ? 'Change picture' : 'Add picture'}
                  </button>
                  {draftPortraitUrl && <button type="button" onClick={() => setDraftPortraitUrl('')} className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold text-muted-foreground hover:border-destructive/45 hover:text-destructive">Remove picture</button>}
                  <input ref={portraitInputRef} type="file" accept="image/*" onChange={changePortrait} className="sr-only" tabIndex={-1} aria-hidden="true" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <button type="button" onClick={saveIdentity} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Save changes</button>
                <button type="button" onClick={() => { setEditingIdentity(false); setIdentityError(null); setDraftName(result.character.name); setDraftPlayName(playNameFor(character)); setDraftPortraitUrl(character.portraitUrl) }} className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-muted-foreground">Cancel</button>
                {identityError && <p className="text-sm font-semibold text-destructive" role="alert">{identityError}</p>}
              </div>
            </div>
          )}
          {!editingIdentity && identityError && <p className="mt-3 text-sm font-semibold text-destructive" role="alert">{identityError}</p>}

          {editingRecord && (
            <div className="character-record-edit-workspace absolute inset-3 z-40 flex min-h-0 flex-col overflow-y-auto overscroll-contain rounded-2xl border border-primary/40 bg-background p-4 shadow-2xl sm:inset-5 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold">Edit character sheet</p>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">Use this box to add, remove, replace, or correct information in the permanent character record. Rules questions and gameplay questions belong in the main AIGM chat. Nothing changes until you choose Save to Character.</p>
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Text updates only:</strong> ordinary character edits do not accept screenshots or photos. If you need to show RPG Your Way a class or subclass advancement chart, the Level Up interface can accept an image when advancement material is needed.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Link href="/#wardens-latest-update" className="inline-flex text-xs font-bold text-primary underline-offset-4 hover:underline">Have an older character? Read the latest character-record update notes.</Link>
                    <a href="/downloads/rpgyourway-character-update-template-v2.txt" download="RPG Your Way_Plain_Text_Character_Update_Template_v2.txt" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 text-xs font-bold text-primary">
                      <Download className="size-4" aria-hidden="true" />Blank update template, if you want to use it
                    </a>
                  </div>
                </div>
                <button type="button" onClick={closeRecordEditor} disabled={recordEditReading} className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground disabled:opacity-40">Cancel</button>
              </div>

              <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-muted-foreground" htmlFor={`character-edit-${character.id}`}>Additions or corrections</label>
              <textarea
                id={`character-edit-${character.id}`}
                value={recordEditText}
                onChange={(event) => { setRecordEditText(event.target.value); setRecordEditProposal(null); setRecordEditError(null) }}
                onKeyDown={handleRecordEditKeyDown}
                disabled={recordEditReading}
                rows={8}
                placeholder={`Example:
Add these weapons:

Scimitar
Attack bonus: +6
Damage: 1d6 + 3 slashing
Properties: finesse, light`}
                className={`character-record-edit-input mt-2 w-full rounded-xl border border-input bg-card px-4 py-3 font-mono text-sm leading-relaxed text-foreground outline-none focus:border-primary disabled:opacity-60 ${recordEditProposal ? 'min-h-40 max-h-72 resize-y' : 'min-h-[4.25rem] flex-1 resize-none'}`}
              />

              {!recordEditProposal && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => void readRecordChanges()} disabled={recordEditReading || !recordEditText.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-45">
                    {recordEditReading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <ClipboardPaste className="size-4" aria-hidden="true" />}
                    {recordEditReading ? 'Reading changes…' : 'Read Changes'}
                  </button>
                  <p className="text-xs text-muted-foreground">Existing information is preserved unless your text clearly changes or removes it.</p>
                </div>
              )}

              {recordEditError && <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><p>{recordEditError}</p></div>}

              {recordEditProposal && (
                <div className="mt-4 grid gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className={`mt-0.5 size-5 shrink-0 ${recordEditProposal.can_save ? 'text-primary' : 'text-amber-500'}`} aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{!recordEditProposal.can_save && recordEditProposal.change_summary.length === 0 && recordEditProposal.blocking_questions.length === 0 ? 'No savable character change' : 'Review proposed changes'}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{recordEditProposal.assistant_message}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Changes</p>
                    <RecordList items={recordEditProposal.change_summary} empty="No actual change was found." />
                  </div>

                  {recordEditProposal.duplicate_warnings.length > 0 && (
                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                      <p className="text-sm font-bold">Notes and items left unchanged</p>
                      <div className="mt-2"><RecordList items={recordEditProposal.duplicate_warnings} /></div>
                    </div>
                  )}

                  {recordEditProposal.blocking_questions.length > 0 && (
                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                      <p className="text-sm font-bold">A little more information is needed</p>
                      <div className="mt-2"><RecordList items={recordEditProposal.blocking_questions} /></div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {recordEditProposal.can_save && <button type="button" onClick={saveRecordChanges} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><CheckCircle2 className="size-4" aria-hidden="true" />Save to Character</button>}
                    <button type="button" onClick={() => { setRecordEditProposal(null); setRecordEditError(null) }} className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-muted-foreground">Change the pasted text</button>
                    <button type="button" onClick={closeRecordEditor} className="rounded-xl border border-border px-4 py-2 text-sm font-bold text-muted-foreground">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="character-sheet-body min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-4">
            <RecordSection title="Current state" {...recordSectionProps('live')}>
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-xl bg-secondary px-3 py-3"><p className="text-xs text-muted-foreground">Hit Points</p><p className="mt-1 text-xl font-bold">{live.current_hit_points}/{live.maximum_hit_points}{live.temporary_hit_points > 0 ? ` +${live.temporary_hit_points} temp` : ''}</p></div>
                <div className="rounded-xl bg-secondary px-3 py-3"><p className="text-xs text-muted-foreground">Armor Class</p><p className="mt-1 text-xl font-bold">{live.armor_class || '—'}</p></div>
                <div className="rounded-xl bg-secondary px-3 py-3"><p className="text-xs text-muted-foreground">Initiative</p><p className="mt-1 text-xl font-bold text-primary">{signedNumber(getInitiativeModifier(result))}</p></div>
                <div className="rounded-xl bg-secondary px-3 py-3"><p className="text-xs text-muted-foreground">Death Saves</p><p className="mt-1 text-sm font-bold">{live.death_saves.successes} successes<br />{live.death_saves.failures} failures</p></div>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-xl bg-secondary px-3 py-2"><span className="font-semibold">Conditions:</span> <span className="text-muted-foreground">{live.conditions.join(', ') || 'None'}</span></div>
                <div className="rounded-xl bg-secondary px-3 py-2"><span className="font-semibold">Concentration:</span> <span className="text-muted-foreground">{live.concentration || 'None'}</span></div>
              </div>
              {live.notes.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold">Recent character updates</p>
                  <p className="mb-2 mt-1 text-xs text-muted-foreground">Recent in-game changes affecting this character.</p>
                  <RecordList items={live.notes.slice(-5)} />
                </div>
              )}
            </RecordSection>

            <RecordSection title="Character and story" {...recordSectionProps('identity')}>
              <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Full name', result.character.name], ['Play name', playNameFor(character)], ['Sex', result.character.sex], ['Pronouns', result.character.pronouns],
                  ['Age', result.character.age], ['Alignment', result.character.alignment], ['Species', result.character.species],
                  ['Total level', String(result.character.total_level || '')], ['Background', result.character.background], ["Is Current Party's Active Leader", result.character.is_current_party_active_leader ? 'Yes' : 'No'], ['Appearance', appearance], ['Faith or guiding philosophy', biography.faith], ['Place of origin', biography.place_of_origin], ['Current residence or base', biography.current_residence], ['Size', biography.size], ['Height', biography.height], ['Weight', biography.weight],
                ].filter((entry) => entry[1]).map(([label, value]) => <div key={label} className="rounded-xl bg-secondary px-3 py-2"><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
              </dl>
              {result.character.aliases_and_nicknames.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-semibold">Aliases and nicknames</p><RecordList items={result.character.aliases_and_nicknames} /></div>}
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Personality, goals, and fears</p><RecordList items={knowledge.personality} /></div>
                <div><p className="mb-2 text-sm font-semibold">Relationships and organizations</p><RecordList items={knowledge.relationships} /></div>
              </div>
              {storyFacts.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-semibold">Backstory and story facts</p><RecordList items={storyFacts} /></div>}
            </RecordSection>

            <RecordSection title="Classes, features, and traits" {...recordSectionProps('classes')}>
              {classDisplayData.length > 1 && (
                <NestedRecordSection title={`Multiclassing · ${classDisplayData.length} classes`}>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-secondary px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total character level</p><p className="mt-1 font-semibold">{result.character.total_level || classDisplayData.reduce((sum, data) => sum + data.classEntry.level, 0)}</p></div>
                    <div className="rounded-xl bg-secondary px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Number of classes</p><p className="mt-1 font-semibold">{classDisplayData.length}</p></div>
                  </div>
                  <div className="mt-3">
                    <p className="mb-2 text-sm font-semibold">Class distribution</p>
                    <RecordList items={classDisplayData.map((data) => `${data.classEntry.name} ${data.classEntry.level}${data.classEntry.subclass ? ` · ${data.classEntry.subclass}` : ''}`)} />
                  </div>
                </NestedRecordSection>
              )}
              {classDisplayData.map((data, classIndex) => (
              <NestedRecordSection key={`${data.classEntry.name}-${classIndex}`} title={`Class · ${data.classEntry.name} · Level ${data.classEntry.level}`} className={classIndex > 0 || classDisplayData.length > 1 ? 'mt-3' : ''}>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-secondary px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Class level</p><p className="mt-1 font-semibold">{data.classEntry.level}</p></div>
                  <div className="rounded-xl bg-secondary px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hit Point Die</p><p className="mt-1 font-semibold">{data.hitDie ? `d${data.hitDie}` : 'Not separately recorded'}</p></div>
                  <div className="rounded-xl bg-secondary px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hit Dice from class</p><p className="mt-1 font-semibold">{data.hitDie ? `${data.classEntry.level}d${data.hitDie}` : '—'}</p></div>
                  <div className="rounded-xl bg-secondary px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">HP tracked by RPG Your Way</p><p className="mt-1 font-semibold">{data.classRecord?.levels.some((row) => row.hit_points_gained !== undefined) ? `+${data.trackedHp} HP` : 'Begins with future Level Ups'}</p></div>
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold">Class features through level {data.classEntry.level}</p>
                  <RecordList items={data.uniqueClassNames.map((name, index) => data.classFeatures[index] ? featureDisplayText(data.classFeatures[index]!) : name)} empty="No class features were separately identified in this record." />
                </div>
                {data.currentClassProgression.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-semibold">Current class progression</p><RecordList items={data.currentClassProgression.map((entry) => `${entry.name}: ${entry.value}`)} /></div>}
                {data.classRecord && data.classRecord.levels.length > 0 && (
                  <details className="wardens-accordion mt-4 overflow-hidden rounded-xl border border-border bg-card">
                    <summary className="cursor-pointer px-3 py-2.5 text-sm font-bold text-primary">RPG Your Way class-level history</summary>
                    <div className="grid gap-2 border-t border-border p-3 text-sm">
                      {data.classRecord.levels.map((row) => <div key={`${row.total_character_level}-${row.class_level}`} className="rounded-xl bg-secondary px-3 py-2">
                        <span className="font-semibold">Character level {row.total_character_level} · {data.classEntry.name} {row.class_level}</span>{row.hit_points_gained !== undefined ? <span className="text-muted-foreground"> · +{row.hit_points_gained} HP{row.hit_point_method ? ` (${row.hit_point_method})` : ''}</span> : null}
                        {row.automatic_changes.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Automatic:</strong> {row.automatic_changes.join(' · ')}</p>}
                        {row.choices.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Choices:</strong> {row.choices.map((choice) => `${choice.label}: ${choice.value}`).join(' · ')}</p>}
                        {row.progression_values.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Progression:</strong> {row.progression_values.map((entry) => `${entry.name}: ${entry.value}`).join(' · ')}</p>}
                      </div>)}
                    </div>
                  </details>
                )}
                {data.classEntry.subclass && (
                  <NestedRecordSection title={`Subclass · ${data.classEntry.subclass}`} className="mt-4 border-primary/35 bg-primary/5">
                      <p className="mb-2 text-sm font-semibold">Subclass features earned through {data.classEntry.name} level {data.classEntry.level}</p>
                      <RecordList items={data.uniqueSubclassNames.map((name, index) => data.subclassFeatures[index] ? featureDisplayText(data.subclassFeatures[index]!) : name)} empty="The subclass name is recorded, but no subclass feature details have been separately stored yet." />
                      {data.currentSubclassProgression.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-semibold">Current subclass progression</p><RecordList items={data.currentSubclassProgression.map((entry) => `${entry.name}: ${entry.value}`)} /></div>}
                      {data.relatedSubclassResources.length > 0 && <div className="mt-4"><p className="mb-2 text-sm font-semibold">Related subclass resources</p><RecordList items={data.relatedSubclassResources.map((entry) => `${entry.name}: ${entry.current_shown_on_sheet || '—'} / ${entry.maximum_or_frequency || '—'}`)} /></div>}
                  </NestedRecordSection>
                )}
              </NestedRecordSection>
              ))}
              <NestedRecordSection title="Species traits, feats, background, and other abilities" className="mt-3">
                <RecordList items={otherFeatures.map(featureDisplayText)} empty="No separate species traits, feats, background benefits, item powers, or other abilities were identified in this record." />
              </NestedRecordSection>
            </RecordSection>

            <RecordSection title="Abilities and proficiencies" {...recordSectionProps('abilities')}>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {abilityRows.map(([label, score]) => <div key={label} className="rounded-xl bg-secondary px-2 py-3 text-center"><p className="text-[10px] font-bold text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{score}</p></div>)}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Saving throws</p><RecordList items={result.character.saving_throws} /></div>
                <div><p className="mb-2 text-sm font-semibold">Skills</p><RecordList items={result.character.skills} /></div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Senses and defenses</p><RecordList items={result.character.senses} /></div>
                <div><p className="mb-2 text-sm font-semibold">Languages</p><RecordList items={result.character.languages} /></div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {proficiencyGroups.filter(([, items]) => items.length > 0).map(([label, items]) => <div key={label}><p className="mb-2 text-sm font-semibold">{label}</p><RecordList items={items} /></div>)}
              </div>
            </RecordSection>

            <RecordSection title="Combat and resources" {...recordSectionProps('attacks')}>
              {result.character.attacks.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {result.character.attacks.map((attack, index) => (
                    <div key={`${attack.name}-${index}`} className="rounded-xl bg-secondary px-3 py-3 text-sm">
                      <p className="font-semibold">{attack.name}</p>
                      <p className="mt-1 text-muted-foreground">{[attack.attack_bonus, attack.damage].filter(Boolean).join(' · ')}</p>
                      {attack.properties.length > 0 && <p className="mt-2 leading-relaxed text-muted-foreground">{attack.properties.join(' · ')}</p>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No attacks were extracted.</p>}
              <div className="mt-5 grid gap-4 border-t border-border pt-5 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Resources remaining</p>{live.resources.length > 0 ? <div className="grid gap-2">{live.resources.map((resource, index) => <div key={`${resource.name}-${index}`} className="flex justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-sm"><span>{resource.name}</span><span className="font-semibold text-primary">{resource.current || '0'}/{resource.maximum || '—'}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No limited-use resources were extracted.</p>}</div>
                <div><p className="mb-2 text-sm font-semibold">Spell slots</p>{live.spell_slots.length > 0 ? <div className="grid gap-2">{live.spell_slots.map((slot, index) => <div key={`${slot.level}-${index}`} className="flex justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-sm"><span>{slot.level}</span><span className="font-semibold text-primary">{slot.used || '0'} used / {slot.total || '—'}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No spell slots were extracted.</p>}</div>
              </div>
            </RecordSection>

            <RecordSection title="Equipment and wealth" {...recordSectionProps('equipment')}>
              <div>
                <p className="mb-2 text-sm font-semibold">Armor and shields</p>
                {result.character.armor_and_shields.length > 0 ? <div className="grid gap-2 sm:grid-cols-2">{result.character.armor_and_shields.map((item, index) => <div key={`${item.name}-${index}`} className="rounded-xl bg-secondary px-3 py-2 text-sm"><span className="font-semibold">{normalizePrintableCheckboxes(item.name)}</span>{item.quantity ? ` · ${normalizePrintableCheckboxes(item.quantity)}` : ''}{item.sheet_status && <p className="mt-1 text-muted-foreground">{normalizePrintableCheckboxes(item.sheet_status)}</p>}</div>)}</div> : <p className="text-sm text-muted-foreground">No armor or shield details were extracted.</p>}
              </div>
              <div className="mt-5">
                <p className="mb-2 text-sm font-semibold">All recorded equipment</p>
                {result.character.equipment_highlights.length > 0 ? <div className="columns-1 gap-3 lg:columns-2">{result.character.equipment_highlights.map((item, index) => <div key={`${item.name}-${index}`} className="mb-2 break-inside-avoid rounded-xl bg-secondary px-3 py-2 text-sm"><span className="font-semibold">{normalizePrintableCheckboxes(item.name)}</span>{item.quantity ? ` · Qty ${normalizePrintableCheckboxes(item.quantity)}` : ''}{item.sheet_status && <p className="mt-1 text-muted-foreground">{normalizePrintableCheckboxes(item.sheet_status)}</p>}</div>)}</div> : <p className="text-sm text-muted-foreground">No equipment was extracted.</p>}
              </div>
              <div className="mt-4 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold">Currency</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
                  {(['pp', 'gp', 'ep', 'sp', 'cp'] as const).map((coin) => <div key={coin} className="rounded-xl bg-secondary px-2 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{coin}</p><p className="mt-0.5 font-bold">{result.character.currency[coin]}</p></div>)}
                  <div className="rounded-xl bg-primary/10 px-2 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Total GP</p><p className="mt-0.5 font-bold text-primary">{result.character.currency.total_gp_value}</p></div>
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold">Valuables: gems and objects</p>
                {result.character.valuables.length > 0 ? <div className="grid gap-2">{result.character.valuables.map((item, index) => <div key={`${item.name}-${index}`} className="grid gap-1 rounded-xl bg-secondary px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-3"><span className="font-semibold">{item.name}</span><span className="text-muted-foreground">Qty {item.quantity || '—'}</span><span className="text-muted-foreground">{item.value_each_gp || '—'} GP each</span><span className="font-semibold text-primary">{item.estimated_total_gp || '—'} GP est.</span></div>)}</div> : <p className="text-sm text-muted-foreground">No separate gems or valuable objects were extracted.</p>}
              </div>
            </RecordSection>

            {hasSpellcasting && <RecordSection title="Spellcasting and spells" {...recordSectionProps('spellcasting')}>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                {[['Spellcasting ability', spellcasting.ability], ['Spell save DC', spellcasting.save_dc], ['Spell attack bonus', spellcasting.attack_bonus]].filter((entry) => entry[1]).map(([label, value]) => <div key={label} className="rounded-xl bg-secondary px-3 py-2"><dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}
              </dl>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div><p className="mb-2 text-sm font-semibold">Cantrips</p><SpellRecordList items={visibleCantrips} ruleset={ruleset} /></div>
                <div><p className="mb-2 text-sm font-semibold">Prepared or known spells</p><SpellRecordList items={visiblePreparedSpells} ruleset={ruleset} /></div>
                <div><p className="mb-2 text-sm font-semibold">Spellbook or other spells</p><SpellRecordList items={visibleSpellbookSpells} ruleset={ruleset} /></div>
              </div>
            </RecordSection>}

            <RecordSection title="Record sources and review" {...recordSectionProps('source')}>
              {knowledge.additionalDetails.length > 0 && <div><p className="mb-2 text-sm font-semibold">Unclassified source notes</p><RecordList items={knowledge.additionalDetails} /></div>}
              <div className={knowledge.additionalDetails.length > 0 ? 'mt-5 border-t border-border pt-5' : ''}>
                <p className="mb-2 text-sm font-semibold">Intake review</p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div><p className="mb-2 text-sm font-semibold">Sheet summary</p><RecordList items={result.sheet_summary} /></div>
                <div><p className="mb-2 text-sm font-semibold">Applied assumptions and corrections</p><RecordList items={[...result.applied_assumptions, ...result.player_corrections]} /></div>
                <div><p className="mb-2 text-sm font-semibold">Detected issues</p><RecordList items={result.detected_issues.map((issue) => `${issue.category}: ${issue.issue} — ${issue.why_it_matters}`)} /></div>
                <div><p className="mb-2 text-sm font-semibold">Details not found</p><RecordList items={result.details_not_found} /></div>
              </div>
              </div>
              <div className="mt-5 border-t border-border pt-5">
                <p className="mb-2 text-sm font-semibold">Original submitted text</p>
              {character.sourceText ? (
                <pre className="max-h-[38rem] overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-4 font-mono text-xs leading-relaxed">{character.sourceText}</pre>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">The original upload was a digital file whose raw text is not stored in the browser. The structured sections above contain the information extracted during intake.</p>
              )}
              </div>
            </RecordSection>
          </div>
        </div>
      </div>
    </div>
  )
}


export function AigmGameplayShell() {
  const { reducedMotion } = useMotionPreference()
  const [partyState, setPartyState] = useState<SavedAdventureState | null>(null)
  const [hydratingAdventure, setHydratingAdventure] = useState(true)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [recordEditorCharacterId, setRecordEditorCharacterId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingReply, setStreamingReply] = useState('')
  const [voiceCaptureBusy, setVoiceCaptureBusy] = useState(false)
  const [checkingCampaignNotes, setCheckingCampaignNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [diceQuantity, setDiceQuantity] = useState(1)
  const [lastRoll, setLastRoll] = useState<string | null>(null)
  const [pendingDice, setPendingDice] = useState<string | null>(null)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [ownerGodModeActive, setOwnerGodModeActive] = useState(false)
  const [ownerQaAccess, setOwnerQaAccess] = useState(false)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [billingNotice, setBillingNotice] = useState<string | null>(null)
  const [billingActionUrl, setBillingActionUrl] = useState<string | null>(null)
  const [mobilePanel, setMobilePanel] = useState<'gameplay' | 'tools' | 'characters'>('gameplay')
  const [dragTargetCharacterId, setDragTargetCharacterId] = useState<string | null>(null)
  const [initiativeOpen, setInitiativeOpen] = useState(false)
  const [sessionToolsOpen, setSessionToolsOpen] = useState(false)
  const [voiceGuidedDialogOpen, setVoiceGuidedDialogOpen] = useState(false)
  const [characterAssistanceDialogOpen, setCharacterAssistanceDialogOpen] = useState(false)
  const [levelUpDialogOpen, setLevelUpDialogOpen] = useState(false)
  const [levelUpCharacterId, setLevelUpCharacterId] = useState<string | null>(null)
  const [storyDirectionDialogOpen, setStoryDirectionDialogOpen] = useState(false)
  const [storyDirectionBeginsAdventure, setStoryDirectionBeginsAdventure] = useState(false)
  const [exportGameHelpDialogOpen, setExportGameHelpDialogOpen] = useState(false)
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState('')
  const conversationRef = useRef<HTMLDivElement | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const voiceControlsRef = useRef<AigmVoiceControlsHandle | null>(null)
  const userScrolledAwayRef = useRef(false)
  const initiallyPositionedAdventureRef = useRef<string | null>(null)
  const queuedVoiceTurnRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function restoreAdventure() {
      const adventureId = window.localStorage.getItem(CURRENT_ADVENTURE_KEY)
      const loaded = adventureId ? await loadAdventureState(window.localStorage, adventureId) : { state: null }
      let saved = loaded.state
      if (cancelled) return
      if (saved?.character_record_migration === 'needs_srd_enrichment') {
        // Opening an older Build 4.11 adventure performs and persists the 4.12
        // canonical character-record migration without asking the player to edit it.
        let upgraded = saved
        try {
          const response = await fetch('/api/aigm/character-record-migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              characters: saved.characters.flatMap((character) => character.result ? [{
                id: character.id,
                result: character.result,
                advancement_profiles: character.advancementProfiles ?? [],
              }] : []),
            }),
          })
          const payload = (await response.json()) as CharacterRecordMigrationResponse
          if (response.ok && Array.isArray(payload.characters)) {
            const results = new Map(payload.characters.map((entry) => [entry.id, entry.result]))
            upgraded = {
              ...saved,
              character_record_migration: 'complete',
              characters: saved.characters.map((character) => results.has(character.id)
                ? { ...character, result: results.get(character.id)! }
                : character),
            }
          }
        } catch {
          // The local structural migration is still safe to save. A later open
          // can retry optional built-in rules enrichment if the request failed.
        }
        await saveAdventureState(window.localStorage, upgraded, saved)
        saved = upgraded
        if (cancelled) return
      }
      setPartyState(saved)
      setHydratingAdventure(false)
    }
    void restoreAdventure().catch(() => {
      if (!cancelled) setHydratingAdventure(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restorePlayAccess() {
      try {
        const response = await fetch('/api/play/access', { cache: 'no-store' })
        const payload = (await response.json().catch(() => ({}))) as { owner_qa?: boolean; voice_available?: boolean }
        if (cancelled) return
        const ownerQa = Boolean(response.ok && payload.owner_qa)
        setOwnerQaAccess(ownerQa)
        setVoiceAvailable(Boolean(response.ok && payload.voice_available))
        if (ownerQa && window.sessionStorage.getItem(OWNER_GOD_MODE_SESSION_KEY) === 'active') {
          setOwnerGodModeActive(true)
        } else if (!ownerQa) {
          setOwnerGodModeActive(false)
          window.sessionStorage.removeItem(OWNER_GOD_MODE_SESSION_KEY)
        }
      } catch {
        if (!cancelled) {
          setOwnerQaAccess(false)
          setVoiceAvailable(false)
          setOwnerGodModeActive(false)
          window.sessionStorage.removeItem(OWNER_GOD_MODE_SESSION_KEY)
        }
      }
    }

    void restorePlayAccess()
    return () => { cancelled = true }
  }, [])


  const readyCharacters = useMemo(() => partyState?.characters.filter((character) => character.status === 'ready' && character.result) ?? [], [partyState])
  const orderedCharacters = readyCharacters

  const selectedCharacter = selectedCharacterId
    ? partyState?.characters.find((character) => character.id === selectedCharacterId) ?? null
    : null

  const gameplay = partyState?.gameplay ?? emptyGameplayState()
  const transcript = gameplay.transcript.length > 0 ? gameplay.transcript : gameplay.messages
  const voiceGuidedPlay = useMemo(() => normalizeVoiceGuidedPlaySettings(partyState?.voice_guided_play ?? defaultVoiceGuidedPlaySettings()), [partyState?.voice_guided_play])
  const characterAssistanceLevel = typeof partyState?.character_assistance_level === 'number'
    ? Math.max(1, Math.min(10, Math.round(partyState.character_assistance_level)))
    : 5

  function persist(nextState: SavedAdventureState) {
    const previousState = partyState
    setPartyState(nextState)
    void saveAdventureState(window.localStorage, nextState, previousState).catch(() => {
      setError('The browser could not save this turn locally. Your adventure normally survives closing the browser, but clearing browser data, private browsing, or changing devices can remove local saves. Use Export Your Game in Session tools to download a portable game file now.')
    })
  }

  function updateGameplay(nextGameplay: GameplayState) {
    if (!partyState) return
    persist({ ...partyState, updated_at: new Date().toISOString(), gameplay: nextGameplay })
  }

  function movePartyCharacter(characterId: string, direction: -1 | 1) {
    if (!partyState) return
    const readyIds = readyCharacters.map((character) => character.id)
    const currentIndex = readyIds.indexOf(characterId)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= readyIds.length) return
    const targetId = readyIds[targetIndex]
    const characters = [...partyState.characters]
    const characterIndex = characters.findIndex((character) => character.id === characterId)
    const swapIndex = characters.findIndex((character) => character.id === targetId)
    if (characterIndex < 0 || swapIndex < 0) return
    ;[characters[characterIndex], characters[swapIndex]] = [characters[swapIndex], characters[characterIndex]]
    persist({ ...partyState, characters, updated_at: new Date().toISOString() })
  }

  function reorderPartyCharacter(characterId: string, targetCharacterId: string) {
    if (!partyState || characterId === targetCharacterId) return
    const sourceIndex = readyCharacters.findIndex((character) => character.id === characterId)
    const targetIndex = readyCharacters.findIndex((character) => character.id === targetCharacterId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const reorderedReady = [...readyCharacters]
    const [moved] = reorderedReady.splice(sourceIndex, 1)
    reorderedReady.splice(targetIndex, 0, moved)
    let readyIndex = 0
    const characters = partyState.characters.map((character) => {
      if (character.status !== 'ready' || !character.result) return character
      return reorderedReady[readyIndex++] ?? character
    })
    persist({ ...partyState, characters, updated_at: new Date().toISOString() })
  }

  function addAnotherCharacter() {
    setError('Adding characters will return with the rebuilt Start experience. This release is focused on continuing existing adventures.')
  }

  function updateVoiceGuidedPlay(nextSettings: VoiceGuidedPlaySettings) {
    if (!partyState) return
    const normalized = normalizeVoiceGuidedPlaySettings(nextSettings)
    persist({ ...partyState, voice_guided_play: normalized, updated_at: new Date().toISOString() })
  }

  function saveCharacterAssistanceLevel(level: number) {
    if (!partyState) return
    const nextLevel = Math.max(1, Math.min(10, Math.round(level)))
    persist({ ...partyState, character_assistance_level: nextLevel, updated_at: new Date().toISOString() })
    setCharacterAssistanceDialogOpen(false)
  }

  function openLevelUp(characterId?: string | null) {
    if (!partyState) return
    const eligibleIds = partyState.gameplay.pending_level_ups.filter((id) => partyState.characters.some((character) => character.id === id && character.status === 'ready' && character.result))
    const targetId = characterId ? (eligibleIds.includes(characterId) ? characterId : null) : (eligibleIds[0] ?? null)
    if (!targetId) {
      setError('No character is currently ready to level up. The AIGM will make Level Up available when a character earns a level.')
      return
    }
    setLevelUpCharacterId(targetId)
    setLevelUpDialogOpen(true)
  }

  function saveAdvancementProfile(characterId: string, profile: CharacterAdvancementProfile) {
    if (!partyState) return
    const profileKey = (value: CharacterAdvancementProfile) => [
      value.profile_kind === 'subclass' ? 'subclass' : 'class',
      value.class_name.trim().toLocaleLowerCase(),
      value.profile_kind === 'subclass' ? (value.subclass_name || '').trim().toLocaleLowerCase() : '',
    ].join('|')
    const characters = partyState.characters.map((character) => {
      if (character.id !== characterId) return character
      const key = profileKey(profile)
      const retained = (character.advancementProfiles ?? []).filter((saved) => profileKey(saved) !== key)
      return { ...character, advancementProfiles: [...retained, profile] }
    })
    persist({ ...partyState, characters, updated_at: new Date().toISOString() })
  }

  function closeVoiceGuidedPlayDialog() {
    voiceControlsRef.current?.stopNarration()
    setVoiceGuidedDialogOpen(false)
  }

  function closeStoryDirectionDialog() {
    voiceControlsRef.current?.stopNarration()
    setStoryDirectionDialogOpen(false)
    setStoryDirectionBeginsAdventure(false)
  }

  function saveVoiceGuidedPlay(nextSettings: VoiceGuidedPlaySettings) {
    voiceControlsRef.current?.stopNarration()
    updateVoiceGuidedPlay(nextSettings)
    setVoiceGuidedDialogOpen(false)
    if (nextSettings.enabled) voiceControlsRef.current?.prepareNarration()
  }

  function updateCharacterIdentity(characterId: string, update: CharacterIdentityUpdate) {
    if (!partyState) return
    const characters = partyState.characters.map((character) => {
      if (character.id !== characterId || !character.result) return character
      return {
        ...character,
        playName: update.playName === undefined ? character.playName : update.playName.slice(0, 12),
        portraitUrl: update.portraitUrl === undefined ? character.portraitUrl : update.portraitUrl,
        result: {
          ...character.result,
          character: {
            ...character.result.character,
            name: update.fullName === undefined ? character.result.character.name : update.fullName,
            initiative_modifier: update.initiativeModifier === undefined
              ? character.result.character.initiative_modifier
              : update.initiativeModifier,
          },
          player_corrections: uniqueText([
            ...character.result.player_corrections,
            update.fullName === undefined ? '' : `Character name corrected to ${update.fullName}.`,
            update.initiativeModifier === undefined ? '' : `Initiative modifier corrected to ${signedNumber(update.initiativeModifier)}.`,
          ]),
        },
      }
    })
    persist({ ...partyState, characters, updated_at: new Date().toISOString() })
  }


  function saveCharacterRecordEdit(characterId: string, proposedResult: CharacterIntakeResult, proposedPlayName: string) {
    if (!partyState) return
    let completedExternalLevelUp = false
    const characters = partyState.characters.map((character) => {
      if (character.id !== characterId || !character.result) return character
      const normalizedProposal = normalizeCharacterIntakeResult(proposedResult)
      const revisedResult: CharacterIntakeResult = {
        ...normalizedProposal,
        character: {
          ...normalizedProposal.character,
          is_current_party_active_leader: character.result.character.is_current_party_active_leader === true,
        },
      }
      completedExternalLevelUp = partyState.gameplay.pending_level_ups.includes(characterId)
        && revisedResult.character.total_level > character.result.character.total_level
      return {
        ...character,
        playName: proposedPlayName.replace(/\s+/g, ' ').trim().slice(0, 12) || character.playName,
        result: revisedResult,
        liveState: reconcileLiveStateAfterRecordEdit(character.liveState, character.result, revisedResult),
      }
    })
    const gameplay = completedExternalLevelUp
      ? { ...partyState.gameplay, pending_level_ups: partyState.gameplay.pending_level_ups.filter((id) => id !== characterId) }
      : partyState.gameplay
    persist({ ...partyState, characters, gameplay, updated_at: new Date().toISOString() })
    setRecordEditorCharacterId(null)
  }


  function saveLevelUpRecord(characterId: string, proposedResult: CharacterIntakeResult, proposedPlayName: string, advancingClass: string, history: CharacterClassLevelHistory, hitPointDie?: number) {
    if (!partyState || !partyState.gameplay.pending_level_ups.includes(characterId)) return
    const characters = partyState.characters.map((character) => {
      if (character.id !== characterId || !character.result) return character
      const normalizedProposal = normalizeCharacterIntakeResult(proposedResult)
      const revisedResult: CharacterIntakeResult = {
        ...normalizedProposal,
        character: {
          ...normalizedProposal.character,
          is_current_party_active_leader: character.result.character.is_current_party_active_leader === true,
        },
      }
      const classKey = history.class_feature_names.length || history.subclass_name || history.progression_values.length
        ? history
        : { ...history, class_feature_names: [] }
      const existingRecords = character.classRecords ?? []
      const className = advancingClass.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Class'
      const priorRecord = existingRecords.find((record) => record.class_name.trim().toLocaleLowerCase('en-US') === className.trim().toLocaleLowerCase('en-US'))
      const updatedRecord = {
        class_name: className,
        hit_point_die: hitPointDie || priorRecord?.hit_point_die,
        levels: [...(priorRecord?.levels ?? []).filter((entry) => !(entry.class_level === history.class_level && entry.total_character_level === history.total_character_level)), classKey]
          .sort((left, right) => left.total_character_level - right.total_character_level || left.class_level - right.class_level),
      }
      const classRecords = priorRecord
        ? existingRecords.map((record) => record === priorRecord ? updatedRecord : record)
        : [...existingRecords, updatedRecord]
      return {
        ...character,
        playName: proposedPlayName.replace(/\s+/g, ' ').trim().slice(0, 12) || character.playName,
        result: revisedResult,
        liveState: reconcileLiveStateAfterRecordEdit(character.liveState, character.result, revisedResult),
        classRecords,
      }
    })
    const gameplay = {
      ...partyState.gameplay,
      pending_level_ups: partyState.gameplay.pending_level_ups.filter((id) => id !== characterId),
    }
    persist({ ...partyState, characters, gameplay, updated_at: new Date().toISOString() })
  }

  function scrollToLatest(force = false) {
    if (!force && userScrolledAwayRef.current) return
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'end' }))
  }

  useLayoutEffect(() => {
    if (hydratingAdventure || !partyState) return
    if (initiallyPositionedAdventureRef.current === partyState.adventure_id) return
    initiallyPositionedAdventureRef.current = partyState.adventure_id
    userScrolledAwayRef.current = false
    setShowJumpButton(false)
    const element = conversationRef.current
    if (element) element.scrollTop = element.scrollHeight
  }, [hydratingAdventure, partyState?.adventure_id])

  useEffect(() => {
    scrollToLatest()
  }, [gameplay.messages.length, streamingReply, reducedMotion])

  function handleConversationScroll() {
    const element = conversationRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    const away = distance > 140
    userScrolledAwayRef.current = away
    setShowJumpButton(away)
  }

  function requestAdventureOpening() {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => undefined)
    }
    voiceControlsRef.current?.prepareNarration()
    let hasSeenStoryDirection = false
    try {
      hasSeenStoryDirection = window.localStorage.getItem(STORY_DIRECTION_SEEN_KEY) === 'true'
    } catch {
      // The one-time explanation can still be shown for this visit.
    }
    if (!hasSeenStoryDirection) {
      try { window.localStorage.setItem(STORY_DIRECTION_SEEN_KEY, 'true') } catch { /* one-time preference only */ }
      setStoryDirectionBeginsAdventure(true)
      setStoryDirectionDialogOpen(true)
      return
    }
    void callAigm('opening')
  }

  function beginAdventureAfterDirectionHelp() {
    setStoryDirectionDialogOpen(false)
    setStoryDirectionBeginsAdventure(false)
    voiceControlsRef.current?.prepareNarration()
    void callAigm('opening')
  }

  function openStoryDirectionHelp() {
    try { window.localStorage.setItem(STORY_DIRECTION_SEEN_KEY, 'true') } catch { /* one-time preference only */ }
    setStoryDirectionBeginsAdventure(false)
    setStoryDirectionDialogOpen(true)
  }

  function handleGuidedTranscriptComplete(text: string) {
    const clean = text.trim()
    if (!clean) return
    setMessage('')
    if (sending) {
      queuedVoiceTurnRef.current = clean
      setScreenReaderAnnouncement('Your spoken turn is ready and will be sent when the Game Master finishes responding.')
      return
    }
    void callAigm('turn', clean)
  }

  useEffect(() => {
    if (sending || !queuedVoiceTurnRef.current) return
    const queuedTurn = queuedVoiceTurnRef.current
    queuedVoiceTurnRef.current = null
    const timer = window.setTimeout(() => void callAigm('turn', queuedTurn), 0)
    return () => window.clearTimeout(timer)
  }, [sending, partyState?.updated_at])

  async function callAigm(mode: 'opening' | 'turn', playerText = '', gameplayOverride?: GameplayState, countTurn = true, partyStateOverride?: SavedAdventureState) {
    const activePartyState = partyStateOverride ?? partyState
    if (!activePartyState || sending) return
    const activeGameplay = gameplayOverride ?? gameplay
    const diceResult = mode === 'turn' && !gameplayOverride ? pendingDice || '' : ''
    const visibleUserText = diceResult ? [playerText.trim(), `Dice result: ${diceResult}`].filter(Boolean).join('\n\n') : playerText
    const activeTranscript = activeGameplay.transcript.length > 0 ? activeGameplay.transcript : activeGameplay.messages
    const nextSequence = (activeTranscript.at(-1)?.sequence ?? activeTranscript.length) + 1
    const exchangeId = crypto.randomUUID()
    const exchangeTurn = mode === 'opening' ? 0 : countTurn ? activeGameplay.turn_count + 1 : activeGameplay.turn_count
    const userEntry = mode === 'turn' ? nowMessage('user', visibleUserText, nextSequence, exchangeTurn, exchangeId) : null
    const transcriptWithUser = userEntry ? [...activeTranscript, userEntry] : activeTranscript
    const messagesWithUser = transcriptWithUser.slice(-120)
    const shouldRecall = mode === 'turn' && shouldCheckCampaignNotes(visibleUserText, activeGameplay.memory_index)
    const continuityAuditRequested = mode === 'turn' && isContinuityAuditRequest(visibleUserText)
    const campaignRecall = shouldRecall
      ? searchCampaignHistory(visibleUserText, activeGameplay.memory_index, transcriptWithUser)
      : { memory_entries: [], transcript_excerpts: [] }

    setSending(true)
    setCheckingCampaignNotes(shouldRecall)
    setError(null)
    setBillingActionUrl(null)
    setBillingNotice(null)
    setStreamingReply('')
    setScreenReaderAnnouncement(mode === 'opening' ? 'The Game Master is preparing the opening scene.' : 'Your turn was sent. The Game Master is responding.')
    voiceControlsRef.current?.beginNarration()
    userScrolledAwayRef.current = false
    setShowJumpButton(false)

    if (userEntry) {
      persist({ ...activePartyState, updated_at: new Date().toISOString(), gameplay: { ...activeGameplay, messages: messagesWithUser, transcript: transcriptWithUser } })
      setMessage('')
      setPendingDice(null)
      if (diceResult) setLastRoll(null)
    }

    try {
      const response = await fetch('/api/aigm/gameplay-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rpgyw-operation-id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          mode,
          message: playerText,
          dice_result: diceResult,
          adventure_id: activePartyState.adventure_id,
          adventure_name: activePartyState.adventure_name,
          game_master_name: activePartyState.game_master_name,
          campaign_direction: activePartyState.campaign_direction,
          campaign_scale: activePartyState.campaign_scale,
          setup_answers: activePartyState.setup_answers,
          lore_fidelity: activePartyState.lore_fidelity,
          content_mode: activePartyState.content_mode,
          content_mode_import_mismatch: Boolean(activePartyState.content_mode_import_mismatch),
          content_mode_explanation_given: Boolean(activePartyState.content_mode_explanation_given),
          campaign_summary: activeGameplay.campaign_summary,
          dm_secrets: activeGameplay.dm_secrets,
          recalled_memories: campaignRecall.memory_entries,
          continuity_audit_requested: continuityAuditRequested,
          canonical_retcons: activeGameplay.retcons,
          known_npc_names: establishedNpcNames(activeGameplay.memory_index),
          known_location_names: activeGameplay.memory_index
            .filter((entry) => entry.kind === 'location')
            .map((entry) => entry.title),
          recalled_transcript: campaignRecall.transcript_excerpts,
          migration_history: activeGameplay.dm_secrets.initialized ? [] : campaignMigrationSample(activeTranscript),
          scene: activeGameplay.scene,
          turn_count: activeGameplay.turn_count,
          combat_active: activeGameplay.combat_active,
          initiative: activeGameplay.initiative,
          party: compactParty(activePartyState.characters.filter((character) => character.status === 'ready' && character.result)),
          recent_messages: messagesWithUser.slice(-DIRECT_RECENT_MESSAGE_COUNT).map((entry) => ({ role: entry.role, text: entry.text })),
          pending_level_up_character_ids: activeGameplay.pending_level_ups,
          owner_god_mode: ownerGodModeActive,
          voice_guided_play: voiceAvailable && voiceGuidedPlay.enabled,
          guidance_level: voiceGuidedPlay.guidance_level,
          character_assistance_level: characterAssistanceLevel,
          dice_preference: voiceGuidedPlay.dice_preference,
          stream: true,
        }),
      })
      let payload: GameplayApiResponse
      const contentType = response.headers.get('content-type') || ''
      if (response.ok && contentType.includes('application/x-ndjson')) {
        payload = await readGameplayStream(response, (delta) => {
          setStreamingReply((current) => current + delta)
          voiceControlsRef.current?.appendNarrationDelta(delta)
        })
      } else {
        payload = (await response.json()) as GameplayApiResponse
      }
      if (!response.ok || !payload.message) {
        if (response.status === 402 || payload.code === 'insufficient_balance') {
          setBillingActionUrl(payload.add_usage_url || '/account#add-usage')
        }
        throw new Error([payload.error || 'The gameplay AIGM could not answer.', payload.details, payload.request_id ? `Reference: ${payload.request_id}` : ''].filter(Boolean).join(' '))
      }
      voiceControlsRef.current?.finishNarration(payload.message)
      setScreenReaderAnnouncement(voiceGuidedPlay.enabled && voiceAvailable
        ? 'The Game Master reply is complete and is being read aloud.'
        : `${activePartyState.game_master_name || 'Game Master'}: ${payload.message}`)
      const remainingBalance = payload.usage_billing?.balance_microusd
      if (!payload.usage_billing?.owner_qa_exempt && typeof remainingBalance === 'number' && remainingBalance <= 1_000_000) {
        setBillingNotice(`Low balance: $${(Math.max(0, remainingBalance) / 1_000_000).toFixed(2)} remaining.`)
        setBillingActionUrl('/account#add-usage')
      }

      if (payload.owner_god_mode_active === true && ownerQaAccess) {
        setOwnerGodModeActive(true)
        window.sessionStorage.setItem(OWNER_GOD_MODE_SESSION_KEY, 'active')
      } else if (payload.owner_god_mode_active === false) {
        setOwnerGodModeActive(false)
        window.sessionStorage.removeItem(OWNER_GOD_MODE_SESSION_KEY)
      }

      const assistantEntry = nowMessage('assistant', payload.message, nextSequence + (userEntry ? 1 : 0), exchangeTurn, exchangeId)
      setStreamingReply('')
      const npcInitiative: InitiativeEntry[] = (payload.npc_initiative ?? []).map((entry) => ({
        character_id: `npc:${entry.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}:${crypto.randomUUID()}`,
        entity_type: 'npc',
        name: entry.name,
        modifier: entry.modifier,
        roll: entry.roll,
        total: entry.total,
      }))
      const mergedInitiative = [...activeGameplay.initiative, ...npcInitiative]
        .filter((entry, index, entries) => entries.findIndex((candidate) =>
          candidate.entity_type === entry.entity_type &&
          candidate.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase()
        ) === index)
        .sort((left, right) => right.total - left.total || right.modifier - left.modifier)
      const updatedCharacters = activePartyState.characters.map((character) => {
        if (!character.result) return character
        const liveUpdate = payload.character_updates?.find((entry) => entry.character_id === character.id)
        const recordUpdate = payload.character_record_updates?.find((entry) => entry.character_id === character.id)

        const revisedClassSummary = recordUpdate
          ? recordUpdate.classes.map((entry) => [entry.name, entry.level, entry.subclass ? `(${entry.subclass})` : ''].filter(Boolean).join(' ')).join(' / ')
          : ''
        const revisedSheetSummary = recordUpdate
          ? character.result.sheet_summary.length > 0
            ? character.result.sheet_summary.map((entry, index) => index === 0
              ? [character.result?.character.species, revisedClassSummary].filter(Boolean).join(' ')
              : entry)
            : [[character.result.character.species, revisedClassSummary].filter(Boolean).join(' ')]
          : character.result.sheet_summary

        const revisedResult: CharacterIntakeResult = recordUpdate ? canonicalizeCharacterRecord({
          ...character.result,
          sheet_summary: revisedSheetSummary,
          player_corrections: uniqueText([
            ...character.result.player_corrections,
            ...recordUpdate.player_corrections,
            `Level updated to ${recordUpdate.total_level} during gameplay.`,
          ]),
          character: {
            ...character.result.character,
            classes: recordUpdate.classes,
            total_level: recordUpdate.total_level,
            proficiency_bonus: recordUpdate.proficiency_bonus || character.result.character.proficiency_bonus,
            hit_points: {
              ...character.result.character.hit_points,
              maximum: recordUpdate.maximum_hit_points,
            },
            features: [
              ...characterFeatureEntries(character.result, character.advancementProfiles ?? []),
              ...recordUpdate.features_to_add.map((name) => ({
                id: `gameplay-${normalizedRecordName(name).replace(/\s+/g, '-')}`,
                name,
                detail: '',
                category: 'other' as const,
                class_name: '',
                subclass_name: '',
                level_gained: recordUpdate.total_level,
                source: 'Gameplay record update',
              })),
            ],
            spellcasting: {
              ...character.result.character.spellcasting,
              slots: recordUpdate.spell_slots,
              cantrips: uniqueText([...character.result.character.spellcasting.cantrips, ...recordUpdate.cantrips_to_add]),
              prepared_or_known_spells: uniqueText([...character.result.character.spellcasting.prepared_or_known_spells, ...recordUpdate.prepared_or_known_spells_to_add]),
              spellbook_or_other_spells: uniqueText([...character.result.character.spellcasting.spellbook_or_other_spells, ...recordUpdate.spellbook_or_other_spells_to_add]),
            },
          },
        }, character.advancementProfiles ?? []) : character.result

        const recordLiveUpdate = recordUpdate ? {
          maximum_hit_points: recordUpdate.maximum_hit_points,
          spell_slots: recordUpdate.spell_slots.map((slot) => ({
            level: slot.level,
            total: slot.total_shown,
            used: slot.used_shown,
          })),
        } : undefined
        const liveStateWithRecord = recordLiveUpdate
          ? mergeLiveStateUpdate(character.liveState, recordLiveUpdate, revisedResult)
          : character.liveState
        const nextLiveState = liveUpdate ? mergeLiveStateUpdate(liveStateWithRecord, {
          current_hit_points: liveUpdate.current_hit_points,
          maximum_hit_points: liveUpdate.maximum_hit_points,
          temporary_hit_points: liveUpdate.temporary_hit_points,
          armor_class: liveUpdate.armor_class,
          conditions: liveUpdate.conditions,
          concentration: liveUpdate.concentration,
          death_saves: liveUpdate.death_save_successes === undefined && liveUpdate.death_save_failures === undefined
            ? undefined
            : {
                successes: liveUpdate.death_save_successes ?? liveStateWithRecord?.death_saves.successes ?? 0,
                failures: liveUpdate.death_save_failures ?? liveStateWithRecord?.death_saves.failures ?? 0,
              },
          resources: liveUpdate.resources,
          spell_slots: liveUpdate.spell_slots,
          currency: liveUpdate.currency ? {
            ...liveUpdate.currency,
            total_gp_value: Number((
              liveUpdate.currency.cp / 100
              + liveUpdate.currency.sp / 10
              + liveUpdate.currency.ep / 2
              + liveUpdate.currency.gp
              + liveUpdate.currency.pp * 10
            ).toFixed(2)),
          } : undefined,
          notes: liveUpdate.notes,
        }, revisedResult) : liveStateWithRecord

        if (!recordUpdate && !liveUpdate) return character
        return {
          ...character,
          result: revisedResult,
          liveState: nextLiveState,
        }
      })

      const completeTranscript = [...transcriptWithUser, assistantEntry]
      const nextGameplay: GameplayState = {
        ...activeGameplay,
        messages: completeTranscript.slice(-120),
        transcript: completeTranscript,
        campaign_summary: payload.campaign_summary ?? activeGameplay.campaign_summary,
        scene: payload.scene ?? activeGameplay.scene,
        turn_count: activeGameplay.turn_count + (mode === 'turn' && countTurn ? 1 : 0),
        combat_active: activeGameplay.combat_active || mergedInitiative.length > 0,
        initiative: mergedInitiative,
        dm_secrets: payload.dm_secrets ?? activeGameplay.dm_secrets,
        memory_index: mergeCampaignMemory(activeGameplay.memory_index, stampCampaignMemoryUpdates(payload.memory_updates ?? [], exchangeTurn)),
        retcons: mergeCampaignRetcons(activeGameplay.retcons, payload.retcon_updates ?? []),
        pending_level_ups: uniqueText([
          ...activeGameplay.pending_level_ups,
          ...(payload.level_up_ready_character_ids ?? []),
        ]).filter((id) => !(payload.level_up_resolved_character_ids ?? []).includes(id))
          .filter((id) => updatedCharacters.some((character) => character.id === id)),
      }
      const nextGameMasterName = payload.game_master_name?.replace(/\s+/g, ' ').trim().slice(0, 80) || activePartyState.game_master_name
      persist({ ...activePartyState, game_master_name: nextGameMasterName, characters: updatedCharacters, content_mode_explanation_given: Boolean(activePartyState.content_mode_explanation_given || payload.content_mode_explanation_given), updated_at: new Date().toISOString(), gameplay: nextGameplay })
      if (payload.combat_suggested && nextGameplay.initiative.length === 0) {
        setError('The situation may be entering combat. Use Roll party initiative when everyone is ready.')
      }
      scrollToLatest(true)
    } catch (caught) {
      voiceControlsRef.current?.stopNarration()
      setStreamingReply('')
      const errorMessage = caught instanceof Error ? caught.message : 'The browser could not reach the gameplay AIGM.'
      setError(errorMessage)
      setScreenReaderAnnouncement(errorMessage)
    } finally {
      setSending(false)
      setCheckingCampaignNotes(false)
      if (!(voiceAvailable && voiceGuidedPlay.enabled)) textareaRef.current?.focus()
    }
  }

  function transcriptText() {
    const title = partyState?.adventure_name || 'AIGM Adventure'
    const lines = transcript.flatMap((entry) => {
      const speaker = entry.role === 'assistant' ? (partyState?.game_master_name || 'GAME MASTER').toLocaleUpperCase() : 'PLAYER'
      const timestamp = entry.created_at ? ` · ${new Date(entry.created_at).toLocaleString()}` : ''
      return [`${speaker}${timestamp}`, entry.text.trim(), '']
    })
    return [`${title} · RAW GAMEPLAY TRANSCRIPT`, 'This is the unedited player and Game Master chat.', `Exported ${new Date().toLocaleString()}`, '', ...lines].join('\n')
  }

  function safeFilename(value: string) {
    return value.trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'Adventure'
  }

  function downloadAdventure() {
    if (!partyState) return
    const snapshot = { ...partyState, updated_at: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = campaignBackupFilename(partyState.adventure_name || 'Adventure')
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function downloadTranscript() {
    if (transcript.length === 0) return
    const blob = new Blob([transcriptText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `AIGM_${safeFilename(partyState?.adventure_name || 'Adventure')}_Transcript.txt`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function printTranscript() {
    if (transcript.length === 0) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setError('The browser blocked the printable transcript window. Allow pop-ups for this page and try again.')
      return
    }
    printWindow.opener = null
    const escaped = transcriptText()
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
    printWindow.document.write(`<!doctype html><html><head><title>${safeFilename(partyState?.adventure_name || 'Adventure')} transcript</title><style>body{font-family:Georgia,serif;max-width:52rem;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#171717}pre{white-space:pre-wrap;font:inherit}@media print{body{margin:0;max-width:none}}</style></head><body><pre>${escaped}</pre><script>window.onload=()=>window.print()<\/script></body></html>`)
    printWindow.document.close()
  }

  function submitTurn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || sending) return
    void callAigm('turn', trimmed)
  }

  function handleGameplayKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!sending && message.trim()) event.currentTarget.form?.requestSubmit()
  }

  function setDiceMode(mode: 'purist' | 'cheat') {
    if (lastRoll && gameplay.dice_mode === 'purist' && mode === 'cheat') {
      const confirmed = window.confirm('Switch to Cheat mode after seeing this roll? The current result will remain in the transcript if you send it.')
      if (!confirmed) return
    }
    updateGameplay({ ...gameplay, dice_mode: mode })
  }

  function sendLatestRoll() {
    if (!pendingDice || sending || gameplay.messages.length === 0) return
    void callAigm('turn', message.trim())
  }

  function rollDice(sides: number) {
    if (gameplay.dice_mode === 'purist' && lastRoll) return
    const results = Array.from({ length: diceQuantity }, () => rollDie(sides))
    const total = results.reduce((sum, value) => sum + value, 0)
    const label = `${diceQuantity}d${sides}: ${results.join(', ')}${diceQuantity > 1 ? ` (total ${total})` : ''}`
    setLastRoll(label)
    setPendingDice(label)
  }

  function rollPartyInitiative() {
    setInitiativeOpen(true)
    if (!partyState || sending) return
    const initiative = readyCharacters.map((character) => {
      const modifier = character.result ? getInitiativeModifier(character.result) : 0
      const roll = rollDie(20)
      return {
        character_id: character.id,
        entity_type: 'player' as const,
        name: playNameFor(character),
        modifier,
        roll,
        total: roll + modifier,
      }
    }).sort((left, right) => right.total - left.total || right.modifier - left.modifier)

    const nextGameplay = { ...gameplay, combat_active: true, initiative }
    const initiativeOrder = initiative.map((entry) => entry.character_id)
    const orderedReady = initiativeOrder
      .map((characterId) => partyState.characters.find((character) => character.id === characterId))
      .filter((character): character is StoredPartyCharacter => Boolean(character))
    let readyIndex = 0
    const characters = partyState.characters.map((character) =>
      character.status === 'ready' && character.result ? (orderedReady[readyIndex++] ?? character) : character,
    )
    const nextPartyState = { ...partyState, characters, updated_at: new Date().toISOString(), gameplay: nextGameplay }
    persist(nextPartyState)

    if (gameplay.messages.length > 0) {
      void callAigm(
        'turn',
        'Party initiative has been rolled through the interface. Use the listed totals, roll initiative for every active NPC and enemy, and begin combat without asking me to repeat any roll.',
        nextGameplay,
        false,
        nextPartyState,
      )
    }
  }

  function clearInitiative() {
    updateGameplay({ ...gameplay, combat_active: false, initiative: [] })
  }

  if (hydratingAdventure) {
    return (
      <main id="main-content" tabIndex={-1} className="medieval-page medieval-page--play flex min-h-screen items-center justify-center px-5 text-foreground">
        <div className="max-w-xl rounded-3xl border border-primary/30 bg-primary/10 p-8 text-center">
          <LoaderCircle className="mx-auto size-10 animate-spin text-primary" aria-hidden="true" />
          <h1 className="mt-4 font-display text-3xl font-bold">Opening your adventure…</h1>
          <p className="mt-3 text-muted-foreground">Restoring the campaign saved in this browser.</p>
        </div>
      </main>
    )
  }

  if (!partyState) {
    return (
      <main id="main-content" tabIndex={-1} className="medieval-page medieval-page--play flex min-h-screen items-center justify-center px-5 text-foreground">
        <div className="max-w-xl rounded-3xl border border-primary/30 bg-primary/10 p-8 text-center">
          <Shield className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 font-display text-3xl font-bold">No saved adventure found</h1>
          <p className="mt-3 text-muted-foreground">No current adventure is selected in this browser. Go to Start to choose or import one.</p>
          <Link href="/start" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground">Go to Start</Link>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" tabIndex={-1} className="medieval-page medieval-page--play aigm-gameplay-main h-[100dvh] overflow-hidden p-3 pb-[calc(5.75rem+env(safe-area-inset-bottom))] text-foreground sm:p-4 sm:pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:pb-4">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{screenReaderAnnouncement}</div>
      <div className="aigm-gameplay-grid mx-auto grid h-full max-w-[1700px] grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,2.4fr)_minmax(250px,0.86fr)] lg:gap-4">
        <aside className={`${mobilePanel === 'tools' ? 'flex' : 'hidden'} aigm-tools-panel order-1 min-h-0 min-w-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-card p-4 lg:order-1 lg:flex`} aria-label="Dice and initiative controls">
          <button type="button" onClick={() => setMobilePanel('gameplay')} className="mb-1 inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/45 bg-primary/10 px-4 text-sm font-bold text-primary lg:hidden">Back to gameplay</button>
          <section>
            <div className="aigm-dice-heading flex items-center gap-2">
              <Dices className="size-5 shrink-0 text-primary" aria-hidden="true" /><h2 className="font-display text-xl font-bold leading-tight">Roll Your Dice Here</h2>
            </div>
            <div className="aigm-dice-mode-toggle mt-1 grid w-full grid-cols-2 rounded-xl p-1" aria-label="Dice mode">
              <button type="button" onClick={() => setDiceMode('purist')} aria-pressed={gameplay.dice_mode === 'purist'} className={`aigm-dice-mode-button inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold whitespace-nowrap ${gameplay.dice_mode === 'purist' ? 'aigm-dice-mode-button--active' : ''}`}><LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />Purist</button>
              <button type="button" onClick={() => setDiceMode('cheat')} aria-pressed={gameplay.dice_mode === 'cheat'} className={`aigm-dice-mode-button inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold whitespace-nowrap ${gameplay.dice_mode === 'cheat' ? 'aigm-dice-mode-button--active' : ''}`}><UnlockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />Story first</button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-foreground" htmlFor="dice-quantity">How many dice?</label>
            <div className="aigm-dice-quantity-control mt-2 grid grid-cols-[3rem_minmax(0,1fr)_3rem] overflow-hidden rounded-xl border border-input bg-background">
              <button type="button" onClick={() => setDiceQuantity((value) => Math.max(1, value - 1))} disabled={gameplay.dice_mode === 'purist' && Boolean(lastRoll)} className="aigm-dice-stepper flex min-h-11 items-center justify-center border-r border-border text-primary transition disabled:opacity-40" aria-label="Use one fewer die"><Minus className="size-4" aria-hidden="true" /></button>
              <input id="dice-quantity" type="number" min={1} max={MAX_DICE_QUANTITY} value={diceQuantity} disabled={gameplay.dice_mode === 'purist' && Boolean(lastRoll)} onChange={(event) => setDiceQuantity(Math.max(1, Math.min(MAX_DICE_QUANTITY, Number(event.target.value) || 1)))} className="w-full bg-transparent px-3 py-2 text-center text-lg font-bold outline-none disabled:opacity-50" />
              <button type="button" onClick={() => setDiceQuantity((value) => Math.min(MAX_DICE_QUANTITY, value + 1))} disabled={gameplay.dice_mode === 'purist' && Boolean(lastRoll)} className="aigm-dice-stepper flex min-h-11 items-center justify-center border-l border-border text-primary transition disabled:opacity-40" aria-label="Use one more die"><Plus className="size-4" aria-hidden="true" /></button>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">Of which kind?</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {DICE.map((sides) => <button key={sides} type="button" onClick={() => rollDice(sides)} disabled={sending || (gameplay.dice_mode === 'purist' && Boolean(lastRoll))} className="aigm-die-button min-h-11 w-[calc(33.333%-0.4rem)] whitespace-nowrap rounded-xl border px-2 py-2 text-base font-bold disabled:cursor-not-allowed disabled:opacity-40">d{sides}</button>)}
            </div>
            {lastRoll && (
              <div className="aigm-roll-result mt-3 rounded-xl border p-3 text-sm">
                <p className="font-semibold text-primary">{lastRoll}</p>
                <p className="mt-1 text-xs text-muted-foreground">Send fate to the AIGM now, or include it with your next message.</p>
                <button type="button" onClick={sendLatestRoll} disabled={sending || gameplay.messages.length === 0} className="aigm-send-roll mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold disabled:opacity-45"><Send className="size-3.5" aria-hidden="true" />Send this roll</button>
                {gameplay.dice_mode === 'cheat' && <button type="button" onClick={() => { setPendingDice(null); setLastRoll(null) }} className="aigm-leave-roll mt-2 text-xs font-semibold underline">Leave this roll behind</button>}
              </div>
            )}
          </section>

          <section className="border-t border-border pt-4">
            <div className="grid gap-2">
              <button type="button" onClick={() => setInitiativeOpen((open) => !open)} className="aigm-initiative-toggle flex min-h-11 min-w-0 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left" aria-expanded={initiativeOpen}>
                <span className="min-w-0"><span className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Turn order</span><span className="block truncate font-display text-lg font-bold">Initiative</span></span>
                <ChevronDown className={`size-5 shrink-0 transition-transform ${initiativeOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>
              <button type="button" onClick={rollPartyInitiative} disabled={readyCharacters.length === 0 || sending} className="aigm-roll-initiative inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold disabled:opacity-40"><Swords className="size-4" aria-hidden="true" />Roll Party Initiative</button>
            </div>
            {initiativeOpen && (
              <div className="mt-3">
                {gameplay.combat_active && <span className="mb-2 inline-flex rounded-full bg-primary/15 px-2 py-1 text-[10px] font-bold text-primary">Combat order active</span>}
                <div className="space-y-2">
                  {gameplay.initiative.length > 0 ? gameplay.initiative.map((entry, index) => (
                    <div key={entry.character_id} className="rounded-xl border border-border bg-background/65 px-3 py-2">
                      <div className="flex items-center gap-2"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold">{entry.name}</span>{entry.entity_type === 'npc' && <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">NPC</span>}</div>
                      <p className="mt-1 pl-8 text-xs text-muted-foreground">Total <strong className="text-primary">{entry.total}</strong> · roll {entry.roll} · mod {signedNumber(entry.modifier)}</p>
                    </div>
                  )) : readyCharacters.map((character) => (
                    <div key={character.id} className="rounded-xl bg-secondary/60 px-3 py-2"><p className="truncate text-sm font-semibold">{playNameFor(character)}</p><p className="mt-0.5 text-xs text-muted-foreground">Modifier {signedNumber(character.result ? getInitiativeModifier(character.result) : 0)}</p></div>
                  ))}
                </div>
                {gameplay.initiative.length > 0 && <button type="button" onClick={clearInitiative} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground"><RotateCcw className="size-3.5" aria-hidden="true" />End combat order</button>}
              </div>
            )}
          </section>

          <section className="border-t border-border pt-4 text-xs text-muted-foreground">
            <MotionSettingsControl />
          </section>
        </aside>

        <section className={`${mobilePanel === 'gameplay' ? 'flex' : 'hidden'} aigm-gameplay-conversation relative order-1 min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card lg:order-2 lg:flex`} aria-label="AIGM conversation">
          <div className="aigm-gameplay-topbar border-b border-border bg-secondary/45 px-4 py-3 sm:px-5">
            <div className="aigm-gameplay-summary min-w-0">
              <span className="aigm-gameplay-summary-icon aigm-topbar-nameplate flex shrink-0 items-center justify-center bg-primary text-primary-foreground"><Sparkles className="size-5" aria-hidden="true" /></span>
              <p className="aigm-gameplay-title min-w-0 break-words font-display text-lg font-bold leading-tight">{partyState.adventure_name}</p>
              <div className="aigm-gameplay-title-controls flex shrink-0 items-center gap-1.5">
                {voiceAvailable ? <button type="button" onClick={() => setVoiceGuidedDialogOpen(true)} className={`aigm-topbar-nameplate inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${voiceGuidedPlay.enabled ? 'aigm-topbar-nameplate--active' : ''}`} aria-label="Open voice-guided play settings for blind players, screen-reader users, and those assisting them" title="Voice-guided play settings"><Headphones className="size-4" aria-hidden="true" /></button> : null}
                <FullscreenToggle className="aigm-topbar-nameplate inline-flex items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <p className="aigm-gameplay-meta min-w-0 text-xs text-muted-foreground"><span className="aigm-gameplay-gm">{partyState.game_master_name || 'Game Master'}</span><span className="aigm-gameplay-meta-separator"> · </span><span className="aigm-gameplay-scene">{gameplay.scene || 'Adventure ready'}</span><span className="aigm-gameplay-meta-separator"> · </span><span className="aigm-gameplay-turns">{gameplay.turn_count} player turn{gameplay.turn_count === 1 ? '' : 's'} saved</span></p>
            </div>
          </div>

          <div className="aigm-conversation-stage min-h-0 flex-1">
            <div className="aigm-conversation-olive-frame h-full min-h-0">
              <div ref={conversationRef} onScroll={handleConversationScroll} className="aigm-conversation-scroll h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-7">
                <div className="aigm-conversation-column mx-auto flex w-full max-w-5xl flex-col gap-5">
              {gameplay.pending_level_ups.length > 0 && (
                <div className="rounded-2xl border border-primary/45 bg-primary/10 px-4 py-4 sm:px-5">
                  <p className="font-display text-lg font-bold">Level Up ready</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{gameplay.pending_level_ups.map((id) => readyCharacters.find((character) => character.id === id)).filter(Boolean).map((character) => playNameFor(character!)).join(', ')} {gameplay.pending_level_ups.length === 1 ? 'has' : 'have'} earned a level. Use the guided Level Up interface to review advancement and update the permanent character record.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {gameplay.pending_level_ups.map((id) => {
                      const character = readyCharacters.find((entry) => entry.id === id)
                      return character ? <button key={id} type="button" onClick={() => openLevelUp(id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><Sparkles className="size-4" aria-hidden="true" />Level Up {playNameFor(character)}</button> : null
                    })}
                  </div>
                </div>
              )}
              {gameplay.messages.length === 0 ? (
                <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-primary/30 bg-primary/10 p-7 text-center">
                  <BookOpen className="mx-auto size-10 text-primary" aria-hidden="true" />
                  <h2 className="mt-4 font-display text-2xl font-bold">{partyState.adventure_name} is ready.</h2>
                  <p className="mt-3 leading-relaxed text-muted-foreground">You’re all set. When you’re ready, begin your adventure and {partyState.game_master_name || 'your Game Master'} will open the first scene.</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <button type="button" onClick={openStoryDirectionHelp} className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-normal rounded-xl border border-border bg-background px-4 py-3 text-center text-sm font-bold leading-snug text-muted-foreground"><BookOpen className="size-4 shrink-0" aria-hidden="true" />How much control do I have over what happens in the story?</button>
                    <button type="button" onClick={requestAdventureOpening} disabled={sending || readyCharacters.length === 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground disabled:opacity-45">
                      {sending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-5" aria-hidden="true" />}
                      Begin your adventure
                    </button>
                  </div>
                </div>
              ) : gameplay.messages.map((entry) => (
                <div key={entry.id} className={`aigm-message-row flex items-start gap-3 ${entry.role === 'user' ? 'justify-end' : ''}`} aria-label={entry.role === 'assistant' ? `${partyState.game_master_name || 'Game Master'} message` : 'Player message'}>
                  {entry.role === 'assistant' && <span className="aigm-assistant-message-icon mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><MessageSquareText className="size-4" aria-hidden="true" /></span>}
                  <div className={`aigm-message-wrap ${entry.role === 'user' ? 'aigm-user-message' : 'aigm-assistant-message group'}`}>
                    <div className={`aigm-message-bubble whitespace-pre-wrap rounded-2xl px-5 py-4 leading-relaxed ${entry.role === 'user' ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-secondary'}`}>{entry.text}</div>
                    {entry.role === 'assistant' && (
                      <button type="button" data-aigm-manual-listen="true" onClick={() => voiceControlsRef.current?.replay(entry.text)} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted-foreground opacity-80 transition hover:bg-secondary hover:text-foreground" aria-label="Read this AIGM reply aloud">
                        <Volume2 className="size-3.5" aria-hidden="true" />Listen
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sending && gameplay.messages.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">{streamingReply ? <MessageSquareText className="size-4" aria-hidden="true" /> : <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}</span>
                  <div className={`rounded-2xl rounded-tl-sm bg-secondary px-5 py-4 ${streamingReply ? 'whitespace-pre-wrap leading-relaxed text-foreground' : 'text-muted-foreground'}`}>
                    {streamingReply || (checkingCampaignNotes ? 'Checking campaign notes…' : 'The world is considering the consequences…')}
                  </div>
                </div>
              )}
                  <div ref={endRef} />
                </div>
              </div>
            </div>
          </div>

          {showJumpButton && <button type="button" onClick={() => { userScrolledAwayRef.current = false; setShowJumpButton(false); scrollToLatest(true) }} className="absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold shadow-xl"><ArrowDown className="size-4" aria-hidden="true" />Latest turn</button>}

          <div className="aigm-gameplay-composer border-t border-border bg-background/80 px-3 py-2.5 sm:px-4 sm:py-3">
            {billingNotice && <div className="mx-auto mb-2.5 flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-primary/45 bg-primary/10 px-4 py-3 text-sm" role="status"><p><strong>{billingNotice}</strong></p>{billingActionUrl ? <Link href={billingActionUrl} className="shrink-0 font-bold text-primary underline underline-offset-2">Add usage</Link> : null}</div>}
            {error && <div className="mx-auto mb-2.5 flex max-w-4xl items-start justify-between gap-3 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm" role="alert"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" /><p>{error}</p></div>{billingActionUrl ? <Link href={billingActionUrl} className="shrink-0 font-bold underline underline-offset-2">Add usage</Link> : null}</div>}
            <div className="mx-auto max-w-5xl">
              <label htmlFor="aigm-gameplay-message" className="sr-only">What does the party do?</label>
              <form onSubmit={submitTurn} className="aigm-composer-plaque flex items-end gap-2 rounded-2xl border p-2">
                <textarea id="aigm-gameplay-message" ref={textareaRef} rows={2} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={handleGameplayKeyDown} disabled={sending || voiceCaptureBusy || gameplay.messages.length === 0} placeholder={gameplay.messages.length === 0 ? 'Begin your adventure before sending an action.' : 'What do you do? Talk to me just like you would a person.'} className="aigm-gameplay-message-input min-h-16 max-h-32 min-w-0 flex-1 resize-y bg-transparent px-3 py-2 text-sm leading-relaxed outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-base" />
                {voiceAvailable ? <AigmVoiceControls
                  ref={voiceControlsRef}
                  disabled={gameplay.messages.length === 0 || (!voiceGuidedPlay.enabled && sending)}
                  guidedMode={voiceGuidedPlay.enabled}
                  assistantResponding={sending}
                  assistantName={partyState.game_master_name || 'Game Master'}
                  currentMessage={message}
                  onTranscriptUpdate={(text) => { setMessage(text); if (!voiceGuidedPlay.enabled) requestAnimationFrame(() => textareaRef.current?.focus()) }}
                  onTranscriptComplete={handleGuidedTranscriptComplete}
                  onBusyChange={(busy) => { setVoiceCaptureBusy(busy); if (!busy && !voiceGuidedPlay.enabled) requestAnimationFrame(() => textareaRef.current?.focus()) }}
                  onError={setError}
                /> : null}
                <button type="submit" disabled={sending || voiceCaptureBusy || gameplay.messages.length === 0 || !message.trim()} className="aigm-gameplay-send flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-45" aria-label="Send gameplay turn">{sending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}</button>
              </form>

              <div className="aigm-session-tools mt-2 grid gap-2 border-t border-border/70 pt-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]" data-open={sessionToolsOpen ? 'true' : 'false'} aria-label="Session tools and export guidance">
                <button
                  type="button"
                  onClick={() => setSessionToolsOpen((open) => !open)}
                  aria-expanded={sessionToolsOpen}
                  aria-controls="aigm-session-tools-panel"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-secondary/55 px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary/55 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Session tools</span>
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${sessionToolsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setExportGameHelpDialogOpen(true)} className="aigm-session-help inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-normal rounded-xl border border-border bg-card px-4 py-2 text-center text-xs font-bold leading-snug text-muted-foreground transition hover:border-primary/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FileDown className="size-3.5 shrink-0" aria-hidden="true" />When and how to export</button>
                <button type="button" onClick={openStoryDirectionHelp} className="aigm-session-help inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-normal rounded-xl border border-border bg-card px-4 py-2 text-center text-xs font-bold leading-snug text-muted-foreground transition hover:border-primary/55 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BookOpen className="size-3.5 shrink-0" aria-hidden="true" />Can I direct my game?</button>
                {sessionToolsOpen && (
                  <div id="aigm-session-tools-panel" className="aigm-session-tools-panel flex flex-wrap items-center gap-2 pt-0.5 sm:col-span-3">
                    <button type="button" onClick={downloadAdventure} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/55 hover:text-foreground"><FileDown className="size-3.5" aria-hidden="true" />Export Your Game</button>
                    <button type="button" onClick={downloadTranscript} disabled={transcript.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/55 hover:text-foreground disabled:opacity-40"><Download className="size-3.5" aria-hidden="true" />Download transcript</button>
                    <button type="button" onClick={printTranscript} disabled={transcript.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/55 hover:text-foreground disabled:opacity-40"><Printer className="size-3.5" aria-hidden="true" />Print</button>
                    <button type="button" onClick={() => openLevelUp()} disabled={gameplay.pending_level_ups.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/55 hover:text-foreground disabled:opacity-40"><Sparkles className="size-3.5" aria-hidden="true" />Level Up a character</button>
                    <button type="button" onClick={() => setCharacterAssistanceDialogOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/55 hover:text-foreground"><BookOpen className="size-3.5" aria-hidden="true" />Character help: {characterAssistanceLevel} out of 10</button>
                    <Link href="/play" className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/55 hover:text-foreground">Back to Play</Link>
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>

        <aside className={`${mobilePanel === 'characters' ? 'flex' : 'hidden'} aigm-characters-panel order-3 min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 lg:flex`} aria-label="Current characters">
          <button type="button" onClick={() => setMobilePanel('gameplay')} className="mb-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-primary/45 bg-primary/10 px-4 text-sm font-bold text-primary lg:hidden">Back to gameplay</button>
          <div className="aigm-characters-heading">
            <h2 className="font-display text-xl font-bold leading-tight">Characters</h2>
          </div>
          <div className="aigm-character-list mt-1 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {orderedCharacters.length > 0 ? orderedCharacters.map((character, index) => (
              <CharacterCard
                key={character.id}
                character={character}
                onOpen={setSelectedCharacterId}
                canMoveUp={index > 0}
                canMoveDown={index < orderedCharacters.length - 1}
                onMoveUp={(characterId) => movePartyCharacter(characterId, -1)}
                onMoveDown={(characterId) => movePartyCharacter(characterId, 1)}
                onReorder={reorderPartyCharacter}
                isDragTarget={dragTargetCharacterId === character.id}
                onDragTarget={setDragTargetCharacterId}
              />
            )) : <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No ready characters yet.</div>}
            <div className="flex items-start gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-3 py-3 text-xs leading-relaxed text-muted-foreground"><HeartPulse className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><p>Your AIGM is built for long-running campaigns and can remember earlier gameplay, but not every fact stays in immediate attention all the time. If it overlooks something it already knows, remind it or ask it to check the character or campaign record and keep playing.</p></div>
          </div>

          <div className="aigm-character-footer mt-2">
            <div className="aigm-party-capacity" aria-label={`Current party: ${readyCharacters.length}. Max party size: 6.`}>
              <span><strong>Current party:</strong> {readyCharacters.length}</span>
              <span><strong>Max party size:</strong> 6</span>
            </div>
            <button type="button" onClick={addAnotherCharacter} disabled={readyCharacters.length >= 6 || sending} className="aigm-add-character inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40" title={readyCharacters.length >= 6 ? 'This party already has the maximum of six characters.' : 'Character additions return with the rebuilt Start experience.'}><Plus className="size-4" aria-hidden="true" />Add another character</button>
          </div>

        </aside>
      </div>

      {selectedCharacter && <CharacterSheetOverlay character={selectedCharacter} onClose={() => { setSelectedCharacterId(null); setRecordEditorCharacterId(null) }} onUpdate={updateCharacterIdentity} onSaveRecord={saveCharacterRecordEdit} canLevelUp={gameplay.pending_level_ups.includes(selectedCharacter.id)} onLevelUp={(characterId) => { setSelectedCharacterId(null); setRecordEditorCharacterId(null); openLevelUp(characterId) }} ruleset={partyState.settings.ruleset} startInRecordEditor={recordEditorCharacterId === selectedCharacter.id} />}
      {voiceAvailable ? <VoiceGuidedPlayDialog
        open={voiceGuidedDialogOpen}
        settings={voiceGuidedPlay}
        onClose={closeVoiceGuidedPlayDialog}
        onSave={saveVoiceGuidedPlay}
        onListen={(text) => voiceControlsRef.current?.replay(text)}
      /> : null}
      <CharacterAssistanceDialog
        open={characterAssistanceDialogOpen}
        level={characterAssistanceLevel}
        onClose={() => setCharacterAssistanceDialogOpen(false)}
        onSave={saveCharacterAssistanceLevel}
      />
      <LevelUpDialog
        key={levelUpCharacterId ?? 'level-up-closed'}
        open={levelUpDialogOpen}
        characters={partyState.characters}
        setupAnswers={partyState.setup_answers}
        eligibleCharacterIds={partyState.gameplay.pending_level_ups}
        initialCharacterId={levelUpCharacterId}
        onClose={() => { setLevelUpDialogOpen(false); setLevelUpCharacterId(null) }}
        onUseCharacterEditor={(characterId) => {
          setLevelUpDialogOpen(false)
          setLevelUpCharacterId(null)
          setRecordEditorCharacterId(characterId)
          setSelectedCharacterId(characterId)
        }}
        onSaveAdvancementProfile={saveAdvancementProfile}
        onSaveLevelUp={saveLevelUpRecord}
      />
      <StoryDirectionDialog
        open={storyDirectionDialogOpen}
        beginningAdventure={storyDirectionBeginsAdventure}
        onClose={closeStoryDirectionDialog}
        onBegin={beginAdventureAfterDirectionHelp}
        onListen={(text) => voiceControlsRef.current?.replay(text)}
      />
      <ExportGameHelpDialog
        open={exportGameHelpDialogOpen}
        onClose={() => setExportGameHelpDialogOpen(false)}
        onExport={downloadAdventure}
      />

      {!selectedCharacter && (
        <nav className="aigm-mobile-nav fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur lg:hidden" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }} aria-label="Mobile gameplay panels">
          {mobilePanel === 'gameplay' ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMobilePanel('tools')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground"><Dices className="size-4" aria-hidden="true" /><span className="text-center leading-tight">Initiative <span className="inline-block whitespace-nowrap">&amp; Dice</span></span></button>
              <button type="button" onClick={() => setMobilePanel('characters')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground"><UserRound className="size-4" aria-hidden="true" />Characters</button>
            </div>
          ) : mobilePanel === 'tools' ? (
            <button type="button" onClick={() => setMobilePanel('gameplay')} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Back to gameplay</button>
          ) : null}
        </nav>
      )}
    </main>
  )
}
