import type { CharacterClassEntry } from '@/lib/aigm/types'

export type AbilityKey = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma'
export type SpellcastingContribution = 'full' | 'half_up' | 'pact' | 'none'

export interface Dnd55ClassMetadata {
  name: string
  hitDie: number
  primaryAbilityGroups: AbilityKey[][]
  multiclassAutomaticTraits: string[]
  multiclassChoicePrompts: Array<{ id: string; label: string; help: string; options: string[] }>
  spellcasting: SpellcastingContribution
  featureNamesByLevel: Record<number, string[]>
  builtInSubclass?: { name: string; featureNamesByLevel: Record<number, string[]> }
}

const SKILLS = {
  bard: ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'],
  ranger: ['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival'],
  rogue: ['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Persuasion','Sleight of Hand','Stealth'],
} as const

export const DND55_CLASS_METADATA: readonly Dnd55ClassMetadata[] = [
  { name:'Barbarian', hitDie:12, primaryAbilityGroups:[['strength']], multiclassAutomaticTraits:['Hit Point Die d12','Martial weapon proficiency','Shield training'], multiclassChoicePrompts:[], spellcasting:'none', featureNamesByLevel:{1:['Rage','Unarmored Defense','Weapon Mastery'],2:['Danger Sense','Reckless Attack'],3:['Barbarian Subclass','Primal Knowledge'],4:['Ability Score Improvement'],5:['Extra Attack','Fast Movement'],7:['Feral Instinct','Instinctive Pounce'],9:['Brutal Strike'],11:['Relentless Rage'],13:['Improved Brutal Strike'],15:['Persistent Rage'],17:['Improved Brutal Strike'],18:['Indomitable Might'],19:['Epic Boon'],20:['Primal Champion']}, builtInSubclass:{name:'Path of the Berserker',featureNamesByLevel:{3:['Frenzy'],6:['Mindless Rage'],10:['Retaliation'],14:['Intimidating Presence']}} },
  { name:'Bard', hitDie:8, primaryAbilityGroups:[['charisma']], multiclassAutomaticTraits:['Hit Point Die d8','Light armor training'], multiclassChoicePrompts:[{id:'multiclass-bard-skill',label:'Bard multiclass skill proficiency',help:'Choose one skill proficiency.',options:[...SKILLS.bard]},{id:'multiclass-bard-instrument',label:'Bard multiclass Musical Instrument proficiency',help:'Enter one Musical Instrument proficiency from your source material.',options:[]}], spellcasting:'full', featureNamesByLevel:{1:['Bardic Inspiration','Spellcasting'],2:['Expertise','Jack of All Trades'],3:['Bard Subclass'],4:['Ability Score Improvement'],5:['Font of Inspiration'],7:['Countercharm'],10:['Magical Secrets'],18:['Superior Inspiration'],19:['Epic Boon'],20:['Words of Creation']}, builtInSubclass:{name:'College of Lore',featureNamesByLevel:{3:['Bonus Proficiencies','Cutting Words'],6:['Magical Discoveries'],14:['Peerless Skill']}} },
  { name:'Cleric', hitDie:8, primaryAbilityGroups:[['wisdom']], multiclassAutomaticTraits:['Hit Point Die d8','Light armor training','Medium armor training','Shield training'], multiclassChoicePrompts:[], spellcasting:'full', featureNamesByLevel:{1:['Spellcasting','Divine Order'],2:['Channel Divinity'],3:['Cleric Subclass'],4:['Ability Score Improvement'],5:['Sear Undead'],7:['Blessed Strikes'],10:['Divine Intervention'],14:['Improved Blessed Strikes'],19:['Epic Boon'],20:['Greater Divine Intervention']}, builtInSubclass:{name:'Life Domain',featureNamesByLevel:{3:['Disciple of Life','Life Domain Spells','Preserve Life'],6:['Blessed Healer'],17:['Supreme Healing']}} },
  { name:'Druid', hitDie:8, primaryAbilityGroups:[['wisdom']], multiclassAutomaticTraits:['Hit Point Die d8','Light armor training','Shield training'], multiclassChoicePrompts:[], spellcasting:'full', featureNamesByLevel:{1:['Spellcasting','Druidic','Primal Order'],2:['Wild Shape','Wild Companion'],3:['Druid Subclass'],4:['Ability Score Improvement'],5:['Wild Resurgence'],7:['Elemental Fury'],15:['Improved Elemental Fury'],18:['Beast Spells'],19:['Epic Boon'],20:['Archdruid']}, builtInSubclass:{name:'Circle of the Land',featureNamesByLevel:{3:['Circle of the Land Spells','Land’s Aid'],6:['Natural Recovery'],10:['Nature’s Ward'],14:['Nature’s Sanctuary']}} },
  { name:'Fighter', hitDie:10, primaryAbilityGroups:[['strength'],['dexterity']], multiclassAutomaticTraits:['Hit Point Die d10','Martial weapon proficiency','Light armor training','Medium armor training','Shield training'], multiclassChoicePrompts:[], spellcasting:'none', featureNamesByLevel:{1:['Fighting Style','Second Wind','Weapon Mastery'],2:['Action Surge','Tactical Mind'],3:['Fighter Subclass'],4:['Ability Score Improvement'],5:['Extra Attack','Tactical Shift'],9:['Indomitable','Tactical Master'],11:['Two Extra Attacks'],13:['Studied Attacks'],19:['Epic Boon'],20:['Three Extra Attacks']}, builtInSubclass:{name:'Champion',featureNamesByLevel:{3:['Improved Critical','Remarkable Athlete'],7:['Additional Fighting Style'],10:['Heroic Warrior'],15:['Superior Critical'],18:['Survivor']}} },
  { name:'Monk', hitDie:8, primaryAbilityGroups:[['dexterity','wisdom']], multiclassAutomaticTraits:['Hit Point Die d8'], multiclassChoicePrompts:[], spellcasting:'none', featureNamesByLevel:{1:['Martial Arts','Unarmored Defense'],2:['Monk’s Focus','Unarmored Movement','Uncanny Metabolism'],3:['Deflect Attacks','Monk Subclass'],4:['Ability Score Improvement','Slow Fall'],5:['Extra Attack','Stunning Strike'],6:['Empowered Strikes'],7:['Evasion'],9:['Acrobatic Movement'],10:['Heightened Focus','Self-Restoration'],13:['Deflect Energy'],14:['Disciplined Survivor'],15:['Perfect Focus'],18:['Superior Defense'],19:['Epic Boon'],20:['Body and Mind']}, builtInSubclass:{name:'Warrior of the Open Hand',featureNamesByLevel:{3:['Open Hand Technique'],6:['Wholeness of Body'],11:['Fleet Step'],17:['Quivering Palm']}} },
  { name:'Paladin', hitDie:10, primaryAbilityGroups:[['strength','charisma']], multiclassAutomaticTraits:['Hit Point Die d10','Martial weapon proficiency','Light armor training','Medium armor training','Shield training'], multiclassChoicePrompts:[], spellcasting:'half_up', featureNamesByLevel:{1:['Lay On Hands','Spellcasting','Weapon Mastery'],2:['Fighting Style','Paladin’s Smite'],3:['Channel Divinity','Paladin Subclass'],4:['Ability Score Improvement'],5:['Extra Attack','Faithful Steed'],6:['Aura of Protection'],9:['Abjure Foes'],10:['Aura of Courage'],11:['Radiant Strikes'],14:['Restoring Touch'],18:['Aura Expansion'],19:['Epic Boon']}, builtInSubclass:{name:'Oath of Devotion',featureNamesByLevel:{3:['Oath of Devotion Spells','Sacred Weapon'],7:['Aura of Devotion'],15:['Smite of Protection'],20:['Holy Nimbus']}} },
  { name:'Ranger', hitDie:10, primaryAbilityGroups:[['dexterity','wisdom']], multiclassAutomaticTraits:['Hit Point Die d10','Martial weapon proficiency','Light armor training','Medium armor training','Shield training'], multiclassChoicePrompts:[{id:'multiclass-ranger-skill',label:'Ranger multiclass skill proficiency',help:'Choose one skill from the Ranger skill list.',options:[...SKILLS.ranger]}], spellcasting:'half_up', featureNamesByLevel:{1:['Spellcasting','Favored Enemy','Weapon Mastery'],2:['Deft Explorer','Fighting Style'],3:['Ranger Subclass'],4:['Ability Score Improvement'],5:['Extra Attack'],6:['Roving'],9:['Expertise'],10:['Tireless'],13:['Relentless Hunter'],14:['Nature’s Veil'],17:['Precise Hunter'],18:['Feral Senses'],19:['Epic Boon'],20:['Foe Slayer']}, builtInSubclass:{name:'Hunter',featureNamesByLevel:{3:['Hunter’s Lore','Hunter’s Prey'],7:['Defensive Tactics'],11:['Superior Hunter’s Prey'],15:['Superior Hunter’s Defense']}} },
  { name:'Rogue', hitDie:8, primaryAbilityGroups:[['dexterity']], multiclassAutomaticTraits:['Hit Point Die d8','Thieves’ Tools proficiency','Light armor training'], multiclassChoicePrompts:[{id:'multiclass-rogue-skill',label:'Rogue multiclass skill proficiency',help:'Choose one skill from the Rogue skill list.',options:[...SKILLS.rogue]}], spellcasting:'none', featureNamesByLevel:{1:['Expertise','Sneak Attack','Thieves’ Cant','Weapon Mastery'],2:['Cunning Action'],3:['Rogue Subclass','Steady Aim'],4:['Ability Score Improvement'],5:['Cunning Strike','Uncanny Dodge'],7:['Evasion','Reliable Talent'],11:['Improved Cunning Strike'],14:['Devious Strikes'],15:['Slippery Mind'],18:['Elusive'],19:['Epic Boon'],20:['Stroke of Luck']}, builtInSubclass:{name:'Thief',featureNamesByLevel:{3:['Fast Hands','Second-Story Work'],9:['Supreme Sneak'],13:['Use Magic Device'],17:['Thief’s Reflexes']}} },
  { name:'Sorcerer', hitDie:6, primaryAbilityGroups:[['charisma']], multiclassAutomaticTraits:['Hit Point Die d6'], multiclassChoicePrompts:[], spellcasting:'full', featureNamesByLevel:{1:['Spellcasting','Innate Sorcery'],2:['Font of Magic','Metamagic'],3:['Sorcerer Subclass'],4:['Ability Score Improvement'],5:['Sorcerous Restoration'],7:['Sorcery Incarnate'],19:['Epic Boon'],20:['Arcane Apotheosis']}, builtInSubclass:{name:'Draconic Sorcery',featureNamesByLevel:{3:['Draconic Resilience','Draconic Spells'],6:['Elemental Affinity'],14:['Dragon Wings'],18:['Dragon Companion']}} },
  { name:'Warlock', hitDie:8, primaryAbilityGroups:[['charisma']], multiclassAutomaticTraits:['Hit Point Die d8','Light armor training'], multiclassChoicePrompts:[], spellcasting:'pact', featureNamesByLevel:{1:['Eldritch Invocations','Pact Magic'],2:['Magical Cunning'],3:['Warlock Subclass'],4:['Ability Score Improvement'],9:['Contact Patron'],11:['Mystic Arcanum'],19:['Epic Boon'],20:['Eldritch Master']}, builtInSubclass:{name:'Fiend Patron',featureNamesByLevel:{3:['Dark One’s Blessing','Fiend Spells'],6:['Dark One’s Own Luck'],10:['Fiendish Resilience'],14:['Hurl Through Hell']}} },
  { name:'Wizard', hitDie:6, primaryAbilityGroups:[['intelligence']], multiclassAutomaticTraits:['Hit Point Die d6'], multiclassChoicePrompts:[], spellcasting:'full', featureNamesByLevel:{1:['Spellcasting','Ritual Adept','Arcane Recovery'],2:['Scholar'],3:['Wizard Subclass'],4:['Ability Score Improvement'],5:['Memorize Spell'],18:['Spell Mastery'],19:['Epic Boon'],20:['Signature Spells']}, builtInSubclass:{name:'Evoker',featureNamesByLevel:{3:['Evocation Savant','Potent Cantrip'],6:['Sculpt Spells'],10:['Empowered Evocation'],14:['Overchannel']}} },
] as const

