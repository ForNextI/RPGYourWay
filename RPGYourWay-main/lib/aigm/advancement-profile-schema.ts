export const ADVANCEMENT_PROFILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    class_name: { type: 'string' },
    ruleset: { type: 'string' },
    source_name: { type: 'string' },
    profile_kind: { type: 'string', enum: ['class', 'subclass'] },
    subclass_name: { type: 'string' },
    hit_point_die: { type: 'integer', minimum: 0, maximum: 100 },
    levels: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          level: { type: 'integer', minimum: 1, maximum: 20 },
          proficiency_bonus: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          feature_details: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                text: { type: 'string' },
              },
              required: ['name', 'text'],
            },
          },
          progression_values: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                value: { type: 'string' },
              },
              required: ['name', 'value'],
            },
          },
          spell_slots: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                level: { type: 'string' },
                total: { type: 'string' },
              },
              required: ['level', 'total'],
            },
          },
        },
        required: ['level', 'proficiency_bonus', 'features', 'feature_details', 'progression_values', 'spell_slots'],
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'class_name', 'ruleset', 'source_name', 'profile_kind', 'subclass_name', 'hit_point_die', 'levels', 'warnings'],
} as const
