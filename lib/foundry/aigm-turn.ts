import { POST as gameplayPost } from '@/app/api/aigm/gameplay-chat/route'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  mergeCampaignMemory,
  mergeCampaignRetcons,
  type CampaignMemoryEntry,
} from '@/lib/aigm/campaign-entities'
import type {
  CharacterLiveState,
  SavedAdventureState,
  StoredPartyCharacter,
} from '@/lib/aigm/campaign-storage'
import { playNameFor } from '@/lib/aigm/campaign-storage'
import { saveCloudCampaign } from '@/lib/cloud-campaigns/server'
import {
  beginMultiplayerTurn,
  completeMultiplayerTurn,
} from '@/lib/multiplayer/server'
import {
  markAudioComplete,
  markPlayTurnReleased,
} from '@/lib/usage/play-turn-billing'
import {
  FoundryIntegrationError,
} from '@/lib/foundry/server'
import {
  createFoundryCombatEncounter,
} from '@/lib/foundry/combat-handoff'
import {
  requireFoundryUsageAccount,
} from '@/lib/foundry/usage-account'

type FoundryAigmBody = {
  version?: unknown
  message?: unknown
  tableSnapshot?: unknown
}

type FoundryGameplayReply = {
  dm_secrets?: SavedAdventureState['gameplay']['dm_secrets']
  memory_updates?: CampaignMemoryEntry[]
  retcon_updates?: SavedAdventureState['gameplay']['retcons']
  game_master_name?: string
  message?: string
  campaign_summary?: string
  scene?: string
  combat_suggested?: boolean
  vtt_setup?: SavedAdventureState['gameplay']['vtt_setup']
  npc_initiative?: Array<{
    name?: string
    modifier?: number
    roll?: number
    total?: number
  }>
  character_updates?: Array<{
    character_id?: string
    current_hit_points?: number
    maximum_hit_points?: number
    temporary_hit_points?: number
    armor_class?: number
    conditions?: string[]
    concentration?: string
    death_save_successes?: number
    death_save_failures?: number
    resources?: Array<{ name?: string; current?: string; maximum?: string }>
    spell_slots?: Array<{ level?: string; total?: string; used?: string }>
    currency?: { cp?: number; sp?: number; ep?: number; gp?: number; pp?: number }
    notes?: string[]
  }>
  level_up_ready_character_ids?: string[]
  level_up_resolved_character_ids?: string[]
  content_mode_explanation_given?: boolean
  usage_billing?: {
    pending?: boolean
    turn_billing_id?: string
  }
}

type LiveSession = {
  id: string
  invite_code: string
  expires_at: string | null
}

function cleanMessage(value: unknown) {
  const message = typeof value === 'string' ? value.trim() : ''
  if (!message) {
    throw new FoundryIntegrationError(
      'Type an action or question after /aigm.',
      400,
      'foundry_aigm_message_required',
    )
  }
  if (message.length > 1800) {
    throw new FoundryIntegrationError(
      'Foundry AIGM messages are limited to 1800 characters.',
      413,
      'foundry_aigm_message_too_long',
    )
  }
  return message
}

async function liveSession(campaignId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('multiplayer_sessions')
    .select('id, invite_code, expires_at')
    .eq('campaign_id', campaignId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    throw new FoundryIntegrationError(
      error.message,
      503,
      'multiplayer_database_unavailable',
    )
  }

  const now = Date.now()
  const row = ((data ?? []) as LiveSession[]).find(
    (entry) => !entry.expires_at || Date.parse(entry.expires_at) > now,
  )

  if (!row) {
    throw new FoundryIntegrationError(
      'The connected RPG Your Way campaign does not currently have a live multiplayer table.',
      409,
      'multiplayer_session_required',
    )
  }

  return row
}

