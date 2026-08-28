'use client'

import { CheckCircle2, ClipboardPaste, FileUp, HelpCircle, ImageUp, LoaderCircle, Sparkles, X } from 'lucide-react'
import { type ChangeEvent, type ClipboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useAccessibleDialog } from '@/components/accessibility/use-accessible-dialog'
import type { CharacterAdvancementProfile, CharacterClassLevelHistory, StoredPartyCharacter } from '@/lib/aigm/campaign-storage'
import { normalizeLiveState, playNameFor } from '@/lib/aigm/campaign-storage'
import type { CharacterEditApiResponse } from '@/lib/aigm/types'
import type { AdvancementProfileApiResponse, LevelUpPlan, LevelUpPlanApiResponse } from '@/lib/aigm/level-up'
import { selectedRulesetFromSetupAnswers } from '@/lib/aigm/supported-systems'
import { DND55_CLASS_METADATA, dnd55PrerequisiteFailures, dnd55UnverifiedPrerequisiteClasses } from '@/lib/aigm/multiclassing'
import { canonicalizeCharacterRecord, characterFeatureEntries, normalizedRecordName } from '@/lib/aigm/character-record'

type HitPointMethod = 'roll' | 'fixed' | 'other' | ''
type CoinKey = 'pp' | 'gp' | 'ep' | 'sp' | 'cp'
const COIN_KEYS: CoinKey[] = ['pp', 'gp', 'ep', 'sp', 'cp']
const OTHER_SUBCLASS = '__other_subclass__'

interface ApiError {
  error?: string
  details?: string
  request_id?: string
}

interface LevelUpDialogProps {
  open: boolean
  characters: StoredPartyCharacter[]
  setupAnswers: string[]
  eligibleCharacterIds: string[]
  initialCharacterId?: string | null
  onClose: () => void
  onUseCharacterEditor: (characterId: string) => void
  onSaveAdvancementProfile: (characterId: string, profile: CharacterAdvancementProfile) => void
  onSaveLevelUp: (characterId: string, proposedResult: CharacterEditApiResponse['proposed_result'], proposedPlayName: string, advancingClass: string, history: CharacterClassLevelHistory, hitPointDie?: number) => void
}

function errorText(payload: ApiError, fallback: string) {
  return [payload.error || fallback, payload.details, payload.request_id ? `Reference: ${payload.request_id}` : ''].filter(Boolean).join(' ')
}

function normalizedSpellName(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US')
}

