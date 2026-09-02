'use client'

import { Cable, ExternalLink, LoaderCircle, MonitorUp, Swords, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  initialLiveState,
  normalizeLiveState,
  playNameFor,
  type CharacterLiveState,
  type SavedAdventureState,
  type StoredPartyCharacter,
} from '@/lib/aigm/campaign-storage'

type FoundryStatus = {
  connected: boolean
  controllerActive: boolean
  campaignId: string
  connectionId?: string
  launchUrl: string | null
  worldLabel: string | null
  controllerName: string | null
  lastSeenAt: string | null
}

type EncounterState = {
  encounterId: string
  status: string
  foundrySceneId?: string | null
  errorMessage?: string | null
}

function characterVisualTags(state: SavedAdventureState, characterId: string) {
  const character = state.characters.find((entry) => entry.id === characterId)
  const result = character?.result
  if (!result) return []

  return [
    result.character.species,
    ...(result.character.classes ?? []).map((entry) => entry.name),
    ...(result.character.armor_and_shields ?? []).slice(0, 3).map((entry) => entry.name),
    ...(result.character.attacks ?? []).slice(0, 3).map((entry) => entry.name),
  ]
    .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12)
}

const FOUNDRY_MODERN_RULESET_LABEL = 'D&D 5.5e (2024 rules)'
const FOUNDRY_MODERN_RULESET_ID = 'dnd-5.5e-srd-5.2.1'

function foundryModernMechanics(character: StoredPartyCharacter, live: CharacterLiveState) {
  const record = character.result?.character
  if (!record) return null

  return {
    schema: 1,
    totalLevel: record.total_level,
    classes: (record.classes ?? []).map((entry) => ({
      name: entry.name,
      level: entry.level,
      subclass: entry.subclass,
    })),
    species: record.species,
    background: record.background,
    speed: record.speed,
    initiativeModifier: record.initiative_modifier,
    proficiencyBonus: record.proficiency_bonus,
    abilityScores: record.ability_scores,
    savingThrows: record.saving_throws ?? [],
    skills: record.skills ?? [],
    attacks: (record.attacks ?? []).map((entry) => ({
      name: entry.name,
      attackBonus: entry.attack_bonus,
      damage: entry.damage,
      properties: entry.properties ?? [],
    })),
    armorAndShields: (record.armor_and_shields ?? []).map((entry) => ({
      name: entry.name,
      quantity: entry.quantity,
      sheetStatus: entry.sheet_status,
    })),
    equipment: (record.equipment_highlights ?? []).map((entry) => ({
      name: entry.name,
      quantity: entry.quantity,
      sheetStatus: entry.sheet_status,
    })),
    currency: live.currency,
    resources: live.resources,
    conditions: live.conditions,
    concentration: live.concentration,
    deathSaves: live.death_saves,
    spellcasting: {
      ability: record.spellcasting?.ability ?? '',
      saveDc: record.spellcasting?.save_dc ?? '',
      attackBonus: record.spellcasting?.attack_bonus ?? '',
      slots: live.spell_slots,
      cantrips: record.spellcasting?.cantrips ?? [],
      preparedOrKnownSpells: record.spellcasting?.prepared_or_known_spells ?? [],
      spellbookOrOtherSpells: record.spellcasting?.spellbook_or_other_spells ?? [],
    },
    features: (record.features ?? []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      detail: entry.detail,
      category: entry.category,
      className: entry.class_name,
      subclassName: entry.subclass_name,
      levelGained: entry.level_gained,
      source: entry.source,
    })),
  }
}

const FOUNDRY_WINDOW_NAME = 'rpgyw-foundry-vtt'
const FOUNDRY_FOCUS_PING = 'rpgyw.vtt.focus.ping'
const FOUNDRY_FOCUS_PONG = 'rpgyw.vtt.focus.pong'
const WEB_FOCUS_PING = 'rpgyw.web.focus.ping'
const WEB_FOCUS_PONG = 'rpgyw.web.focus.pong'

function launchNamedWindow(url: string, target: string) {
  const opened = window.open(url, target)
  try { opened?.focus() } catch { /* browser focus is best-effort */ }
}

