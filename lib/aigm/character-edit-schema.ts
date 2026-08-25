import { CHARACTER_INTAKE_SCHEMA } from '@/lib/aigm/character-intake-schema'

const stringArray = {
  type: 'array',
  items: { type: 'string' },
} as const

export const CHARACTER_EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assistant_message: {
      type: 'string',
      description: 'A concise explanation of what was understood and whether the proposed record is ready to save.',
    },
    can_save: { type: 'boolean' },
    change_summary: stringArray,
    duplicate_warnings: stringArray,
    blocking_questions: stringArray,
    proposed_play_name: { type: 'string' },
    proposed_result: CHARACTER_INTAKE_SCHEMA,
  },
  required: [
    'assistant_message',
    'can_save',
    'change_summary',
    'duplicate_warnings',
    'blocking_questions',
    'proposed_play_name',
    'proposed_result',
  ],
} as const