function classSummary(character: StoredPartyCharacter) {
  const classes = character.result?.character.classes ?? []
  return classes
    .map((entry) => (
      `${entry.name}${entry.subclass ? ` (${entry.subclass})` : ''} ${entry.level}`
    ))
    .join(', ')
}

function partyMember(character: StoredPartyCharacter) {
  const result = character.result
  if (!result) return null
  const record = result.character
  const live = character.liveState

  return {
    id: character.id,
    name: playNameFor(character),
    full_name: record.name,
    class_summary: classSummary(character),
    classes: record.classes,
    species: record.species,
    sex: record.sex,
    pronouns: record.pronouns,
    age: record.age,
    alignment: record.alignment,
    background: record.background,
    level: record.total_level,
    armor_class: live?.armor_class ?? record.armor_class,
    hit_points: live
      ? `${live.current_hit_points}/${live.maximum_hit_points}`
      : `${result.opening_state.current_hit_points}/${record.hit_points.maximum}`,
    initiative_modifier: record.initiative_modifier,
    proficiency_bonus: record.proficiency_bonus,
    ability_scores: record.ability_scores,
    saving_throws: record.saving_throws,
    skills: record.skills,
    attacks: record.attacks.map((entry) => (
      [entry.name, entry.attack_bonus, entry.damage, ...entry.properties]
        .filter(Boolean)
        .join(' | ')
    )),
    armor_and_shields: record.armor_and_shields.map((entry) => entry.name),
    equipment: record.equipment_highlights.map((entry) => entry.name),
    features: record.features ?? [],
    proficiencies: record.proficiencies,
    record_resources: record.resources.map((entry) => (
      [entry.name, entry.current_shown_on_sheet, entry.maximum_or_frequency]
        .filter(Boolean)
        .join(' | ')
    )),
    spellcasting: {
      ability: record.spellcasting.ability,
      save_dc: record.spellcasting.save_dc,
      attack_bonus: record.spellcasting.attack_bonus,
      cantrips: record.spellcasting.cantrips,
      prepared_or_known_spells: record.spellcasting.prepared_or_known_spells,
      spellbook_or_other_spells: record.spellcasting.spellbook_or_other_spells,
    },
    currency: live?.currency ?? record.currency,
    valuables: record.valuables,
    languages: record.languages,
    senses: record.senses,
    personality_goals_and_fears: record.personality_goals_and_fears,
    relationships_and_organizations: record.relationships_and_organizations,
    story_facts: record.story_facts.map((entry) => entry.fact),
    additional_details: result.additional_details,
    is_current_party_active_leader: record.is_current_party_active_leader,
    live_state: live
      ? {
          current_hit_points: live.current_hit_points,
          maximum_hit_points: live.maximum_hit_points,
          temporary_hit_points: live.temporary_hit_points,
          armor_class: live.armor_class,
          conditions: live.conditions,
          concentration: live.concentration,
          death_saves: live.death_saves,
          resources: live.resources,
          spell_slots: live.spell_slots,
          currency: live.currency,
          notes: live.notes,
        }
      : undefined,
  }
}