async function focusOrOpenFoundry(url: string, protectActiveSession = false) {
  let targetOrigin = ''
  try {
    targetOrigin = new URL(url).origin
  } catch {
    if (!protectActiveSession) launchNamedWindow(url, FOUNDRY_WINDOW_NAME)
    return !protectActiveSession
  }

  const candidate = window.open('', FOUNDRY_WINDOW_NAME)
  if (!candidate) return false

  let disposableBlank = false
  try { disposableBlank = candidate.location.href === 'about:blank' } catch { /* cross-origin live window */ }

  const requestId = crypto.randomUUID()
  let acknowledged = false

  const receivePong = (event: MessageEvent) => {
    const data = event.data as { source?: unknown; type?: unknown; requestId?: unknown } | null
    if (
      event.origin === targetOrigin
      && data?.source === 'rpgyw-foundry'
      && data.type === FOUNDRY_FOCUS_PONG
      && data.requestId === requestId
    ) {
      acknowledged = true
    }
  }

  window.addEventListener('message', receivePong)

  try {
    candidate.postMessage({
      source: 'rpgyw-web',
      type: FOUNDRY_FOCUS_PING,
      requestId,
    }, '*')
  } catch {
    // The safe fallback below decides whether navigation is allowed.
  }

  await new Promise((resolve) => window.setTimeout(resolve, 300))
  window.removeEventListener('message', receivePong)

  if (!acknowledged && protectActiveSession) {
    if (disposableBlank) {
      try { candidate.close() } catch { /* best-effort cleanup */ }
    }
    return false
  }

  if (!acknowledged) {
    try {
      candidate.location.href = url
    } catch {
      launchNamedWindow(url, FOUNDRY_WINDOW_NAME)
      return true
    }
  }

  try { candidate.focus() } catch { /* browser focus is best-effort */ }
  return true
}

