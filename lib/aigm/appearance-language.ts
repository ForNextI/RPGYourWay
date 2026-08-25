/**
 * The private NPC generation batch uses broad appearance families to keep the
 * population varied. This final guard prevents those internal category labels
 * from escaping into ordinary prose if a model ignores the narrative rule.
 */
export function naturalizeRawHumanAppearanceLabels(value: string) {
  return value.replace(
    /\b(?:(a|an|the)\s+)?(white|black|brown|asian)\s+(human\s+)?(woman|man|person|girl|boy|women|men|people|girls|boys)\b/giu,
    (_match, article: string | undefined, category: string, human: string | undefined, person: string) => {
      const capitalized = article ? article[0] === article[0]?.toLocaleUpperCase() : false
      const prefix = !article
        ? ''
        : article.toLocaleLowerCase() === 'the'
          ? (capitalized ? 'The ' : 'the ')
          : (capitalized ? 'A ' : 'a ')
      const humanWord = human ? 'human ' : ''
      const normalized = category.toLocaleLowerCase()
      if (normalized === 'white') return `${prefix}fair-skinned ${humanWord}${person}`
      if (normalized === 'black') return `${prefix}dark-brown-skinned ${humanWord}${person}`
      if (normalized === 'brown') return `${prefix}medium-brown-skinned ${humanWord}${person}`
      return `${prefix}light-brown-skinned ${humanWord}${person}`
    },
  )
}