export function dnd55ClassMetadata(name: string) {
  const key = name.trim().toLocaleLowerCase('en-US')
  return DND55_CLASS_METADATA.find((entry) => entry.name.toLocaleLowerCase('en-US') === key) ?? null
}

export function dnd55ClassFeatureNamesThroughLevel(className: string, level: number) {
  const metadata = dnd55ClassMetadata(className)
  if (!metadata) return []
  return Object.entries(metadata.featureNamesByLevel).flatMap(([at, names]) => Number(at) <= level ? names : [])
}

export function dnd55SubclassFeatureNamesThroughLevel(className: string, subclassName: string, level: number) {
  const metadata = dnd55ClassMetadata(className)
  if (!metadata?.builtInSubclass || metadata.builtInSubclass.name.toLocaleLowerCase('en-US') !== subclassName.trim().toLocaleLowerCase('en-US')) return []
  return Object.entries(metadata.builtInSubclass.featureNamesByLevel).flatMap(([at, names]) => Number(at) <= level ? names : [])
}

export function dnd55PrerequisiteFailures(
  currentClasses: CharacterClassEntry[],
  newClassName: string,
  abilityScores: Record<AbilityKey, number>,
) {
  const names = Array.from(new Set([...currentClasses.map((entry) => entry.name), newClassName]))
  return names.flatMap((name) => {
    const metadata = dnd55ClassMetadata(name)
    if (!metadata) return []
    const qualifies = metadata.primaryAbilityGroups.some((group) => group.every((ability) => Number(abilityScores[ability] ?? 0) >= 13))
    if (qualifies) return []
    const alternatives = metadata.primaryAbilityGroups.map((group) => group.map((ability) => ability.slice(0, 3).toUpperCase()).join(' and ')).join(' or ')
    return [`${name} requires ${alternatives} 13 or higher.`]
  })
}