export function VttCombatHandoff({ partyState }: { partyState: SavedAdventureState | null }) {
  const [foundryStatus, setFoundryStatus] = useState<FoundryStatus | null>(null)
  const [statusLoaded, setStatusLoaded] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [encounter, setEncounter] = useState<EncounterState | null>(null)
  const [handoffError, setHandoffError] = useState('')
  const offeredCombatRef = useRef('')

  const campaignId = partyState?.adventure_id || ''
  const gameplay = partyState?.gameplay
  const npcInitiative = useMemo(
    () => gameplay?.initiative.filter((entry) => entry.entity_type === 'npc') ?? [],
    [gameplay?.initiative],
  )
  const playerInitiative = useMemo(
    () => gameplay?.initiative.filter((entry) => entry.entity_type === 'player') ?? [],
    [gameplay?.initiative],
  )

  const combatReady = Boolean(
    gameplay?.combat_active
      && playerInitiative.length > 0
      && npcInitiative.length > 0,
  )
  const combatKey = combatReady && partyState
    ? [
        partyState.adventure_id,
        gameplay?.turn_count ?? 0,
        ...npcInitiative.map((entry) => entry.character_id),
      ].join(':')
    : ''

  async function refreshFoundryStatus() {
    if (!campaignId) return

    try {
      const response = await fetch(
        `/api/integrations/foundry/campaigns/${encodeURIComponent(campaignId)}/status`,
        { cache: 'no-store' },
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Could not check the VTT connection.')
      }
      setFoundryStatus(body as FoundryStatus)
    } catch (caught) {
      setFoundryStatus(null)
      setHandoffError(caught instanceof Error ? caught.message : 'Could not check the VTT connection.')
    } finally {
      setStatusLoaded(true)
    }
  }

  useEffect(() => {
    if (!campaignId) {
      setFoundryStatus(null)
      setStatusLoaded(true)
      return
    }

    window.name = 'rpgyw-play'
    let cancelled = false

    const refresh = async () => {
      if (!cancelled) await refreshFoundryStatus()
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 10_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [campaignId])

  useEffect(() => {
    const launchUrl = foundryStatus?.launchUrl
    if (!launchUrl) return

    let expectedOrigin = ''
    try {
      expectedOrigin = new URL(launchUrl).origin
    } catch {
      return
    }

    const receiveFocusPing = (event: MessageEvent) => {
      const data = event.data as { source?: unknown; type?: unknown; requestId?: unknown } | null
      if (
        event.origin !== expectedOrigin
        || data?.source !== 'rpgyw-foundry'
        || data.type !== WEB_FOCUS_PING
        || typeof data.requestId !== 'string'
      ) return

      try { window.focus() } catch { /* browser focus is best-effort */ }

      const source = event.source as Window | null
      source?.postMessage({
        source: 'rpgyw-web',
        type: WEB_FOCUS_PONG,
        requestId: data.requestId,
      }, event.origin)
    }

    window.addEventListener('message', receiveFocusPing)
    return () => window.removeEventListener('message', receiveFocusPing)
  }, [foundryStatus?.launchUrl])

  useEffect(() => {
    if (!statusLoaded || !combatKey || offeredCombatRef.current === combatKey) return
    offeredCombatRef.current = combatKey
    setOfferOpen(true)
  }, [combatKey, statusLoaded])

  useEffect(() => {
    if (!encounter?.encounterId || encounter.status === 'rendered' || encounter.status === 'failed') return

    let cancelled = false
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/integrations/foundry/encounters/${encodeURIComponent(encounter.encounterId)}`,
          { cache: 'no-store' },
        )
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(typeof body.error === 'string' ? body.error : 'Could not check the VTT encounter.')
        }
        if (cancelled) return

        const next = body as EncounterState
        setEncounter(next)
        if (next.status === 'rendered') {
          setHandoffError('')
          await refreshFoundryStatus()
        }
        if (next.status === 'failed') {
          setHandoffError(next.errorMessage || 'Foundry could not render this encounter.')
        }
      } catch (caught) {
        if (!cancelled) {
          setHandoffError(caught instanceof Error ? caught.message : 'Could not check the VTT encounter.')
        }
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 1_500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [encounter?.encounterId, encounter?.status])

  function goToVtt() {
    const url = foundryStatus?.launchUrl
    if (!url) return

    void focusOrOpenFoundry(url, false)
      .then((focused) => {
        if (!focused) {
          setHandoffError(
            'Your browser blocked the Foundry window. Allow pop-ups for RPG Your Way, or open Foundry normally. Desktop Foundry controllers can simply switch to Foundry.exe.',
          )
        }
      })
  }

  function openSetup() {
    launchNamedWindow('/campaigns#foundry-vtt', 'rpgyw-campaigns')
    setOfferOpen(false)
  }

  async function prepareVttEncounter() {
    if (!partyState || !gameplay || !foundryStatus?.connected) return

    if (partyState.settings.ruleset !== FOUNDRY_MODERN_RULESET_LABEL) {
      setHandoffError('Foundry full-character integration currently supports D&D 5.5e (2024 rules) only.')
      return
    }

    const initiativeByCharacter = new Map(
      playerInitiative.map((entry) => [entry.character_id, entry.total]),
    )

    const party = partyState.characters.flatMap((character) => {
      if (character.status !== 'ready' || !character.result) return []
      const live = normalizeLiveState(character.liveState, character.result)
        ?? initialLiveState(character.result)

      return [{
        campaignCharacterId: character.id,
        displayName: playNameFor(character),
        currentHitPoints: live.current_hit_points,
        maximumHitPoints: live.maximum_hit_points,
        temporaryHitPoints: live.temporary_hit_points,
        armorClass: live.armor_class,
        initiative: initiativeByCharacter.get(character.id) ?? null,
        visualTags: characterVisualTags(partyState, character.id),
        preferredTokenAsset: character.vttTokenAsset || null,
        rulesetId: FOUNDRY_MODERN_RULESET_ID,
        foundryRulesVersion: '2024',
        mechanics: foundryModernMechanics(character, live),
      }]
    })

    const enemies = npcInitiative.map((entry) => ({
      combatantId: entry.character_id,
      displayName: entry.name,
      initiative: entry.total,
    }))
    const latestAigmNarration = [...gameplay.messages]
      .reverse()
      .find((entry) => entry.role === 'assistant')
      ?.text
      || gameplay.scene
      || ''

    setPreparing(true)
    setHandoffError('')

    try {
      const response = await fetch('/api/integrations/foundry/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: partyState.adventure_id,
          turnNumber: gameplay.turn_count,
          sceneLabel: gameplay.scene || 'Combat',
          sceneSummary: latestAigmNarration,
          vttSetup: gameplay.vtt_setup,
          party,
          enemies,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Could not prepare the VTT encounter.')
      }

      setEncounter({
        encounterId: String(body.encounterId),
        status: String(body.status || 'pending'),
      })
      setOfferOpen(false)
      await refreshFoundryStatus()
    } catch (caught) {
      setHandoffError(caught instanceof Error ? caught.message : 'Could not prepare the VTT encounter.')
    } finally {
      setPreparing(false)
    }
  }

  if (!partyState) return null

  const connectedAndLaunchable = Boolean(foundryStatus?.connected && foundryStatus.launchUrl)
  const encounterLabel = encounter?.status === 'rendered'
    ? 'Foundry combat ready'
    : encounter && encounter.status !== 'failed'
      ? 'Preparing Foundry combat…'
      : ''

  return (
    <>
      {connectedAndLaunchable ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/70 pt-2" aria-label="Virtual tabletop">
          <button
            type="button"
            onClick={goToVtt}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              encounter?.status === 'rendered'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-primary/55 hover:text-foreground'
            }`}
          >
            <MonitorUp className="size-4" aria-hidden="true" />
            Open Foundry in browser
          </button>
          {encounterLabel ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground" role="status">
              {encounter?.status !== 'rendered'
                ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                : null}
              {encounterLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {handoffError ? (
        <p className="mt-2 text-xs font-semibold text-destructive" role="alert">{handoffError}</p>
      ) : null}

      {offerOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[2147483000] overflow-y-auto overscroll-contain bg-black/55 px-4 py-4" role="presentation">
          <div
            className="relative mx-auto w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vtt-combat-heading"
          >
            <button
              type="button"
              onClick={() => setOfferOpen(false)}
              className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close VTT combat offer"
            >
              <X className="size-4" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Swords className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Combat</p>
                <h2 id="vtt-combat-heading" className="font-display text-xl font-bold">
                  {foundryStatus?.connected
                    ? 'Would you like to use Foundry for this combat?'
                    : 'Would you like to set up Foundry for combat?'}
                </h2>
              </div>
            </div>

            {foundryStatus?.connected ? (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  RPG Your Way will queue this fight for your paired Foundry world. The desktop controller can switch to Foundry.exe manually; browser participants can use the separate Open Foundry in browser button. Foundry is the tactical board while RPG Your Way remains the campaign authority.
                </p>

                {!foundryStatus.controllerActive ? (
                  <p className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                    This Foundry world is paired, but its controller is currently offline. Open the paired World in Foundry. The Integrator should restore its working session automatically; use <strong>/rpgyw connect</strong> only if pairing needs repair.
                  </p>
                ) : null}

                {!foundryStatus.launchUrl ? (
                  <p className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                    Foundry has not reported a browser join address yet. Open the paired World as the controller and leave it running for a few seconds.
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOfferOpen(false)}
                    className="min-h-10 rounded-xl border border-border px-4 py-2 text-sm font-bold"
                  >
                    Not this time
                  </button>
                  <button
                    type="button"
                    onClick={() => void prepareVttEncounter()}
                    disabled={preparing}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {preparing
                      ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      : <MonitorUp className="size-4" aria-hidden="true" />}
                    Use Foundry
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm text-muted-foreground">
                  No Foundry world is connected to this campaign yet. The Foundry license owner or designated technical GM creates or opens the world, enables the RPG Your Way Foundry Integrator, and uses <strong>/rpgyw connect</strong> to connect that world. Each other human uses <strong>/rpgyw link</strong> for their own Foundry user.
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  You can keep this fight entirely in text and set up the VTT later.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOfferOpen(false)}
                    className="min-h-10 rounded-xl border border-border px-4 py-2 text-sm font-bold"
                  >
                    Keep playing in text
                  </button>
                  <button
                    type="button"
                    onClick={openSetup}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    <Cable className="size-4" aria-hidden="true" />
                    Foundry setup
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