async function playerContext(
  campaignId: string,
  sessionId: string,
  rpgUserId: string,
) {
  const admin = createAdminClient()
  const { data: seat, error: seatError } = await admin
    .from('multiplayer_seats')
    .select('id, display_name')
    .eq('session_id', sessionId)
    .eq('user_id', rpgUserId)
    .eq('is_active', true)
    .maybeSingle()

  if (seatError) {
    throw new FoundryIntegrationError(
      seatError.message,
      503,
      'multiplayer_database_unavailable',
    )
  }
  if (!seat) {
    throw new FoundryIntegrationError(
      'This linked RPG Your Way account is not seated at the current multiplayer table.',
      409,
      'multiplayer_seat_required',
    )
  }

  const { data: claims, error: claimError } = await admin
    .from('multiplayer_character_claims')
    .select('character_id')
    .eq('session_id', sessionId)
    .eq('seat_id', seat.id)

  if (claimError) {
    throw new FoundryIntegrationError(
      claimError.message,
      503,
      'multiplayer_database_unavailable',
    )
  }

  const characterIds = (claims ?? [])
    .map((entry: { character_id: string }) => entry.character_id)
    .filter(Boolean)

  let characterNames: string[] = []
  if (characterIds.length) {
    const { data: characters, error: characterError } = await admin
      .from('multiplayer_session_characters')
      .select('character_id, display_name')
      .eq('session_id', sessionId)
      .in('character_id', characterIds)

    if (characterError) {
      throw new FoundryIntegrationError(
        characterError.message,
        503,
        'multiplayer_database_unavailable',
      )
    }

    const names = new Map(
      (characters ?? []).map(
        (entry: { character_id: string; display_name: string }) => (
          [entry.character_id, entry.display_name] as const
        ),
      ),
    )
    characterNames = characterIds
      .map((id) => names.get(id) || '')
      .filter(Boolean)
  }

  return {
    participant_id: seat.id as string,
    display_name: (seat.display_name as string) || 'Player',
    character_ids: characterIds,
    character_names: characterNames,
    campaign_id: campaignId,
  }
}

async function foundryTableState(
  connectionId: string,
  sessionId: string,
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('foundry_token_state')
    .select('campaign_character_id, scene_id, x, y, updated_at')
    .eq('connection_id', connectionId)
    .eq('session_id', sessionId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new FoundryIntegrationError(
      error.message,
      503,
      'database_unavailable',
    )
  }

  return (data ?? []).slice(0, 12).map((entry: {
    campaign_character_id: string
    scene_id: string
    x: number | string
    y: number | string
    updated_at: string
  }) => ({
    campaign_character_id: entry.campaign_character_id,
    scene_id: entry.scene_id,
    x: Number(entry.x),
    y: Number(entry.y),
    updated_at: entry.updated_at,
  }))
}

function gameplayBody(
  state: SavedAdventureState,
  message: string,
  inviteCode: string,
  revision: number,
  foundryPlayerContext: Awaited<ReturnType<typeof playerContext>>,
  tableState: Awaited<ReturnType<typeof foundryTableState>>,
  tableSnapshot: unknown,
) {
  const memory = state.gameplay.memory_index ?? []
  const transcript = state.gameplay.transcript ?? []
  const recent = state.gameplay.messages ?? []

  return {
    mode: 'turn',
    message,
    dice_result: '',
    adventure_id: state.adventure_id,
    adventure_name: state.adventure_name,
    game_master_name: state.game_master_name,
    campaign_direction: state.campaign_direction,
    campaign_scale: state.campaign_scale,
    lore_fidelity: state.lore_fidelity,
    content_mode: state.content_mode,
    content_mode_import_mismatch: Boolean(state.content_mode_import_mismatch),
    content_mode_explanation_given: Boolean(state.content_mode_explanation_given),
    setup_answers: state.setup_answers,
    campaign_summary: state.gameplay.campaign_summary,
    dm_secrets: state.gameplay.dm_secrets,
    recalled_memories: memory.slice(-8),
    continuity_audit_requested: false,
    known_npc_names: memory
      .filter((entry) => entry.kind === 'npc')
      .flatMap((entry) => [entry.title, ...(entry.aliases ?? [])]),
    known_location_names: memory
      .filter((entry) => entry.kind === 'location')
      .flatMap((entry) => [entry.title, ...(entry.aliases ?? [])]),
    canonical_retcons: state.gameplay.retcons,
    recalled_transcript: transcript.slice(-12),
    migration_history: state.gameplay.dm_secrets.initialized
      ? []
      : transcript.slice(0, 48),
    scene: state.gameplay.scene,
    turn_count: state.gameplay.turn_count,
    combat_active: state.gameplay.combat_active,
    initiative: state.gameplay.initiative,
    party: state.characters.map(partyMember).filter(Boolean),
    recent_messages: recent.slice(-24).map((entry) => ({
      role: entry.role,
      text: entry.text,
    })),
    pending_level_up_character_ids: state.gameplay.pending_level_ups,
    owner_god_mode: false,
    voice_guided_play: Boolean(state.voice_guided_play?.enabled),
    guidance_level: state.voice_guided_play?.guidance_level ?? 5,
    dice_preference: state.voice_guided_play?.dice_preference ?? 'player_rolls',
    character_assistance_level: state.character_assistance_level ?? 5,
    gameplay_preferences: state.gameplay_preferences,
    stream: false,
    narration_expected: false,
    multiplayer_invite_code: inviteCode,
    cloud_revision: revision,
    foundry_player_context: foundryPlayerContext,
    foundry_table_state: tableState,
    foundry_vtt_snapshot: tableSnapshot,
    foundry_actor_templates: (state.gameplay.vtt_setup?.actors ?? []).map((actor) => ({ name: actor.name, srd_template: actor.srd_template, side: actor.side })),
  }
}