function splitSpellAnswer(value: string) {
  return value.split(/[;,\n]+/).map((entry) => entry.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function spellSelectionCount(choice: LevelUpPlan['choices'][number]) {
  if (Number.isInteger(choice.selection_count) && choice.selection_count >= 1) return choice.selection_count
  const text = `${choice.label} ${choice.help}`
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }
  const match = text.match(/(?:choose|add|learn|select|pick)\s+(?:up to\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b[^.]{0,100}?(?:spells?|cantrips?)/i)
  if (!match) return 1
  const numeric = Number(match[1])
  return Number.isFinite(numeric) && numeric > 0 ? numeric : words[match[1].toLocaleLowerCase('en-US')] || 1
}

function spellLevelLabel(level: number) {
  if (level < 0) return 'From your character record'
  if (level === 0) return 'Cantrips'
  const suffix = level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'
  return `${level}${suffix}-level spells`
}

function SpellOptionAccordion({
  title,
  options,
  selected,
  selectionLimit,
  onToggle,
}: {
  title: string
  options: Array<{ name: string; level: number }>
  selected: string[]
  selectionLimit: number
  onToggle: (name: string) => void
}) {
  if (options.length === 0) return <p className="mt-2 text-xs font-normal leading-relaxed text-muted-foreground">No additional SRD spell names were found for this choice.</p>
  const selectedKeys = new Set(selected.map(normalizedSpellName))
  const grouped = new Map<number, Array<{ name: string; level: number }>>()
  for (const option of options) grouped.set(option.level, [...(grouped.get(option.level) ?? []), option])
  const full = selectionLimit > 1 && selected.length >= selectionLimit
  return (
    <details className="wardens-accordion mt-3 overflow-hidden rounded-xl border border-border bg-card">
      <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-primary">{title} ({options.length})</summary>
      <div className="space-y-3 border-t border-border p-3">
        {[...grouped.entries()].sort((left, right) => left[0] - right[0]).map(([level, spells]) => (
          <details key={level} className="rounded-lg border border-border bg-background/70" open={grouped.size <= 2}>
            <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-foreground">{spellLevelLabel(level)} ({spells.length})</summary>
            <div className="flex flex-wrap gap-2 border-t border-border p-2.5">
              {spells.map((spell) => {
                const isSelected = selectedKeys.has(normalizedSpellName(spell.name))
                return <button key={spell.name} type="button" onClick={() => onToggle(spell.name)} disabled={!isSelected && full} aria-pressed={isSelected} className={`rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition ${isSelected ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-card text-muted-foreground hover:border-primary/45 hover:text-foreground'} disabled:cursor-not-allowed disabled:opacity-40`}>{spell.name}</button>
              })}
            </div>
          </details>
        ))}
      </div>
    </details>
  )
}

export function LevelUpDialog({ open, characters, setupAnswers, eligibleCharacterIds, initialCharacterId, onClose, onUseCharacterEditor, onSaveAdvancementProfile, onSaveLevelUp }: LevelUpDialogProps) {
  const eligibleSet = useMemo(() => new Set(eligibleCharacterIds), [eligibleCharacterIds])
  const readyCharacters = useMemo(() => characters.filter((character) => character.result && character.status === 'ready'), [characters])
  const eligibleCharacters = useMemo(() => readyCharacters.filter((character) => eligibleSet.has(character.id)), [readyCharacters, eligibleSet])
  const [selectedId, setSelectedId] = useState('')
  const selectableCharacters = useMemo(() => readyCharacters.filter((character) => eligibleSet.has(character.id) || character.id === selectedId), [readyCharacters, eligibleSet, selectedId])
  const [advancingClass, setAdvancingClass] = useState('')
  const [takingNewClass, setTakingNewClass] = useState(false)
  const [multiclassPrerequisiteConfirmed, setMulticlassPrerequisiteConfirmed] = useState(false)
  const [plan, setPlan] = useState<LevelUpPlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [chartFile, setChartFile] = useState<File | null>(null)
  const [pastedChart, setPastedChart] = useState('')
  const [profileDraft, setProfileDraft] = useState<CharacterAdvancementProfile | null>(null)
  const [selectedSubclass, setSelectedSubclass] = useState('')
  const [customSubclassName, setCustomSubclassName] = useState('')
  const [customSubclassMode, setCustomSubclassMode] = useState(false)
  const [currencyDraft, setCurrencyDraft] = useState<Record<CoinKey, string>>({ pp: '0', gp: '0', ep: '0', sp: '0', cp: '0' })
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>({})
  const [hitPointMethod, setHitPointMethod] = useState<HitPointMethod>('')
  const [hitPointRoll, setHitPointRoll] = useState('')
  const [newMaximumHp, setNewMaximumHp] = useState('')
  const [manualHitPointDie, setManualHitPointDie] = useState('')
  const [spellsToRemove, setSpellsToRemove] = useState<string[]>([])
  const [spellsToAdd, setSpellsToAdd] = useState<string[]>([])
  const [manualReplacementSpells, setManualReplacementSpells] = useState('')
  const [cantripToRemove, setCantripToRemove] = useState<string[]>([])
  const [cantripToAdd, setCantripToAdd] = useState<string[]>([])
  const [manualReplacementCantrip, setManualReplacementCantrip] = useState('')
  const [featureDetails, setFeatureDetails] = useState('')
  const [recordReading, setRecordReading] = useState(false)
  const [recordProposal, setRecordProposal] = useState<CharacterEditApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open, onClose, initialFocusRef: headingRef })

  const selectedCharacter = readyCharacters.find((character) => character.id === selectedId) ?? null
  const selectedRuleset = selectedRulesetFromSetupAnswers(setupAnswers)
  const classes = selectedCharacter?.result?.character.classes ?? []
  const isMulticlassCharacter = classes.length > 1 || takingNewClass
  const availableDnd55NewClasses = DND55_CLASS_METADATA.filter((metadata) => !classes.some((entry) => entry.name.trim().toLocaleLowerCase('en-US') === metadata.name.toLocaleLowerCase('en-US')))
  const multiclassPrerequisiteFailures = takingNewClass && selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' && selectedCharacter?.result && advancingClass
    ? dnd55PrerequisiteFailures(classes, advancingClass, selectedCharacter.result.character.ability_scores)
    : []
  const multiclassUnverifiedClasses = takingNewClass && selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' && advancingClass
    ? dnd55UnverifiedPrerequisiteClasses(classes, advancingClass)
    : []
  const currentClassEntry = classes.find((entry) => entry.name.trim().toLocaleLowerCase() === advancingClass.trim().toLocaleLowerCase()) ?? null
  const currentSubclass = currentClassEntry?.subclass.replace(/\s+/g, ' ').trim() ?? ''
  const profileKind = (profile: CharacterAdvancementProfile) => profile.profile_kind === 'subclass' ? 'subclass' : 'class'
  const savedProfile = selectedCharacter?.advancementProfiles?.find((profile) => profileKind(profile) === 'class' && profile.class_name.trim().toLocaleLowerCase() === advancingClass.trim().toLocaleLowerCase()) ?? null
  const savedSubclassProfile = selectedCharacter?.advancementProfiles?.find((profile) => profileKind(profile) === 'subclass'
    && profile.class_name.trim().toLocaleLowerCase() === advancingClass.trim().toLocaleLowerCase()
    && (profile.subclass_name || '').trim().toLocaleLowerCase() === selectedSubclass.trim().toLocaleLowerCase()) ?? null
  const activeProfile = profileDraft && profileKind(profileDraft) === 'class' ? profileDraft : savedProfile
  const activeSubclassProfile = profileDraft && profileKind(profileDraft) === 'subclass' ? profileDraft : savedSubclassProfile
  const storedHitPointDie = Number(activeProfile?.hit_point_die)
  const profileHitPointDie = Number.isInteger(storedHitPointDie) && storedHitPointDie >= 2 && storedHitPointDie <= 100 ? storedHitPointDie : 0
  const enteredHitPointDie = Number(manualHitPointDie)
  const playerHitPointDie = Number.isInteger(enteredHitPointDie) && enteredHitPointDie >= 2 && enteredHitPointDie <= 100 ? enteredHitPointDie : 0
  const activeHitPointDie = plan?.hit_point_die || profileHitPointDie || playerHitPointDie || 0
  const characterRecord = selectedCharacter?.result?.character ?? null
  const spellcasting = characterRecord?.spellcasting ?? null
  const currentPreparedSpells = spellcasting?.prepared_or_known_spells ?? []
  const currentSpellbookSpells = spellcasting?.spellbook_or_other_spells ?? []
  const currentCantrips = spellcasting?.cantrips ?? []
  const constitutionScore = characterRecord?.ability_scores.constitution ?? 10
  const constitutionModifier = Math.floor((constitutionScore - 10) / 2)
  const currentMaximumHp = characterRecord?.hit_points.maximum ?? 0
  const liveCurrency = selectedCharacter?.result
    ? normalizeLiveState(selectedCharacter.liveState, selectedCharacter.result).currency
    : { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0, total_gp_value: 0 }

  function finalCurrency() {
    const values = Object.fromEntries(COIN_KEYS.map((coin) => {
      const parsed = Number(currencyDraft[coin])
      return [coin, Number.isInteger(parsed) && parsed >= 0 ? parsed : Number.NaN]
    })) as Record<CoinKey, number>
    const valid = COIN_KEYS.every((coin) => Number.isFinite(values[coin]))
    if (!valid) return null
    const totalGp = Number((values.cp / 100 + values.sp / 10 + values.ep / 2 + values.gp + values.pp * 10).toFixed(2))
    return { ...values, total_gp_value: totalGp }
  }

  function resetLevelChoices() {
    setHitPointMethod('')
    setHitPointRoll('')
    setNewMaximumHp('')
    setSpellsToRemove([])
    setSpellsToAdd([])
    setManualReplacementSpells('')
    setCantripToRemove([])
    setCantripToAdd([])
    setManualReplacementCantrip('')
  }

  function targetMaximumSpellLevel(activePlan: LevelUpPlan | null) {
    if (!activePlan) return 0
    if (activePlan.srd_spell_max_level) return activePlan.srd_spell_max_level
    return (spellcasting?.slots ?? []).reduce((maximum, slot) => {
      const match = slot.level.match(/(\d+)/)
      const level = match ? Number(match[1]) : 0
      return Number.isFinite(level) ? Math.max(maximum, level) : maximum
    }, 0)
  }

  function newSpellbookSelections(activePlan: LevelUpPlan | null) {
    if (!activePlan) return []
    return activePlan.choices.flatMap((choice) => (choice.choice_kind === 'spellbook' || /spellbook/i.test(`${choice.label} ${choice.help}`)) ? splitSpellAnswer(choiceAnswers[choice.id] || '') : [])
  }

  function recordSpellOptions(names: string[], activePlan: LevelUpPlan | null) {
    const catalog = activePlan?.srd_spell_catalog ?? []
    const byName = new Map(catalog.map((spell) => [normalizedSpellName(spell.name), spell]))
    const seen = new Set<string>()
    return names.flatMap((name) => {
      const clean = name.replace(/\s+/g, ' ').trim()
      const key = normalizedSpellName(clean)
      if (!clean || seen.has(key)) return []
      seen.add(key)
      return [byName.get(key) ?? { name: clean, level: -1 }]
    })
  }

  function spellChoiceKind(choice: LevelUpPlan['choices'][number], activePlan?: LevelUpPlan | null) {
    if (choice.choice_kind === 'spellbook') return 'spellbook'
    if (choice.choice_kind === 'prepared_spell') return 'prepared'
    if (choice.choice_kind === 'known_spell') return 'known'
    if (choice.choice_kind === 'cantrip') return 'cantrip'
    const text = `${choice.label} ${choice.help}`.toLocaleLowerCase('en-US')
    if (!/spell|cantrip/.test(text)) return ''
    if (/cantrip/.test(text)) return 'cantrip'
    if (/spellbook/.test(text)) return 'spellbook'
    if (/prepar|memoriz/.test(text)) return 'prepared'
    if (/known|learn/.test(text)) return 'known'
    if (activePlan?.spell_change_guidance?.replacement_source === 'spellbook' && activePlan.choices.some((entry) => /spellbook/i.test(`${entry.label} ${entry.help}`))) return 'prepared'
    return 'spell'
  }

  function eligibleSrdOptionsForChoice(choice: LevelUpPlan['choices'][number]) {
    if (!plan) return []
    const catalog = plan.srd_spell_catalog ?? []
    const maximumLevel = targetMaximumSpellLevel(plan)
    const kind = spellChoiceKind(choice, plan)
    const exclude = new Set<string>()
    const unique = (items: Array<{ name: string; level: number }>) => {
      const seen = new Set<string>()
      return items.filter((spell) => {
        const key = normalizedSpellName(spell.name)
        if (!key || seen.has(key) || exclude.has(key)) return false
        seen.add(key)
        return true
      })
    }
    if (kind === 'cantrip') {
      currentCantrips.forEach((spell) => exclude.add(normalizedSpellName(spell)))
      return unique(catalog.filter((spell) => spell.level === 0))
    }
    if (kind === 'spellbook') {
      ;[...currentSpellbookSpells, ...currentPreparedSpells].forEach((spell) => exclude.add(normalizedSpellName(spell)))
      return unique(catalog.filter((spell) => spell.level >= 1 && (!maximumLevel || spell.level <= maximumLevel)))
    }
    if (kind === 'prepared' && plan.spell_change_guidance?.replacement_source === 'spellbook') {
      currentPreparedSpells.forEach((spell) => exclude.add(normalizedSpellName(spell)))
      return unique(recordSpellOptions([...currentSpellbookSpells, ...newSpellbookSelections(plan)], plan))
    }
    ;[...currentPreparedSpells, ...currentSpellbookSpells].forEach((spell) => exclude.add(normalizedSpellName(spell)))
    return unique(catalog.filter((spell) => spell.level >= 1 && (!maximumLevel || spell.level <= maximumLevel)))
  }

  function replaceableCurrentCantrips(activePlan: LevelUpPlan | null) {
    if (!activePlan) return []
    const replacementCatalog = activePlan.srd_replacement_cantrips ?? []
    if (replacementCatalog.length === 0) return []
    const legal = new Set(replacementCatalog.map((spell) => normalizedSpellName(spell.name)))
    return recordSpellOptions(currentCantrips, activePlan).filter((spell) => legal.has(normalizedSpellName(spell.name)))
  }

  function toggleSpellChoice(choiceId: string, spellName: string, limit: number) {
    const current = splitSpellAnswer(choiceAnswers[choiceId] || '')
    const key = normalizedSpellName(spellName)
    const has = current.some((entry) => normalizedSpellName(entry) === key)
    let next: string[]
    if (has) next = current.filter((entry) => normalizedSpellName(entry) !== key)
    else if (limit <= 1) next = [spellName]
    else if (current.length < limit) next = [...current, spellName]
    else next = current
    setChoiceAnswers((answers) => ({ ...answers, [choiceId]: next.join(', ') }))
    setRecordProposal(null)
    setError(null)
  }

  function toggleListValue(setter: (value: string[]) => void, current: string[], value: string, limit: number) {
    const key = normalizedSpellName(value)
    const has = current.some((entry) => normalizedSpellName(entry) === key)
    if (has) setter(current.filter((entry) => normalizedSpellName(entry) !== key))
    else if (limit <= 1) setter([value])
    else if (current.length < limit) setter([...current, value])
  }

  function calculatedMaximumHp() {
    if (!plan) return Number.NaN
    if (hitPointMethod === 'fixed' && activeHitPointDie) {
      const fixedGain = plan.fixed_hit_point_gain ?? Math.floor(activeHitPointDie / 2) + 1
      return currentMaximumHp + Math.max(1, fixedGain + constitutionModifier)
    }
    if (hitPointMethod === 'roll' && activeHitPointDie) {
      const rolled = Number(hitPointRoll)
      if (!Number.isInteger(rolled) || rolled < 1 || rolled > activeHitPointDie) return Number.NaN
      return currentMaximumHp + Math.max(1, rolled + constitutionModifier)
    }
    return Number(newMaximumHp)
  }

  useEffect(() => {
    if (!open) return
    const preferred = eligibleCharacters.find((character) => character.id === initialCharacterId) ?? eligibleCharacters[0] ?? null
    const preferredClass = preferred?.result?.character.classes[0] ?? null
    setSelectedId(preferred?.id ?? '')
    setAdvancingClass(preferredClass?.name ?? '')
    setTakingNewClass(false)
    setMulticlassPrerequisiteConfirmed(false)
    setSelectedSubclass(preferredClass?.subclass.replace(/\s+/g, ' ').trim() ?? '')
    setCustomSubclassName('')
    setCustomSubclassMode(false)
    setPlan(null)
    setChartFile(null)
    setPastedChart('')
    setProfileDraft(null)
    setManualHitPointDie('')
    setChoiceAnswers({})
    resetLevelChoices()
    setFeatureDetails('')
    setRecordProposal(null)
    setError(null)
    setHelpOpen(false)
    if (preferred?.result) {
      const currency = normalizeLiveState(preferred.liveState, preferred.result).currency
      setCurrencyDraft(Object.fromEntries(COIN_KEYS.map((coin) => [coin, String(currency[coin] ?? 0)])) as Record<CoinKey, string>)
    } else {
      setCurrencyDraft({ pp: '0', gp: '0', ep: '0', sp: '0', cp: '0' })
    }
  }, [open, initialCharacterId])

  useEffect(() => {
    if (!selectedCharacter?.result) return
    const existing = selectedCharacter.result.character.classes.find((entry) => entry.name === advancingClass)
    const nextClass = existing ?? selectedCharacter.result.character.classes[0] ?? null
    setTakingNewClass(false)
    setMulticlassPrerequisiteConfirmed(false)
    if (!existing) setAdvancingClass(nextClass?.name ?? '')
    setSelectedSubclass(nextClass?.subclass.replace(/\s+/g, ' ').trim() ?? '')
    setCustomSubclassName('')
    setCustomSubclassMode(false)
    resetLevelChoices()
    setPlan(null)
    setRecordProposal(null)
    setChoiceAnswers({})
    setProfileDraft(null)
    setChartFile(null)
    setPastedChart('')
    setManualHitPointDie('')
    setError(null)
    setFeatureDetails('')
    const currency = normalizeLiveState(selectedCharacter.liveState, selectedCharacter.result).currency
    setCurrencyDraft(Object.fromEntries(COIN_KEYS.map((coin) => [coin, String(currency[coin] ?? 0)])) as Record<CoinKey, string>)
  }, [selectedId])

  if (!open) return null

  async function requestPlan(options?: {
    classProfile?: CharacterAdvancementProfile | null
    subclassProfile?: CharacterAdvancementProfile | null
    subclassName?: string
  }) {
    if (!selectedCharacter?.result || !advancingClass) return
    const requestedSubclass = options?.subclassName === undefined ? selectedSubclass : options.subclassName
    setPlanLoading(true)
    setError(null)
    setRecordProposal(null)
    try {
      const response = await fetch('/api/aigm/level-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rpgyw-operation-id': crypto.randomUUID() },
        body: JSON.stringify({
          current_result: selectedCharacter.result,
          setup_answers: setupAnswers,
          advancement_profile: options?.classProfile === undefined ? activeProfile : options.classProfile,
          subclass_advancement_profile: options?.subclassProfile === undefined ? activeSubclassProfile : options.subclassProfile,
          advancing_class: advancingClass,
          selected_subclass: requestedSubclass,
          taking_new_class: takingNewClass,
          multiclass_prerequisite_confirmed: multiclassPrerequisiteConfirmed,
        }),
      })
      const payload = (await response.json()) as LevelUpPlanApiResponse
      if (!response.ok || !payload.plan) throw new Error(errorText(payload, 'RPG Your Way could not prepare that level-up.'))
      setPlan(payload.plan)
      if (payload.plan.subclass_name) setSelectedSubclass(payload.plan.subclass_name)
      resetLevelChoices()
      setChoiceAnswers(Object.fromEntries(payload.plan.choices.map((choice) => [choice.id, choice.options.length === 1 ? choice.options[0] : ''])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'RPG Your Way could not prepare that level-up.')
    } finally {
      setPlanLoading(false)
    }
  }

  function chooseChartFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    setChartFile(file)
    setProfileDraft(null)
    setError(null)
  }

  function clipboardImage(event: ClipboardEvent<HTMLElement>) {
    const imageItem = [...event.clipboardData.items].find((item) => item.kind === 'file' && item.type.startsWith('image/'))
    const blob = imageItem?.getAsFile()
    if (!blob) return null
    const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
    return new File([blob], `clipboard-advancement-${Date.now()}.${extension}`, { type: blob.type || 'image/png' })
  }

  function pasteAdvancementSource(event: ClipboardEvent<HTMLElement>) {
    if (!(plan?.needs_advancement_profile || plan?.needs_subclass_advancement_profile)) return
    const image = clipboardImage(event)
    if (!image) return
    event.preventDefault()
    setChartFile(image)
    setProfileDraft(null)
    setRecordProposal(null)
    setError(null)
  }

  function saveClassHitPointDie(value: string) {
    setManualHitPointDie(value)
    setHitPointRoll('')
    setNewMaximumHp('')
    setRecordProposal(null)
    setError(null)
    const die = Number(value)
    if (!selectedCharacter || !activeProfile || profileKind(activeProfile) !== 'class' || !Number.isInteger(die) || die < 2 || die > 100) return
    const nextProfile = { ...activeProfile, hit_point_die: die }
    setProfileDraft(nextProfile)
    onSaveAdvancementProfile(selectedCharacter.id, nextProfile)
    setPlan((current) => current ? { ...current, hit_point_die: die, fixed_hit_point_gain: Math.floor(die / 2) + 1 } : current)
  }

  async function readAdvancementChart() {
    const readingSubclass = Boolean(plan?.needs_subclass_advancement_profile)
    if (!selectedCharacter?.result || (!chartFile && !pastedChart.trim())) {
      setError(`Add a screenshot, PDF, or pasted ${readingSubclass ? 'subclass ' : ''}advancement chart first.`)
      return
    }
    if (readingSubclass && !selectedSubclass.trim()) {
      setError('Name the subclass before adding its advancement chart.')
      return
    }
    setChartLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      if (chartFile) formData.set('file', chartFile)
      if (pastedChart.trim()) formData.set('pasted_text', pastedChart.trim())
      formData.set('class_name', advancingClass)
      formData.set('ruleset', selectedRuleset.requestedLabel || selectedRuleset.label)
      formData.set('profile_kind', readingSubclass ? 'subclass' : 'class')
      if (readingSubclass) formData.set('subclass_name', selectedSubclass.trim())
      const response = await fetch('/api/aigm/advancement-profile', { method: 'POST', headers: { 'x-rpgyw-operation-id': crypto.randomUUID() }, body: formData })
      const payload = (await response.json()) as AdvancementProfileApiResponse
      if (!response.ok || !payload.profile) throw new Error(errorText(payload, `RPG Your Way could not read that ${readingSubclass ? 'subclass ' : ''}advancement chart.`))
      setProfileDraft(payload.profile)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'RPG Your Way could not read that advancement chart.')
    } finally {
      setChartLoading(false)
    }
  }

  async function useProfile() {
    if (!selectedCharacter || !profileDraft) return
    onSaveAdvancementProfile(selectedCharacter.id, profileDraft)
    setChartFile(null)
    setPastedChart('')
    if (profileKind(profileDraft) === 'subclass') await requestPlan({ subclassProfile: profileDraft, subclassName: profileDraft.subclass_name || selectedSubclass })
    else await requestPlan({ classProfile: profileDraft })
  }

  function buildLevelUpEditText(activePlan: LevelUpPlan) {
    if (!selectedCharacter?.result) return ''
    const result = selectedCharacter.result
    const revisedClasses = activePlan.is_new_class
      ? [...result.character.classes, { name: activePlan.advancing_class, level: activePlan.target_class_level, subclass: activePlan.subclass_name || '' }]
      : result.character.classes.map((entry) => entry.name.toLocaleLowerCase() === activePlan.advancing_class.toLocaleLowerCase()
        ? { ...entry, level: activePlan.target_class_level, subclass: activePlan.subclass_name || entry.subclass }
        : entry)
    const answers = activePlan.choices.map((choice) => `${choice.label}: ${choiceAnswers[choice.id]?.trim() || 'No answer supplied'}`)
    const progression = activePlan.progression_values.map((entry) => `${entry.name}: ${entry.value}`)
    const slots = activePlan.spell_slots.map((entry) => `${entry.level}: ${entry.total} total, 0 used`)
    const finalMaximumHp = calculatedMaximumHp()
    const currency = finalCurrency()
    const manualReplacements = splitSpellAnswer(manualReplacementSpells)
    const replacementAdds = [...spellsToAdd, ...manualReplacements].filter((value, index, array) => array.findIndex((other) => normalizedSpellName(other) === normalizedSpellName(value)) === index)
    const levelOnePlusChanges = spellsToRemove.map((spell, index) => replacementAdds[index] ? `${spell} → ${replacementAdds[index]}` : '').filter(Boolean)
    const cantripReplacement = cantripToRemove[0] && (cantripToAdd[0] || manualReplacementCantrip.trim())
      ? `${cantripToRemove[0]} → ${cantripToAdd[0] || manualReplacementCantrip.trim()}`
      : ''
    return [
      'PLAYER-APPROVED LEVEL-UP UPDATE. Apply only the advancement information below and preserve every unrelated character fact.',
      `Change total level from ${result.character.total_level} to ${activePlan.target_total_level}.`,
      `Final class levels: ${revisedClasses.map((entry) => `${entry.name} ${entry.level}${entry.subclass ? ` (${entry.subclass})` : ''}`).join('; ')}.`,
      activePlan.proficiency_bonus ? `Final proficiency bonus: ${activePlan.proficiency_bonus}.` : '',
      `Hit point method selected by the player: ${hitPointMethod === 'roll' ? 'Roll hit points' : hitPointMethod === 'fixed' ? 'Use fixed hit points' : 'Other ruleset-specific method'}.`,
      hitPointMethod === 'fixed' && activePlan.fixed_hit_point_gain ? `Hit point arithmetic: fixed die contribution ${activePlan.fixed_hit_point_gain} plus Constitution modifier ${constitutionModifier >= 0 ? '+' : ''}${constitutionModifier}, minimum 1 HP gained.` : '',
      hitPointMethod === 'roll' && activeHitPointDie ? `Hit point arithmetic: player rolled ${hitPointRoll} on d${activeHitPointDie}; add Constitution modifier ${constitutionModifier >= 0 ? '+' : ''}${constitutionModifier}, minimum 1 HP gained.` : '',
      `Final maximum hit points: ${finalMaximumHp}.`,
      activePlan.subclass_name ? `Permanent subclass for ${activePlan.advancing_class}: ${activePlan.subclass_name}.` : '',
      activePlan.automatic_changes.length ? `Apply these source-supported automatic level-up changes when they have a natural place in the permanent record: ${activePlan.automatic_changes.join('; ')}.` : '',
      activePlan.feature_names.length ? `Add these newly gained features: ${activePlan.feature_names.join('; ')}. RPG Your Way will attach built-in SRD rules details automatically when they are available; preserve any player-supplied details for unsupported material.` : '',
      currency ? `LEVEL-UP CURRENCY CHECKPOINT. Replace the permanent currency totals with PP ${currency.pp}; GP ${currency.gp}; EP ${currency.ep}; SP ${currency.sp}; CP ${currency.cp}; Total GP ${currency.total_gp_value}. These are the player-reviewed current campaign totals, not new treasure.` : '',
      progression.length ? `Set or update these advancement quantities/resources when they have a natural place in the record: ${progression.join('; ')}.` : '',
      slots.length ? `Replace the permanent spell-slot capacity rows with: ${slots.join('; ')}.` : '',
      answers.length ? `Player choices for this level: ${answers.join('; ')}.` : '',
      levelOnePlusChanges.length ? `At this level, replace these ${activePlan.spell_change_guidance?.list_label || 'prepared or known'} spells: ${levelOnePlusChanges.join('; ')}.` : '',
      cantripReplacement ? `At this level, replace this cantrip: ${cantripReplacement}.` : '',
      featureDetails.trim() ? `Optional player-supplied rules/details for newly gained features. Preserve these operative details in the appropriate feature entries so the AIGM can use them during play: ${featureDetails.trim()}` : '',
      'Do not invent unsupported feature mechanics, spell descriptions, feat text, subclass rules, or options. Built-in SRD feature details may be added by RPG Your Way automatically. Full spell descriptions stay in the rules reference rather than the permanent character record.',
      'Add a concise player_corrections note that this level-up was completed through the RPG Your Way Level Up interface.',
    ].filter(Boolean).join('\n')
  }

  async function prepareRecordUpdate() {
    if (!selectedCharacter?.result || !plan?.can_proceed) return
    if (plan.subclass_required && !plan.subclass_name) {
      setError('Choose the character’s subclass before preparing the record update.')
      return
    }
    if (plan.needs_subclass_advancement_profile) {
      setError('Add the subclass advancement chart before preparing the record update.')
      return
    }
    if (!finalCurrency()) {
      setError('Enter nonnegative whole-number coin totals for PP, GP, EP, SP, and CP before preparing the record update.')
      return
    }
    if (!hitPointMethod) {
      setError('Choose how this level determines hit points before preparing the record update.')
      return
    }
    const hp = calculatedMaximumHp()
    if (!Number.isFinite(hp) || hp < 1 || hp > 10000) {
      setError(hitPointMethod === 'roll' && activeHitPointDie ? `Enter the d${activeHitPointDie} roll result before preparing the record update.` : 'Enter the character’s new maximum hit points before preparing the record update.')
      return
    }
    const manualReplacements = splitSpellAnswer(manualReplacementSpells)
    const replacementAdds = [...spellsToAdd, ...manualReplacements].filter((value, index, array) => array.findIndex((other) => normalizedSpellName(other) === normalizedSpellName(value)) === index)
    if ((spellsToRemove.length > 0 || replacementAdds.length > 0) && spellsToRemove.length !== replacementAdds.length) {
      setError('Choose one replacement for each prepared or known spell you are changing.')
      return
    }
    const replacementCantrip = cantripToAdd[0] || manualReplacementCantrip.trim()
    if (Boolean(cantripToRemove[0]) !== Boolean(replacementCantrip)) {
      setError('Choose both the cantrip being replaced and its replacement, or leave both blank.')
      return
    }
    const missingChoice = plan.choices.find((choice) => choice.required && !choiceAnswers[choice.id]?.trim())
    if (missingChoice) {
      setError(`Answer “${missingChoice.label}” before preparing the record update.`)
      return
    }
    const wrongSpellCount = plan.choices.find((choice) => {
      const kind = spellChoiceKind(choice, plan)
      if (!kind || !choice.required) return false
      return splitSpellAnswer(choiceAnswers[choice.id] || '').length !== spellSelectionCount(choice)
    })
    if (wrongSpellCount) {
      const expected = spellSelectionCount(wrongSpellCount)
      setError(`Choose exactly ${expected} ${expected === 1 ? 'spell' : 'spells'} for “${wrongSpellCount.label}.”`)
      return
    }
    setRecordReading(true)
    setError(null)
    setRecordProposal(null)
    try {
      const response = await fetch('/api/aigm/character-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-rpgyw-operation-id': crypto.randomUUID() },
        body: JSON.stringify({
          current_result: selectedCharacter.result,
          current_play_name: playNameFor(selectedCharacter),
          edit_text: buildLevelUpEditText(plan),
          source_text: selectedCharacter.sourceText || '',
          advancement_profiles: profileDraft ? [...(selectedCharacter.advancementProfiles ?? []), profileDraft] : (selectedCharacter.advancementProfiles ?? []),
        }),
      })
      const payload = (await response.json()) as CharacterEditApiResponse & ApiError
      if (!response.ok || !payload.proposed_result) throw new Error(errorText(payload, 'RPG Your Way could not prepare the permanent character-record update.'))

      const reviewedCurrency = finalCurrency()
      if (!reviewedCurrency) throw new Error('The reviewed coin totals became invalid before the record update was prepared.')
      const targetClassKey = plan.advancing_class.trim().toLocaleLowerCase('en-US')
      const proposedHasTargetClass = payload.proposed_result.character.classes.some((entry) => entry.name.trim().toLocaleLowerCase('en-US') === targetClassKey)
      const proposedClasses = payload.proposed_result.character.classes.map((entry) => entry.name.trim().toLocaleLowerCase('en-US') === targetClassKey
        ? { ...entry, level: plan.target_class_level, subclass: plan.subclass_name || entry.subclass }
        : entry)
      if (plan.is_new_class && !proposedHasTargetClass) proposedClasses.push({ name: plan.advancing_class, level: plan.target_class_level, subclass: plan.subclass_name || '' })
      const guaranteedFeatures = characterFeatureEntries(payload.proposed_result).map((entry) => ({ ...entry }))
      const subclassFeatureKeys = new Set((plan.subclass_feature_names ?? []).map(normalizedRecordName))
      for (const feature of plan.feature_names) {
        const key = normalizedRecordName(feature)
        if (!key) continue
        const alreadyPresent = guaranteedFeatures.some((entry) => normalizedRecordName(entry.name) === key)
        if (alreadyPresent) continue
        const detail = profileDraft?.levels
          .flatMap((row) => row.feature_details ?? [])
          .find((entry) => normalizedRecordName(entry.name) === key)?.text ?? ''
        const isSubclassFeature = subclassFeatureKeys.has(key)
        guaranteedFeatures.push({
          id: '',
          name: feature,
          detail,
          category: isSubclassFeature ? 'subclass' : 'class',
          class_name: plan.advancing_class,
          subclass_name: isSubclassFeature ? (plan.subclass_name ?? '') : '',
          level_gained: plan.target_class_level,
          source: detail ? 'Player-supplied advancement material' : 'Level Up',
        })
      }
      const finalHp = calculatedMaximumHp()
      const guaranteedSlots = plan.spell_slots.length > 0
        ? plan.spell_slots.map((slot) => ({ level: slot.level, total_shown: slot.total, used_shown: '0' }))
        : payload.proposed_result.character.spellcasting.slots
      const proposedResult = canonicalizeCharacterRecord({
        ...payload.proposed_result,
        character: {
          ...payload.proposed_result.character,
          classes: proposedClasses,
          total_level: plan.target_total_level,
          proficiency_bonus: plan.proficiency_bonus || payload.proposed_result.character.proficiency_bonus,
          hit_points: { ...payload.proposed_result.character.hit_points, maximum: finalHp },
          currency: reviewedCurrency,
          spellcasting: { ...payload.proposed_result.character.spellcasting, slots: guaranteedSlots },
          features: guaranteedFeatures,
        },
      }, profileDraft ? [...(selectedCharacter.advancementProfiles ?? []), profileDraft] : (selectedCharacter.advancementProfiles ?? []))
      const changeSummary = [...payload.change_summary]
      if (!changeSummary.some((item) => /\b(?:currency|coin|pp|gp|ep|sp|cp)\b/i.test(item))) {
        changeSummary.push(`Currency checkpoint: ${reviewedCurrency.pp} PP, ${reviewedCurrency.gp} GP, ${reviewedCurrency.ep} EP, ${reviewedCurrency.sp} SP, ${reviewedCurrency.cp} CP.`)
      }
      const proposal = { ...payload, proposed_result: proposedResult, change_summary: changeSummary }
      setRecordProposal(proposal)
      if (!proposal.can_save) setError(proposal.blocking_questions[0] || 'The proposed level-up still needs clarification before it can be saved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'RPG Your Way could not prepare the permanent character-record update.')
    } finally {
      setRecordReading(false)
    }
  }

  function saveLevelUp() {
    if (!selectedCharacter || !recordProposal?.can_save || !plan) return
    const finalHp = calculatedMaximumHp()
    const history: CharacterClassLevelHistory = {
      class_level: plan.target_class_level,
      total_character_level: plan.target_total_level,
      hit_points_gained: Number.isFinite(finalHp) ? Math.max(0, finalHp - currentMaximumHp) : undefined,
      hit_point_method: hitPointMethod || 'other',
      automatic_changes: plan.automatic_changes,
      choices: plan.choices.flatMap((choice) => {
        const value = choiceAnswers[choice.id]?.replace(/\s+/g, ' ').trim() || ''
        return value ? [{ label: choice.label, value }] : []
      }),
      class_feature_names: plan.class_feature_names ?? plan.feature_names.filter((name) => !(plan.subclass_feature_names ?? []).some((subclassName) => subclassName.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'))),
      subclass_name: plan.subclass_name || '',
      subclass_feature_names: plan.subclass_feature_names ?? [],
      progression_values: plan.progression_values,
      recorded_at: new Date().toISOString(),
    }
    onSaveLevelUp(selectedCharacter.id, recordProposal.proposed_result, recordProposal.proposed_play_name, plan.advancing_class, history, activeHitPointDie || undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-3 sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !planLoading && !chartLoading && !recordReading) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} onPaste={pasteAdvancementSource} className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-primary/45 bg-card p-5 shadow-2xl outline-none sm:p-7" role="dialog" aria-modal="true" aria-labelledby="level-up-heading">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary">Character advancement</p>
              <h2 ref={headingRef} tabIndex={-1} id="level-up-heading" className="mt-1 font-display text-3xl font-bold outline-none">Level Up</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">RPG Your Way can handle the bookkeeping and update the permanent character record after you review the changes.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={planLoading || chartLoading || recordReading} className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-40" aria-label="Close Level Up"><X className="size-5" aria-hidden="true" /></button>
        </div>

        <div className="mt-5 rounded-2xl border border-accent/35 bg-accent/5 p-4">
          <p className="font-display text-lg font-bold">Already leveled this character elsewhere?</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">If you already finished the level-up in your own character sheet, rules source, or character manager, use Edit Character Sheet and paste the completed changes instead of entering every choice again here.</p>
          <button type="button" onClick={() => selectedId && onUseCharacterEditor(selectedId)} disabled={!selectedId} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/45 bg-background px-4 text-sm font-bold text-accent transition hover:bg-accent/10 disabled:opacity-45"><ClipboardPaste className="size-4" aria-hidden="true" />Use Edit Character Sheet</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-muted-foreground">Character
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground">
              {selectableCharacters.map((character) => <option key={character.id} value={character.id}>{playNameFor(character)} · Level {character.result?.character.total_level}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-muted-foreground">Class gaining the level
            <select value={takingNewClass ? '__new_class__' : advancingClass} onChange={(event) => {
              const value = event.target.value
              const takingNew = value === '__new_class__'
              const nextClass = takingNew ? null : classes.find((entry) => entry.name === value)
              setTakingNewClass(takingNew)
              setMulticlassPrerequisiteConfirmed(false)
              setAdvancingClass(takingNew ? '' : value)
              setSelectedSubclass(nextClass?.subclass.replace(/\s+/g, ' ').trim() ?? '')
              setCustomSubclassName(''); setCustomSubclassMode(false); setPlan(null); setRecordProposal(null); setProfileDraft(null); setChartFile(null); setPastedChart(''); setManualHitPointDie(''); setError(null)
            }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground">
              {classes.map((entry) => <option key={entry.name} value={entry.name}>{entry.name} {entry.level} → {entry.level + 1}</option>)}
              {classes.length < 20 && <option value="__new_class__">Take level 1 in a new class…</option>}
            </select>
          </label>
        </div>

        {takingNewClass && (
          <div className="mt-3 rounded-2xl border border-primary/35 bg-primary/5 p-4">
            <p className="text-sm font-bold text-foreground">Multiclass: choose the new class</p>
            {selectedRuleset.id === 'dnd-5.5e-srd-5.2.1' ? (
              <label className="mt-2 block text-xs font-bold text-muted-foreground">New D&amp;D 5.5e class
                <input list={`dnd55-new-classes-${selectedCharacter?.id || 'character'}`} value={advancingClass} onChange={(event) => { setAdvancingClass(event.target.value.slice(0, 120)); setMulticlassPrerequisiteConfirmed(false); setPlan(null); setRecordProposal(null); setProfileDraft(null); setChartFile(null); setPastedChart(''); setManualHitPointDie(''); setError(null) }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground" placeholder="Choose or type a new class" />
                <datalist id={`dnd55-new-classes-${selectedCharacter?.id || 'character'}`}>{availableDnd55NewClasses.map((entry) => <option key={entry.name} value={entry.name}>{`d${entry.hitDie} Hit Die`}</option>)}</datalist>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">SRD classes are suggested. You can type an unsupported class such as Artificer and supply its advancement source when RPG Your Way asks for it.</span>
              </label>
            ) : (
              <label className="mt-2 block text-xs font-bold text-muted-foreground">New class name
                <input value={advancingClass} onChange={(event) => { setAdvancingClass(event.target.value.slice(0, 120)); setMulticlassPrerequisiteConfirmed(false); setPlan(null); setRecordProposal(null); setError(null) }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground" placeholder="Enter the class from your rules" />
              </label>
            )}
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">This adds level 1 of another class to the existing character. RPG Your Way keeps total character level separate from each individual class level.</p>
            {multiclassPrerequisiteFailures.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold text-destructive">{multiclassPrerequisiteFailures.map((item) => <li key={item}>{item}</li>)}</ul>}
            {multiclassUnverifiedClasses.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-500/45 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                <p>RPG Your Way cannot verify the primary-ability prerequisite for {multiclassUnverifiedClasses.join(', ')} from the built-in SRD. Check that requirement in your own source before continuing.</p>
                <label className="mt-2 flex cursor-pointer items-start gap-2 font-semibold text-foreground">
                  <input type="checkbox" checked={multiclassPrerequisiteConfirmed} onChange={(event) => setMulticlassPrerequisiteConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
                  <span>I checked the multiclass ability prerequisite for {multiclassUnverifiedClasses.join(', ')} in my source and this character qualifies.</span>
                </label>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void requestPlan()} disabled={!selectedCharacter || !advancingClass || multiclassPrerequisiteFailures.length > 0 || (multiclassUnverifiedClasses.length > 0 && !multiclassPrerequisiteConfirmed) || planLoading || chartLoading || recordReading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-45">{planLoading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}{planLoading ? 'Preparing level-up…' : 'Prepare level-up'}</button>
          <button type="button" onClick={() => setHelpOpen((current) => !current)} aria-expanded={helpOpen} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold text-primary"><HelpCircle className="size-4" aria-hidden="true" />How this works</button>
        </div>

        {helpOpen && (
          <div className="mt-4 space-y-3 rounded-2xl border border-border bg-background/65 p-4 text-sm leading-7 text-muted-foreground">
            <p><strong className="text-foreground">Automatic leveling uses the Dungeons &amp; Dragons and Pathfinder SRDs supported by RPG Your Way when the needed class or subclass advancement is actually present there.</strong> If your character uses material outside those SRDs, give RPG Your Way the relevant advancement chart and it can handle the bookkeeping from that chart.</p>
            <p>A screenshot of a class or subclass advancement chart is often the easiest source. PDF and pasted text work too. If you only have a physical rulebook or other printed source, you can photograph the relevant page with a phone or camera; make the page flat, well lit, in focus, and clearly readable. Image input is deliberately limited to Level Up advancement material; ordinary character edits stay text-only. RPG Your Way stores the compact progression plus character-relevant feature rules it can safely read from the player-supplied advancement material, not the uploaded page itself. That saved information can be reused at later levels and when refreshing an older character record.</p>
            <p>RPG Your Way is not trying to replace your rules or source material. For example, it may tell you that your character has gained <strong className="text-foreground">Flash of Genius</strong>, but you’ll need to look up exactly how that feature works in your own source material.</p>
            <p>If the advancement source does not include a feature’s operative rules, you can optionally add that feature text yourself. Saved feature details can give the AIGM a better chance of recognizing the ability during play, but those reminders are never guaranteed.</p>
          </div>
        )}

        {(plan?.needs_advancement_profile || plan?.needs_subclass_advancement_profile) && (
          <div className="mt-5 rounded-2xl border border-accent/45 bg-accent/10 p-4 sm:p-5">
            <p className="font-display text-xl font-bold">{plan.needs_subclass_advancement_profile ? 'Subclass advancement information needed' : 'Advancement information needed'}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.needs_subclass_advancement_profile ? `RPG Your Way needs the advancement chart for ${selectedSubclass || 'this subclass'} at this level. Give it that subclass chart once and the saved progression can be reused at later subclass levels.` : 'RPG Your Way could not find this class’s level progression in the selected built-in SRD. Give it your character’s advancement chart once and the saved progression can be reused at later levels.'}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-bold">Use the clearest complete source</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Screenshot, PDF, file, pasted text, clipboard image, or a clear photo of a physical source page all work. Keep photographed pages flat, well lit, in focus, and readable. If a tall table will not fit legibly in one screenshot or photo, paste the text or upload the complete file instead.</p>
                <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-primary/45 bg-primary/5 px-4 text-sm font-bold text-primary">
                  <ImageUp className="size-4" aria-hidden="true" />Choose screenshot or file
                  <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,.pdf,.txt,.md,.markdown,.json,.csv" onChange={chooseChartFile} />
                </label>
                <p className="mt-2 flex items-center gap-1.5 text-xs leading-relaxed text-muted-foreground"><ClipboardPaste className="size-3.5 shrink-0" aria-hidden="true" />Or press Ctrl+V / Command+V here to paste a screenshot directly from your clipboard.</p>
                {chartFile && <p className="mt-2 break-all text-xs font-semibold text-foreground">{chartFile.name}</p>}
              </div>
              <label className="rounded-2xl border border-border bg-card p-4 text-sm font-bold">Or paste the chart
                <textarea rows={6} value={pastedChart} onChange={(event) => setPastedChart(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal leading-relaxed text-foreground" placeholder={plan.needs_subclass_advancement_profile ? 'Paste the subclass progression table here…' : 'Paste the level progression table here…'} />
              </label>
            </div>
            <button type="button" onClick={() => void readAdvancementChart()} disabled={chartLoading || (!chartFile && !pastedChart.trim())} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 font-bold text-accent-foreground disabled:opacity-45">{chartLoading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />}{chartLoading ? 'Reading advancement chart…' : 'Read advancement chart'}</button>
          </div>
        )}

        {profileDraft && (
          <div className="mt-4 rounded-2xl border border-primary/35 bg-primary/5 p-4">
            <p className="font-bold text-foreground">Review the advancement chart RPG Your Way found</p>
            <p className="mt-1 text-sm text-muted-foreground">{profileDraft.title} · {profileDraft.class_name}{profileKind(profileDraft) === 'subclass' && profileDraft.subclass_name ? ` · ${profileDraft.subclass_name}` : ''} · Levels {profileDraft.levels[0]?.level}–{profileDraft.levels.at(-1)?.level}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {profileDraft.levels.map((row) => <div key={row.level} className="rounded-xl border border-border bg-card px-3 py-2 text-xs"><strong>Level {row.level}</strong><p className="mt-1 text-muted-foreground">{[...row.features, ...row.progression_values.map((entry) => `${entry.name}: ${entry.value}`)].join(' · ') || 'No visible change recorded'}</p>{row.feature_details?.length ? <details className="mt-2 rounded-lg border border-border/70 bg-background/65 px-2 py-1.5"><summary className="cursor-pointer font-bold text-primary">Retained feature rules ({row.feature_details.length})</summary><div className="mt-2 space-y-2 text-muted-foreground">{row.feature_details.map((entry) => <p key={`${row.level}-${entry.name}`}><strong className="text-foreground">{entry.name}:</strong> {entry.text}</p>)}</div></details> : null}</div>)}
            </div>
            {profileDraft.warnings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{profileDraft.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            <button type="button" onClick={() => void useProfile()} disabled={planLoading} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><CheckCircle2 className="size-4" aria-hidden="true" />Use this advancement chart</button>
          </div>
        )}

        {plan?.subclass_required && !currentSubclass && (
          <div className="mt-5 rounded-2xl border border-primary/35 bg-primary/5 p-4 sm:p-5">
            <p className="font-display text-xl font-bold">Choose subclass</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">This class gains a subclass at {plan.advancing_class} level {plan.target_class_level}. RPG Your Way can use the listed built-in SRD subclass, or you can name another subclass from your own source material.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="text-xs font-bold text-muted-foreground">Subclass
                <select value={customSubclassMode ? OTHER_SUBCLASS : plan.subclass_options?.includes(selectedSubclass) ? selectedSubclass : ''} onChange={(event) => { const value = event.target.value; setProfileDraft(null); setChartFile(null); setPastedChart(''); setRecordProposal(null); setError(null); if (value === OTHER_SUBCLASS) { setCustomSubclassMode(true); setSelectedSubclass(''); setCustomSubclassName(''); return }; setCustomSubclassMode(false); setSelectedSubclass(value); setCustomSubclassName(''); if (value) void requestPlan({ subclassName: value }) }} disabled={planLoading} className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold text-foreground disabled:opacity-60">
                  <option value="">Choose…</option>
                  {(plan.subclass_options ?? []).map((option) => <option key={option} value={option}>{option} · built-in SRD</option>)}
                  <option value={OTHER_SUBCLASS}>Another subclass from my source material</option>
                </select>
              </label>
              {planLoading && <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Applying subclass…</span>}
            </div>
            {customSubclassMode && (
              <div className="mt-3 rounded-xl border border-border bg-card p-3">
                <label className="text-xs font-bold text-muted-foreground">Other subclass name
                  <input value={customSubclassName} onChange={(event) => { setCustomSubclassName(event.target.value.slice(0, 140)); setRecordProposal(null); setError(null) }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground" placeholder="Enter the subclass name from your source material" />
                </label>
                <button type="button" onClick={() => { const name = customSubclassName.replace(/\s+/g, ' ').trim(); if (!name) { setError('Enter the subclass name first.'); return }; setSelectedSubclass(name); setCustomSubclassMode(true); setProfileDraft(null); setChartFile(null); setPastedChart(''); void requestPlan({ subclassName: name, subclassProfile: null }) }} disabled={planLoading || !customSubclassName.trim()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/45 bg-primary/5 px-4 text-sm font-bold text-primary disabled:opacity-45"><Sparkles className="size-4" aria-hidden="true" />Use my subclass</button>
              </div>
            )}
          </div>
        )}

        {plan?.can_proceed && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-primary/35 bg-primary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-display text-xl font-bold">{playNameFor(selectedCharacter!)}: Level {selectedCharacter!.result!.character.total_level} → {plan.target_total_level}</p><p className="mt-1 text-xs font-semibold text-primary">Source: {plan.source_label || (plan.source_kind === 'player_profile' ? 'Player-supplied advancement chart' : selectedRuleset.label)}</p>{plan.subclass_name && <p className="mt-1 text-xs font-semibold text-muted-foreground">Subclass: {plan.subclass_source_label || plan.subclass_name}</p>}</div>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">{plan.advancing_class} {plan.target_class_level}</span>
              </div>
              {plan.automatic_changes.length > 0 && <><p className="mt-4 text-sm font-bold">Automatic changes</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">{plan.automatic_changes.map((item) => <li key={item}>{item}</li>)}</ul></>}
              {plan.feature_names.length > 0 && <><p className="mt-4 text-sm font-bold">New features gained at this level</p><div className="mt-2 flex flex-wrap gap-2">{plan.feature_names.map((feature) => <span key={feature} className="rounded-full border border-primary/35 bg-card px-3 py-1.5 text-xs font-bold text-foreground">{feature}</span>)}</div></>}
              {plan.progression_values.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{plan.progression_values.map((entry) => <span key={`${entry.name}:${entry.value}`} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"><span className="text-muted-foreground">{entry.name}:</span> {entry.value}</span>)}</div>}
              {plan.spell_slots.length > 0 && <p className="mt-3 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Spell slots:</strong> {plan.spell_slots.map((slot) => `${slot.level}: ${slot.total}`).join(' · ')}</p>}
              {plan.warnings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            </div>

            <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
              <p className="font-bold text-foreground">Currency checkpoint</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Level Up carries the AIGM’s current tracked coin totals into the permanent character record. Review them here before saving. This makes the new character record the baseline for coin changes during the next level.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {COIN_KEYS.map((coin) => <label key={coin} className="rounded-xl border border-border bg-card p-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{coin}
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={currencyDraft[coin]} onChange={(event) => { setCurrencyDraft((current) => ({ ...current, [coin]: event.target.value })); setRecordProposal(null); setError(null) }} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-sm font-bold normal-case tracking-normal text-foreground" />
                </label>)}
              </div>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">Total GP: <strong className="text-foreground">{finalCurrency()?.total_gp_value ?? 'Check coin entries'}</strong></p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="rounded-2xl border border-border bg-background/65 p-4 text-sm font-bold">Hit point method *
                <select value={hitPointMethod} onChange={(event) => { setHitPointMethod(event.target.value as HitPointMethod); setHitPointRoll(''); setNewMaximumHp(''); setRecordProposal(null); setError(null) }} className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold">
                  <option value="">Choose…</option>
                  <option value="roll">Roll hit points</option>
                  <option value="fixed">Use fixed hit points</option>
                  <option value="other">Use another method from my rules</option>
                </select>
                <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">Choose the method your rules allow. When RPG Your Way knows the class Hit Point Die from the SRD or your saved class profile, it does the Constitution arithmetic for you.</span>
              </label>
              {!plan.hit_point_die && activeProfile && profileKind(activeProfile) === 'class' && (hitPointMethod === 'roll' || hitPointMethod === 'fixed') ? (
                <label className="rounded-2xl border border-accent/45 bg-accent/10 p-4 text-sm font-bold">Class Hit Point Die *
                  <select value={String(activeHitPointDie || '')} onChange={(event) => saveClassHitPointDie(event.target.value)} className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold">
                    <option value="">Choose once…</option>
                    {[4, 6, 8, 10, 12, 20].map((die) => <option key={die} value={die}>d{die}</option>)}
                  </select>
                  <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">RPG Your Way remembers this with the player-supplied {advancingClass} advancement profile, so later levels can calculate rolled or fixed HP normally.</span>
                </label>
              ) : (
                <div className="rounded-2xl border border-border bg-background/65 p-4 text-sm font-bold">
                  {hitPointMethod === 'fixed' && activeHitPointDie ? (
                  <>
                    <p>Fixed hit points</p>
                    <p className="mt-2 text-sm font-normal leading-relaxed text-muted-foreground">d{activeHitPointDie} fixed gain: <strong className="text-foreground">{plan.fixed_hit_point_gain ?? Math.floor(activeHitPointDie / 2) + 1}</strong> · Constitution modifier: <strong className="text-foreground">{constitutionModifier >= 0 ? '+' : ''}{constitutionModifier}</strong></p>
                    <p className="mt-2 rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm">New maximum: {calculatedMaximumHp()}</p>
                  </>
                ) : hitPointMethod === 'roll' && activeHitPointDie ? (
                  <label className="block">Roll a d{activeHitPointDie} *
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={hitPointRoll} onChange={(event) => { setHitPointRoll(event.target.value); setRecordProposal(null); setError(null) }} className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold" placeholder={`Enter only the d${activeHitPointDie} result`} />
                    <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">RPG Your Way adds your Constitution modifier ({constitutionModifier >= 0 ? '+' : ''}{constitutionModifier}) automatically. Minimum gain: 1 HP.</span>
                    {Number.isFinite(calculatedMaximumHp()) && <span className="mt-2 block rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm font-bold text-foreground">New maximum: {calculatedMaximumHp()}</span>}
                  </label>
                ) : hitPointMethod ? (
                  <label className="block">New maximum hit points *
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={newMaximumHp} onChange={(event) => { setNewMaximumHp(event.target.value); setRecordProposal(null); setError(null) }} className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold" placeholder={`Current maximum: ${currentMaximumHp}`} />
                    <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">RPG Your Way could not safely calculate this method from the built-in reference, so enter the finished maximum from your rules.</span>
                  </label>
                  ) : <p className="text-xs font-normal leading-relaxed text-muted-foreground">Choose a hit-point method to continue.</p>}
                </div>
              )}
              {plan.choices.map((choice) => {
                const kind = spellChoiceKind(choice, plan)
                const spellOptions = kind ? eligibleSrdOptionsForChoice(choice) : []
                const limit = spellSelectionCount(choice)
                const selectedSpells = splitSpellAnswer(choiceAnswers[choice.id] || '')
                return <label key={choice.id} className="rounded-2xl border border-border bg-background/65 p-4 text-sm font-bold">{choice.label}{choice.required ? ' *' : ''}
                  {kind ? (
                    <>
                      <input value={choiceAnswers[choice.id] || ''} onChange={(event) => { setChoiceAnswers((current) => ({ ...current, [choice.id]: event.target.value })); setRecordProposal(null); setError(null) }} className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-normal" placeholder={limit > 1 ? `Enter up to ${limit} spell names, separated by commas` : 'Enter a spell from your source material'} />
                      {kind === 'spellbook' && currentSpellbookSpells.length > 0 && <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground"><strong className="text-foreground">Already in the spellbook:</strong> {currentSpellbookSpells.join(', ')}</span>}
                      {kind === 'prepared' && currentPreparedSpells.length > 0 && <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground"><strong className="text-foreground">Currently prepared:</strong> {currentPreparedSpells.join(', ')}</span>}
                      {kind === 'known' && currentPreparedSpells.length > 0 && <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground"><strong className="text-foreground">Already known:</strong> {currentPreparedSpells.join(', ')}</span>}
                      <SpellOptionAccordion title={kind === 'prepared' && plan.spell_change_guidance?.replacement_source === 'spellbook' ? 'Show spells available to prepare' : 'Show eligible SRD spells'} options={spellOptions} selected={selectedSpells} selectionLimit={limit} onToggle={(name) => toggleSpellChoice(choice.id, name, limit)} />
                      <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground">{kind === 'prepared' && plan.spell_change_guidance?.replacement_source === 'spellbook' ? 'This list follows the character’s spellbook, including spellbook choices made above. SRD spells are grouped by level; other spell names already recorded in the spellbook remain available too.' : 'RPG Your Way offers only SRD spell names in this list. You can still type a legal spell from your own source material.'}</span>
                    </>
                  ) : choice.options.length > 0 ? (
                    <select value={choiceAnswers[choice.id] || ''} onChange={(event) => { setChoiceAnswers((current) => ({ ...current, [choice.id]: event.target.value })); setRecordProposal(null); setError(null) }} className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold"><option value="">Choose…</option>{choice.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
                  ) : (
                    <input value={choiceAnswers[choice.id] || ''} onChange={(event) => { setChoiceAnswers((current) => ({ ...current, [choice.id]: event.target.value })); setRecordProposal(null); setError(null) }} className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-normal" placeholder="Enter your choice from your source material" />
                  )}
                  {choice.help && <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">{choice.help}</span>}
                </label>
              })}
            </div>

            {plan.spell_change_guidance && isMulticlassCharacter && ((plan.spell_change_guidance.level_one_plus_change !== 'none' && currentPreparedSpells.length > 0) || (plan.spell_change_guidance.cantrip_replacement && replaceableCurrentCantrips(plan).length > 0)) && (
              <div className="rounded-2xl border border-primary/35 bg-primary/5 p-4">
                <p className="font-bold text-foreground">Optional spell changes at this level</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">RPG Your Way does not yet have reliable per-class ownership for every spell already stored on a legacy multiclass record, so it will not offer optional replacements here. Required new spell choices for the class gaining this level are still handled above.</p>
              </div>
            )}

            {plan.spell_change_guidance && !isMulticlassCharacter && ((plan.spell_change_guidance.level_one_plus_change !== 'none' && currentPreparedSpells.length > 0) || (plan.spell_change_guidance.cantrip_replacement && replaceableCurrentCantrips(plan).length > 0)) && (
              <div className="rounded-2xl border border-primary/35 bg-primary/5 p-4">
                <p className="font-bold text-foreground">Optional spell changes at this level</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Level Up can also record spell changes your class rules allow. Outside leveling, ordinary spell changes can still be made through Edit character sheet.</p>
                {plan.spell_change_guidance.level_one_plus_change !== 'none' && currentPreparedSpells.length > 0 && (() => {
                  const maximumLevel = targetMaximumSpellLevel(plan)
                  const replacementLimit = plan.spell_change_guidance.level_one_plus_change === 'one' ? 1 : currentPreparedSpells.length
                  const replacementPool = plan.spell_change_guidance.replacement_source === 'spellbook'
                    ? recordSpellOptions([...currentSpellbookSpells, ...newSpellbookSelections(plan)], plan).filter((spell) => !currentPreparedSpells.some((current) => normalizedSpellName(current) === normalizedSpellName(spell.name)))
                    : (plan.srd_spell_catalog ?? []).filter((spell) => spell.level >= 1 && (!maximumLevel || spell.level <= maximumLevel) && !currentPreparedSpells.some((current) => normalizedSpellName(current) === normalizedSpellName(spell.name)))
                  return <div className="mt-3 rounded-xl border border-border bg-card p-3">
                    <p className="text-sm font-bold">{plan.spell_change_guidance.level_one_plus_change === 'one' ? `You may replace one ${plan.spell_change_guidance.list_label} spell.` : `You may change your ${plan.spell_change_guidance.list_label} spells.`}</p>
                    <SpellOptionAccordion title={`Choose ${plan.spell_change_guidance.list_label} spell to replace`} options={recordSpellOptions(currentPreparedSpells, plan)} selected={spellsToRemove} selectionLimit={replacementLimit} onToggle={(name) => toggleListValue(setSpellsToRemove, spellsToRemove, name, replacementLimit)} />
                    <SpellOptionAccordion title={plan.spell_change_guidance.replacement_source === 'spellbook' ? 'Choose replacement from your spellbook' : 'Choose replacement from eligible SRD spells'} options={replacementPool} selected={spellsToAdd} selectionLimit={replacementLimit} onToggle={(name) => toggleListValue(setSpellsToAdd, spellsToAdd, name, replacementLimit)} />
                    <label className="mt-3 block text-xs font-bold text-muted-foreground">Or type replacement spell name{replacementLimit > 1 ? 's, separated by commas' : ''} from your own source material
                      <input value={manualReplacementSpells} onChange={(event) => { setManualReplacementSpells(event.target.value); setRecordProposal(null); setError(null) }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal text-foreground" placeholder="Optional non-SRD replacement" />
                    </label>
                  </div>
                })()}
                {plan.spell_change_guidance.cantrip_replacement && replaceableCurrentCantrips(plan).length > 0 && (
                  <div className="mt-3 rounded-xl border border-border bg-card p-3">
                    <p className="text-sm font-bold">Cantrip replacement</p>
                    <SpellOptionAccordion title="Choose cantrip to replace" options={replaceableCurrentCantrips(plan)} selected={cantripToRemove} selectionLimit={1} onToggle={(name) => toggleListValue(setCantripToRemove, cantripToRemove, name, 1)} />
                    <SpellOptionAccordion title="Choose replacement SRD cantrip" options={(plan.srd_replacement_cantrips ?? []).filter((spell) => !currentCantrips.some((current) => normalizedSpellName(current) === normalizedSpellName(spell.name)))} selected={cantripToAdd} selectionLimit={1} onToggle={(name) => toggleListValue(setCantripToAdd, cantripToAdd, name, 1)} />
                    <label className="mt-3 block text-xs font-bold text-muted-foreground">Or type a replacement cantrip from your own source material
                      <input value={manualReplacementCantrip} onChange={(event) => { setManualReplacementCantrip(event.target.value); setRecordProposal(null); setError(null) }} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-normal text-foreground" placeholder="Optional non-SRD cantrip" />
                    </label>
                  </div>
                )}
              </div>
            )}

            <label className="block rounded-2xl border border-border bg-background/65 p-4 text-sm font-bold">Optional feature details for the AIGM
              <textarea rows={4} value={featureDetails} onChange={(event) => setFeatureDetails(event.target.value.slice(0, 12000))} className="mt-2 w-full resize-y rounded-xl border border-input bg-card px-3 py-2 text-sm font-normal leading-relaxed" placeholder="Optional: paste how a newly gained feature works…" />
              <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">You do not need to provide feature rules to finish leveling. Adding them may help the AIGM notice situations where the feature could be useful.</span>
            </label>

            <button type="button" onClick={() => void prepareRecordUpdate()} disabled={recordReading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-45">{recordReading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />}{recordReading ? 'Preparing character record…' : 'Review character-record update'}</button>
          </div>
        )}

        {recordProposal && (
          <div className="mt-5 rounded-2xl border border-accent/45 bg-accent/10 p-4 sm:p-5">
            <p className="font-display text-xl font-bold">Final review</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Nothing changes until you save this level-up.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">{recordProposal.change_summary.map((item) => <li key={item}>{item}</li>)}</ul>
            {recordProposal.duplicate_warnings.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{recordProposal.duplicate_warnings.map((item) => <li key={item}>{item}</li>)}</ul>}
            {recordProposal.blocking_questions.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-destructive">{recordProposal.blocking_questions.map((item) => <li key={item}>{item}</li>)}</ul>}
            <button type="button" onClick={saveLevelUp} disabled={!recordProposal.can_save} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 font-bold text-accent-foreground disabled:opacity-45"><CheckCircle2 className="size-4" aria-hidden="true" />Save Level Up</button>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm leading-relaxed text-destructive">{error}</p>}
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Reminder:</strong> RPG Your Way can help organize advancement and update your character record, but your own rules/source material remains authoritative. AI assistance can miss or misunderstand a detail, so review the final changes before saving.</p>
      </section>
    </div>
  )
}