export function dnd55UnverifiedPrerequisiteClasses(currentClasses: CharacterClassEntry[], newClassName: string) {
  return Array.from(new Set([...currentClasses.map((entry) => entry.name), newClassName])).filter((name) => !dnd55ClassMetadata(name))
}

const MULTICLASS_SLOTS: Record<number, number[]> = {
  1:[2],2:[3],3:[4,2],4:[4,3],5:[4,3,2],6:[4,3,3],7:[4,3,3,1],8:[4,3,3,2],9:[4,3,3,3,1],10:[4,3,3,3,2],
  11:[4,3,3,3,2,1],12:[4,3,3,3,2,1],13:[4,3,3,3,2,1,1],14:[4,3,3,3,2,1,1],15:[4,3,3,3,2,1,1,1],16:[4,3,3,3,2,1,1,1],
  17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1],
}

const WARLOCK_PACT_SLOTS: Record<number, { slots: number; slotLevel: number }> = {
  1:{slots:1,slotLevel:1},2:{slots:2,slotLevel:1},3:{slots:2,slotLevel:2},4:{slots:2,slotLevel:2},5:{slots:2,slotLevel:3},6:{slots:2,slotLevel:3},
  7:{slots:2,slotLevel:4},8:{slots:2,slotLevel:4},9:{slots:2,slotLevel:5},10:{slots:2,slotLevel:5},11:{slots:3,slotLevel:5},12:{slots:3,slotLevel:5},
  13:{slots:3,slotLevel:5},14:{slots:3,slotLevel:5},15:{slots:3,slotLevel:5},16:{slots:3,slotLevel:5},17:{slots:4,slotLevel:5},18:{slots:4,slotLevel:5},
  19:{slots:4,slotLevel:5},20:{slots:4,slotLevel:5},
}