function liveStateFromUpdate(
  update: NonNullable<FoundryGameplayReply['character_updates']>[number],
): CharacterLiveState | null {
  if (
    typeof update.current_hit_points !== 'number'
    || typeof update.maximum_hit_points !== 'number'
    || typeof update.temporary_hit_points !== 'number'
    || typeof update.armor_class !== 'number'
  ) {
    return null
  }

  return {
    current_hit_points: Math.max(0, Math.trunc(update.current_hit_points)),
    maximum_hit_points: Math.max(0, Math.trunc(update.maximum_hit_points)),
    temporary_hit_points: Math.max(0, Math.trunc(update.temporary_hit_points)),
    armor_class: Math.max(0, Math.trunc(update.armor_class)),
    conditions: Array.isArray(update.conditions)
      ? update.conditions.filter((entry): entry is string => typeof entry === 'string')
      : [],
    concentration: typeof update.concentration === 'string'
      ? update.concentration
      : '',
    death_saves: {
      successes: Math.max(0, Math.min(3, Math.trunc(update.death_save_successes ?? 0))),
      failures: Math.max(0, Math.min(3, Math.trunc(update.death_save_failures ?? 0))),
    },
    resources: Array.isArray(update.resources)
      ? update.resources.map((entry) => ({
          name: typeof entry.name === 'string' ? entry.name : '',
          current: typeof entry.current === 'string' ? entry.current : '',
          maximum: typeof entry.maximum === 'string' ? entry.maximum : '',
        })).filter((entry) => entry.name)
      : [],
    spell_slots: Array.isArray(update.spell_slots)
      ? update.spell_slots.map((entry) => ({
          level: typeof entry.level === 'string' ? entry.level : '',
          total: typeof entry.total === 'string' ? entry.total : '',
          used: typeof entry.used === 'string' ? entry.used : '',
        })).filter((entry) => entry.level)
      : [],
    currency: {
      cp: Math.max(0, Math.trunc(update.currency?.cp ?? 0)),
      sp: Math.max(0, Math.trunc(update.currency?.sp ?? 0)),
      ep: Math.max(0, Math.trunc(update.currency?.ep ?? 0)),
      gp: Math.max(0, Math.trunc(update.currency?.gp ?? 0)),
      pp: Math.max(0, Math.trunc(update.currency?.pp ?? 0)),
      total_gp_value: (
        Math.max(0, Math.trunc(update.currency?.gp ?? 0))
        + Math.max(0, Math.trunc(update.currency?.pp ?? 0)) * 10
        + Math.max(0, Math.trunc(update.currency?.ep ?? 0)) * 0.5
        + Math.max(0, Math.trunc(update.currency?.sp ?? 0)) * 0.1
        + Math.max(0, Math.trunc(update.currency?.cp ?? 0)) * 0.01
      ),
    },
    notes: Array.isArray(update.notes)
      ? update.notes.filter((entry): entry is string => typeof entry === 'string').slice(-5)
      : [],
  }
}

