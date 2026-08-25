import { randomInt } from 'node:crypto'

export type NpcSexDefault = 'female' | 'male'
export type NpcSpeciesDefault = 'human' | 'nonhuman'
export type HumanAppearanceDefault =
  | 'fair_or_pale_complexion'
  | 'deep_or_dark_brown_complexion'
  | 'olive_or_brown_complexion'
  | 'shou_or_setting_equivalent'

export interface NpcGenerationDefault {
  sex: NpcSexDefault
  species: NpcSpeciesDefault
  human_appearance: HumanAppearanceDefault | ''
}

function shuffled<T>(values: readonly T[]) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    const value = copy[index]
    copy[index] = copy[swapIndex]
    copy[swapIndex] = value
  }
  return copy
}

/**
 * Returns one randomized ten-person batch with the RPG Your Way defaults built
 * into the data itself: six female, four male; four human, six nonhuman; and
 * one human of each broad appearance category. The GM consumes rows in order.
 */
export function npcGenerationDefaults(): NpcGenerationDefault[] {
  const sexes = shuffled<NpcSexDefault>([
    'female', 'female', 'female', 'female', 'female', 'female',
    'male', 'male', 'male', 'male',
  ])
  const species = shuffled<Array<{ species: NpcSpeciesDefault; human_appearance: HumanAppearanceDefault | '' }>[number]>([
    { species: 'human', human_appearance: 'fair_or_pale_complexion' },
    { species: 'human', human_appearance: 'deep_or_dark_brown_complexion' },
    { species: 'human', human_appearance: 'olive_or_brown_complexion' },
    { species: 'human', human_appearance: 'shou_or_setting_equivalent' },
    { species: 'nonhuman', human_appearance: '' },
    { species: 'nonhuman', human_appearance: '' },
    { species: 'nonhuman', human_appearance: '' },
    { species: 'nonhuman', human_appearance: '' },
    { species: 'nonhuman', human_appearance: '' },
    { species: 'nonhuman', human_appearance: '' },
  ])

  return species.map((entry, index) => ({ ...entry, sex: sexes[index] }))
}
