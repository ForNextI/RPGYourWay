# RPG Your Way 1.6.100 build fix

This overlay restores the TypeScript narrowing fix that was present in the corrected 1.6.000 Shape narrative-disposition build but was accidentally omitted when 1.6.100 was assembled.

It changes only `app/api/shape/transform/route.ts`:

- imports `ShapeWritingDisposition` as a type from `lib/shape/transcript`
- explicitly types `parseRolling()` so `section_disposition` remains the literal union `'prose' | 'no_new_prose'` instead of widening to `string`

No runtime behavior, database schema, Stripe behavior, or public version changes are intended.
