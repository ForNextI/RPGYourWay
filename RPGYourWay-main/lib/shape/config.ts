export const DEFAULT_SHAPE_MODEL = 'gpt-5.6-terra'
export const SHAPE_PROMPT_VERSION = 'ProseMaker v5.2.0 · RPG Your Way'

export function selectedShapeModel() {
  return process.env.OPENAI_SHAPE_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || DEFAULT_SHAPE_MODEL
}
