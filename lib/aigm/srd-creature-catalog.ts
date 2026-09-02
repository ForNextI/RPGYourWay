import 'server-only'
import fs from 'node:fs'
import path from 'node:path'

type CreatureRow = { name: string; cr: string; habitat?: string[] }
type HumanoidProfile = { name: string; cr: string; hp: number; npc_use: string[]; incidental_npc: string }
type Catalog = {
  _meta: { creature_count: number; humanoid_count: number; srd_version: string }
  creatures_by_type: Record<string, CreatureRow[]>
  humanoid_npc_profiles: HumanoidProfile[]
}

let cache: Catalog | null = null
function catalog() {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'rules', 'rpgyw-srd-5.2.1-creature-catalog.json'), 'utf8')) as Catalog
  return cache
}

export function formatSrdCreatureCatalogForAigm(rulesetId: string, include: boolean) {
  if (!include || rulesetId !== 'dnd-5.5e-srd-5.2.1') return ''
  const value = catalog()
  const sections = Object.entries(value.creatures_by_type).map(([type, rows]) => (
    `${type}: ${rows.map((row) => `${row.name} [CR ${row.cr}; ${(row.habitat?.length ? row.habitat.join('/') : 'special/any')} ]`).join('; ')}`
  ))
  const humanoids = value.humanoid_npc_profiles.map((row) => (
    `${row.name} [CR ${row.cr}; HP ${row.hp}; ${row.incidental_npc}; uses: ${row.npc_use.join(', ')}]`
  )).join('; ')
  return [
    `SRD 5.2.1 FOUNDRY ACTOR SELECTION CATALOG (${value._meta.creature_count} creatures).`,
    'Use exact names from this catalog in vtt_setup.actors[].srd_template when an appropriate SRD creature or humanoid stat block exists. The catalog is for selection; Foundry supplies the full native Actor mechanics.',
    ...sections,
    `Humanoid NPC profiles: ${humanoids}`,
  ].join('\n').slice(0, 28000)
}