function applyGameplayReply(
  state: SavedAdventureState,
  playerMessage: string,
  reply: FoundryGameplayReply,
  turnId: string,
) {
  const nextTurn = state.gameplay.turn_count + 1
  const now = new Date().toISOString()
  const sequence = state.gameplay.transcript.at(-1)?.sequence ?? 0

  const userEntry = {
    id: crypto.randomUUID(),
    role: 'user' as const,
    text: playerMessage,
    created_at: now,
    sequence: sequence + 1,
    turn_number: nextTurn,
    exchange_id: turnId,
  }
  const assistantEntry = {
    id: crypto.randomUUID(),
    role: 'assistant' as const,
    text: typeof reply.message === 'string' ? reply.message : '',
    created_at: now,
    sequence: sequence + 2,
    turn_number: nextTurn,
    exchange_id: turnId,
  }

  const updates = new Map(
    (reply.character_updates ?? [])
      .filter((entry) => typeof entry.character_id === 'string')
      .map((entry) => [entry.character_id as string, entry] as const),
  )

  const characters = state.characters.map((character) => {
    const update = updates.get(character.id)
    if (!update) return character
    const liveState = liveStateFromUpdate(update)
    return liveState ? { ...character, liveState } : character
  })

  const ready = new Set(state.gameplay.pending_level_ups)
  for (const id of reply.level_up_ready_character_ids ?? []) {
    if (typeof id === 'string' && state.characters.some((character) => character.id === id)) {
      ready.add(id)
    }
  }
  for (const id of reply.level_up_resolved_character_ids ?? []) {
    if (typeof id === 'string') ready.delete(id)
  }

  const npcInitiative = (reply.npc_initiative ?? []).flatMap((entry, index) => {
    if (
      typeof entry.name !== 'string'
      || typeof entry.roll !== 'number'
      || typeof entry.total !== 'number'
    ) return []
    return [{
      character_id: `foundry-npc:${turnId}:${index}`,
      entity_type: 'npc' as const,
      name: entry.name,
      modifier: Math.trunc(entry.modifier ?? 0),
      roll: Math.trunc(entry.roll),
      total: Math.trunc(entry.total),
    }]
  })

  const existingNpcNames = new Set(
    state.gameplay.initiative
      .filter((entry) => entry.entity_type === 'npc')
      .map((entry) => entry.name.toLocaleLowerCase()),
  )

  return {
    ...state,
    game_master_name: (
      typeof reply.game_master_name === 'string' && reply.game_master_name.trim()
        ? reply.game_master_name.trim()
        : state.game_master_name
    ),
    content_mode_explanation_given: (
      state.content_mode_explanation_given
      || reply.content_mode_explanation_given === true
    ),
    characters,
    updated_at: now,
    gameplay: {
      ...state.gameplay,
      messages: [...state.gameplay.messages, userEntry, assistantEntry].slice(-120),
      transcript: [...state.gameplay.transcript, userEntry, assistantEntry],
      campaign_summary: typeof reply.campaign_summary === 'string'
        ? reply.campaign_summary
        : state.gameplay.campaign_summary,
      scene: typeof reply.scene === 'string'
        ? reply.scene
        : state.gameplay.scene,
      turn_count: nextTurn,
      combat_active: state.gameplay.combat_active || reply.combat_suggested === true,
      vtt_setup: reply.vtt_setup?.enabled ? reply.vtt_setup : state.gameplay.vtt_setup,
      initiative: [
        ...state.gameplay.initiative,
        ...npcInitiative.filter(
          (entry) => !existingNpcNames.has(entry.name.toLocaleLowerCase()),
        ),
      ],
      dm_secrets: reply.dm_secrets ?? state.gameplay.dm_secrets,
      memory_index: mergeCampaignMemory(
        state.gameplay.memory_index,
        Array.isArray(reply.memory_updates) ? reply.memory_updates : [],
      ),
      retcons: mergeCampaignRetcons(
        state.gameplay.retcons,
        Array.isArray(reply.retcon_updates) ? reply.retcon_updates : [],
      ),
      pending_level_ups: [...ready],
    },
  } satisfies SavedAdventureState
}