export function dnd55UnknownClasses(classes: CharacterClassEntry[]) {
  return Array.from(new Set(classes.map((entry) => entry.name.replace(/\s+/g, ' ').trim()).filter((name) => name && !dnd55ClassMetadata(name))))
}

export function dnd55UnverifiedSpellSlotSources(classes: CharacterClassEntry[]) {
  const uncertain = [...dnd55UnknownClasses(classes)]
  for (const entry of classes) {
    const meta = dnd55ClassMetadata(entry.name)
    if (!meta || (meta.name !== 'Fighter' && meta.name !== 'Rogue')) continue
    const subclass = entry.subclass.replace(/\s+/g, ' ').trim()
    if (!subclass || meta.builtInSubclass?.name.toLocaleLowerCase('en-US') === subclass.toLocaleLowerCase('en-US')) continue
    uncertain.push(`${entry.name} (${subclass})`)
  }
  return Array.from(new Set(uncertain))
}

export function dnd55CanDeterministicallyCombineSpellSlots(classes: CharacterClassEntry[]) {
  return dnd55UnverifiedSpellSlotSources(classes).length === 0
}

export function dnd55CombinedSpellSlots(classes: CharacterClassEntry[]) {
  let casterLevel = 0
  let hasSpellcasting = false
  let warlockLevel = 0
  for (const entry of classes) {
    const meta = dnd55ClassMetadata(entry.name)
    if (!meta) continue
    if (meta.spellcasting === 'full') {
      casterLevel += entry.level
      hasSpellcasting = true
    } else if (meta.spellcasting === 'half_up') {
      casterLevel += Math.ceil(entry.level / 2)
      hasSpellcasting = true
    } else if (meta.spellcasting === 'pact') {
      warlockLevel += entry.level
    }
  }
  const rows: Array<{ level: string; total: string }> = []
  if (hasSpellcasting && casterLevel > 0) {
    const bounded = Math.max(1, Math.min(20, casterLevel))
    rows.push(...(MULTICLASS_SLOTS[bounded] ?? []).map((total, index) => ({ level: String(index + 1), total: String(total) })))
  }
  if (warlockLevel > 0) {
    const pact = WARLOCK_PACT_SLOTS[Math.max(1, Math.min(20, warlockLevel))]
    if (pact) rows.push({ level: `Pact Magic · ${pact.slotLevel}`, total: String(pact.slots) })
  }
  return rows
}

/** Backward-named helper retained for validators and callers that only need shared Spellcasting slots. */
export function dnd55MulticlassSpellSlots(classes: CharacterClassEntry[]) {
  const castingClasses = classes.filter((entry) => {
    const meta = dnd55ClassMetadata(entry.name)
    return meta?.spellcasting === 'full' || meta?.spellcasting === 'half_up'
  })
  if (castingClasses.length < 2) return null
  return dnd55CombinedSpellSlots(classes).filter((row) => !row.level.startsWith('Pact Magic'))
}

export function proficiencyBonusForTotalLevel(level: number) {
  return `+${2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4)}`
}