function foundryModernMechanics(character: StoredPartyCharacter) {
  const result = character.result
  if (!result) return null
  const record = result.character
  const live = character.liveState
  return {
    schema: 1,
    totalLevel: record.total_level,
    classes: record.classes.map((entry) => ({ name: entry.name, level: entry.level, subclass: entry.subclass })),
    species: record.species,
    background: record.background,
    speed: record.speed,
    initiativeModifier: record.initiative_modifier,
    proficiencyBonus: record.proficiency_bonus,
    abilityScores: record.ability_scores,
    savingThrows: record.saving_throws,
    skills: record.skills,
    attacks: record.attacks.map((entry) => ({ name: entry.name, attackBonus: entry.attack_bonus, damage: entry.damage, properties: entry.properties })),
    armorAndShields: record.armor_and_shields.map((entry) => ({ name: entry.name, quantity: entry.quantity, sheetStatus: entry.sheet_status })),
    equipment: record.equipment_highlights.map((entry) => ({ name: entry.name, quantity: entry.quantity, sheetStatus: entry.sheet_status })),
    currency: live?.currency ?? record.currency,
    resources: live?.resources ?? record.resources.map((entry) => ({ name: entry.name, current: entry.current_shown_on_sheet, maximum: entry.maximum_or_frequency })),
    conditions: live?.conditions ?? [],
    concentration: live?.concentration ?? '',
    deathSaves: live?.death_saves ?? { successes: 0, failures: 0 },
    spellcasting: {
      ability: record.spellcasting.ability,
      saveDc: record.spellcasting.save_dc,
      attackBonus: record.spellcasting.attack_bonus,
      slots: live?.spell_slots ?? record.spellcasting.slots.map((entry) => ({ level: entry.level, total: entry.total_shown, used: entry.used_shown })),
      cantrips: record.spellcasting.cantrips,
      preparedOrKnownSpells: record.spellcasting.prepared_or_known_spells,
      spellbookOrOtherSpells: record.spellcasting.spellbook_or_other_spells,
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

function vttNameKey(value: string) {
  return value.normalize('NFKD').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function vttEncounterInput(
  state: SavedAdventureState,
  setup: NonNullable<SavedAdventureState['gameplay']['vtt_setup']>,
  sceneSummary: string,
) {
  const initiativeById = new Map(state.gameplay.initiative.filter((entry) => entry.entity_type === 'player').map((entry) => [entry.character_id, entry.total] as const))
  const hintByName = new Map(setup.actors.map((actor) => [vttNameKey(actor.name), actor] as const))
  const bystanderNames = new Set(setup.actors.filter((actor) => actor.side === 'bystander').map((actor) => vttNameKey(actor.name)))
  const party = state.characters.flatMap((character) => {
    if (character.status !== 'ready' || !character.result) return []
    const record = character.result.character, live = character.liveState
    const current = live?.current_hit_points ?? character.result.opening_state.current_hit_points
    const maximum = live?.maximum_hit_points ?? record.hit_points.maximum
    const mechanics = foundryModernMechanics(character)
    if (!mechanics) return []
    return [{ campaignCharacterId: character.id, displayName: playNameFor(character), currentHitPoints: current, maximumHitPoints: maximum,
      temporaryHitPoints: live?.temporary_hit_points ?? character.result.opening_state.temporary_hit_points,
      armorClass: live?.armor_class ?? record.armor_class, initiative: initiativeById.get(character.id) ?? null,
      visualTags: [record.species, ...record.classes.map((entry) => entry.name), ...record.armor_and_shields.slice(0,3).map((entry)=>entry.name), ...record.attacks.slice(0,3).map((entry)=>entry.name)].filter(Boolean).slice(0,12),
      preferredTokenAsset: character.vttTokenAsset || null, rulesetId: 'dnd-5.5e-srd-5.2.1', foundryRulesVersion: '2024', mechanics }]
  })
  const enemies = state.gameplay.initiative.filter((entry) => entry.entity_type === 'npc' && !bystanderNames.has(vttNameKey(entry.name))).map((entry) => {
    const hint=hintByName.get(vttNameKey(entry.name)); return { combatantId: entry.character_id, displayName: entry.name, initiative: entry.total,
      side: hint?.side === 'ally' ? 'ally' : 'enemy', srdTemplate: hint?.srd_template || entry.name, visualTags: hint?.visual_tags ?? [] }
  })
  const bystanders = setup.actors.filter((actor) => actor.side === 'bystander').map((actor,index) => ({
    combatantId: `foundry-bystander:${state.gameplay.turn_count}:${index}`, displayName: actor.name, initiative: 5, side: 'bystander',
    srdTemplate: actor.srd_template || 'Commoner', visualTags: actor.visual_tags,
  }))
  return { campaignId: state.adventure_id, turnNumber: state.gameplay.turn_count, sceneLabel: state.gameplay.scene || setup.environment || 'Combat', sceneSummary, vttSetup: setup, party, enemies, bystanders }
}

function forwardedHeaders(request: Request, turnId: string) {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'x-rpgyw-operation-id': turnId,
    'x-rpgyw-foundry-player': '1',
  })

  for (const name of ['authorization', 'user-agent', 'x-forwarded-for', 'x-real-ip']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  return headers
}

function gameplayError(payload: unknown, status: number) {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
  return new FoundryIntegrationError(
    typeof body.error === 'string'
      ? body.error
      : 'The RPG Your Way AIGM turn failed.',
    status || 502,
    typeof body.code === 'string'
      ? body.code
      : 'foundry_aigm_failed',
  )
}

export async function runFoundryAigmTurn(request: Request) {
  const rawBody = await request.json().catch(() => null) as FoundryAigmBody | null
  if (!rawBody || rawBody.version !== 1) {
    throw new FoundryIntegrationError(
      'The Foundry AIGM request is not valid.',
      400,
      'invalid_foundry_aigm_request',
    )
  }

  const message = cleanMessage(rawBody.message)
  const {
    account,
    user,
    playerLink,
    connection,
    campaign,
  } = await requireFoundryUsageAccount(request)

  if (campaign.mode !== 'multiplayer') {
    throw new FoundryIntegrationError(
      'The first Foundry AIGM bridge currently requires a multiplayer RPG Your Way campaign.',
      409,
      'multiplayer_campaign_required',
    )
  }

  const session = await liveSession(campaign.id as string)
  const revision = Math.max(1, Number(campaign.revision) || 1)
  const turnId = crypto.randomUUID()

  await beginMultiplayerTurn(
    user,
    session.invite_code,
    turnId,
    revision,
  )

  let billingPrepared = false
  try {
    const admin = createAdminClient()
    const { data: campaignRow, error: campaignError } = await admin
      .from('campaigns')
      .select('state, revision')
      .eq('id', campaign.id)
      .eq('revision', revision)
      .is('deleted_at', null)
      .maybeSingle()

    if (campaignError) {
      throw new FoundryIntegrationError(
        campaignError.message,
        503,
        'database_unavailable',
      )
    }
    if (!campaignRow?.state) {
      throw new FoundryIntegrationError(
        'The RPG Your Way campaign changed before the Foundry turn could begin.',
        409,
        'revision_conflict',
      )
    }

    const state = campaignRow.state as SavedAdventureState
    const speaker = await playerContext(
      campaign.id as string,
      session.id,
      playerLink.rpg_user_id as string,
    )
    const tableState = await foundryTableState(
      connection.id as string,
      session.id,
    )

    const innerRequest = new Request(request.url, {
      method: 'POST',
      headers: forwardedHeaders(request, turnId),
      body: JSON.stringify(
        gameplayBody(
          state,
          message,
          session.invite_code,
          revision,
          speaker,
          tableState,
          rawBody.tableSnapshot,
        ),
      ),
    })

    const gameplayResponse = await gameplayPost(innerRequest)
    const gameplayPayload = await gameplayResponse.json().catch(() => null)

    if (!gameplayResponse.ok) {
      throw gameplayError(gameplayPayload, gameplayResponse.status)
    }

    const reply = (
      gameplayPayload && typeof gameplayPayload === 'object'
        ? gameplayPayload as FoundryGameplayReply
        : {}
    )

    billingPrepared = Boolean(reply.usage_billing?.turn_billing_id)
    const nextState = applyGameplayReply(
      state,
      message,
      reply,
      turnId,
    )

    const saved = await saveCloudCampaign(
      user,
      campaign.id,
      {
        state: nextState,
        expectedRevision: revision,
        mode: 'multiplayer',
      },
    )

    await completeMultiplayerTurn(
      user.id,
      session.invite_code,
      turnId,
      saved.revision,
    )

    let vttQueued = false
    let vttWarning = ''
    if (reply.vtt_setup?.enabled) {
      try {
        await createFoundryCombatEncounter(
          user,
          vttEncounterInput(
            nextState,
            reply.vtt_setup,
            typeof reply.message === 'string' ? reply.message : nextState.gameplay.scene,
          ),
        )
        vttQueued = true
      } catch (queueError) {
        vttWarning = queueError instanceof Error
          ? queueError.message
          : 'RPG Your Way could not queue the VTT setup.'
      }
    }

    let settlement = null
    if (billingPrepared) {
      settlement = await markAudioComplete(
        account,
        turnId,
        0,
      )
    } else {
      await admin
        .from('multiplayer_turns')
        .update({
          billing_status: 'released',
          updated_at: new Date().toISOString(),
        })
        .eq('id', turnId)
    }

    return {
      version: 1 as const,
      turnId,
      campaignId: campaign.id as string,
      campaignRevision: saved.revision,
      playerDisplayName: speaker.display_name,
      playerCharacterNames: speaker.character_names,
      gameMasterName: (
        typeof reply.game_master_name === 'string' && reply.game_master_name.trim()
          ? reply.game_master_name.trim()
          : state.game_master_name || 'RPG Your Way'
      ),
      message: typeof reply.message === 'string'
        ? reply.message
        : '',
      scene: typeof reply.scene === 'string'
        ? reply.scene
        : state.gameplay.scene,
      combatSuggested: reply.combat_suggested === true,
      vttQueued,
      vttWarning,
      billing: settlement,
    }
  } catch (error) {
    if (billingPrepared) {
      await markPlayTurnReleased(
        account,
        turnId,
        error instanceof Error ? error.message : 'Foundry turn failed.',
      ).catch(() => undefined)
    } else {
      const admin = createAdminClient()
      await admin
        .from('multiplayer_turns')
        .update({
          turn_status: 'released',
          billing_status: 'released',
          settlement_warning: error instanceof Error ? error.message : 'Foundry turn failed.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', turnId)
        .neq('turn_status', 'committed')
    }

    if (error instanceof FoundryIntegrationError) throw error

    const candidate = error as { status?: unknown; code?: unknown; message?: unknown }
    throw new FoundryIntegrationError(
      typeof candidate.message === 'string'
        ? candidate.message
        : 'The Foundry AIGM turn failed.',
      typeof candidate.status === 'number'
        ? candidate.status
        : 502,
      typeof candidate.code === 'string'
        ? candidate.code
        : 'foundry_aigm_failed',
    )
  }
}
