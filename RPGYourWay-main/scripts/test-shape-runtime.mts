import {
  SHAPE_MAX_ANALYSIS_CHUNKS,
  SHAPE_MAX_CHUNKS,
  SHAPE_MAX_INPUT_CHARACTERS,
  SHAPE_PROVISIONAL_PROSE_CHARACTERS,
  SHAPE_SINGLE_PASS_CHARACTERS,
  assessShapeTranscript,
  buildShapeAnalysisChunks,
  buildShapeRecoverySubchunks,
  buildShapeTranscriptChunks,
  extractWardensCampaignTranscript,
  normalizeShapeTranscriptForFingerprint,
  provisionalProseTail,
  reconcileShapeWritingSection,
  replaceProvisionalProseTail,
} from '../lib/shape/transcript.ts'

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

requireCondition(SHAPE_SINGLE_PASS_CHARACTERS === 45_000, 'Shape must keep the 45,000-character single-pass lane.')
requireCondition(SHAPE_MAX_INPUT_CHARACTERS === 1_000_000, 'Shape must accept one million characters in one request.')
requireCondition(assessShapeTranscript(SHAPE_MAX_INPUT_CHARACTERS).ready, 'The public hard limit must be accepted.')
requireCondition(!assessShapeTranscript(SHAPE_MAX_INPUT_CHARACTERS + 1).ready, 'One character over the hard limit must be rejected.')
requireCondition(assessShapeTranscript(1_500_000).minimumParts === 2, 'A 1.5-million-character campaign must require at least two parts.')

const paragraph = 'The party entered the inn, ordered drinks, watched the room, and continued the adventure.\n\n'
const transcript = paragraph.repeat(Math.ceil(SHAPE_MAX_INPUT_CHARACTERS / paragraph.length)).slice(0, SHAPE_MAX_INPUT_CHARACTERS)
const chunks = buildShapeTranscriptChunks(transcript)
requireCondition(chunks.length > 1 && chunks.length <= SHAPE_MAX_CHUNKS, 'A maximum-size transcript must produce a bounded rolling writing job.')
requireCondition(chunks.map((chunk) => chunk.source).join('') === transcript, 'Rolling writing chunks must cover every source character exactly once.')
requireCondition(chunks[0].contextBefore === '', 'The first writing chunk must not invent preceding context.')
requireCondition(chunks.at(-1)?.contextAfter === '', 'The final writing chunk must not invent following context.')

const analysisChunks = buildShapeAnalysisChunks(transcript)
requireCondition(analysisChunks.length > 1 && analysisChunks.length <= SHAPE_MAX_ANALYSIS_CHUNKS, 'A maximum-size transcript must produce a bounded continuity pass.')
requireCondition(analysisChunks.join('') === transcript, 'Continuity chunks must cover every source character exactly once.')

const seamFixture = `${'Old material. '.repeat(800)}\n\n${[
  'Committed opening paragraph.',
  'A second committed paragraph that stays before the soft seam.',
  'This paragraph is deliberately provisional because the next source section may change how it should end.',
  'The final provisional paragraph continues directly into the next transcript section.',
].join('\n\n')}`
const provisionalTail = provisionalProseTail(seamFixture)
requireCondition(provisionalTail.length <= SHAPE_PROVISIONAL_PROSE_CHARACTERS, 'The provisional prose tail must stay inside its bounded seam window.')
const revisedTail = 'This paragraph is repaired after seeing both sides of the seam.\n\nThe transition now continues naturally into the next section.'
const reconciled = replaceProvisionalProseTail(seamFixture, provisionalTail, revisedTail)
requireCondition(reconciled.endsWith(revisedTail), 'Seam reconciliation must replace the exact provisional tail.')

const playerBoundaryFixture = [
  'A'.repeat(26_000),
  '\n\nPLAYER\nI look left.\n\nMALCOLM\nYou look left and see a closed door.',
  'B'.repeat(4_000),
  '\n\nPLAYER\nI open the door.\n\nMALCOLM\nThe door opens into a quiet room.',
  'C'.repeat(35_000),
].join('')
const playerBoundaryChunks = buildShapeTranscriptChunks(playerBoundaryFixture)
requireCondition(playerBoundaryChunks.length >= 2, 'The player-boundary fixture must create more than one writing section.')
requireCondition(playerBoundaryChunks[1].source.startsWith('PLAYER\n'), 'A WardensPC writing seam should prefer the start of a PLAYER turn near the target boundary.')
requireCondition(playerBoundaryChunks.map((chunk) => chunk.source).join('') === playerBoundaryFixture, 'PLAYER-boundary preference must preserve every source character exactly once.')


const unchangedSeam = reconcileShapeWritingSection(
  seamFixture,
  provisionalTail,
  '',
  'The next section begins without requiring any change to the already-written seam.',
)
requireCondition(unchangedSeam.includes(provisionalTail), 'An empty revised seam must preserve the already-checkpointed provisional prose tail.')
requireCondition(unchangedSeam.endsWith('The next section begins without requiring any change to the already-written seam.'), 'No-change seam recovery must still append the new prose.')

const administrativeOnly = reconcileShapeWritingSection(
  seamFixture,
  provisionalTail,
  '',
  '',
  'no_new_prose',
)
requireCondition(administrativeOnly === replaceProvisionalProseTail(seamFixture, provisionalTail, provisionalTail), 'A successfully processed administrative-only section must preserve existing prose and advance without inventing new prose.')

const administrativeCorrectionTail = 'This provisional ending is corrected by later administrative canon without adding a new scene.'
const administrativeCorrection = reconcileShapeWritingSection(
  seamFixture,
  provisionalTail,
  administrativeCorrectionTail,
  '',
  'no_new_prose',
)
requireCondition(administrativeCorrection.endsWith(administrativeCorrectionTail), 'A no-new-prose section may still repair the provisional seam when the source contains a retroactive correction.')

const emptyFirstAdministrativeSection = reconcileShapeWritingSection('', '', '', '', 'no_new_prose')
requireCondition(emptyFirstAdministrativeSection === '', 'An administrative-only first section must be allowed to checkpoint without manufacturing prose.')

let rejectedEmptyDeclaredProse = false
try {
  reconcileShapeWritingSection(seamFixture, provisionalTail, '', '', 'prose')
} catch (error) {
  rejectedEmptyDeclaredProse = error instanceof Error && error.message.includes('declared prose')
}
requireCondition(rejectedEmptyDeclaredProse, 'A response that declares prose but returns empty new_prose must still fail validation.')

let rejectedContradictoryNoProse = false
try {
  reconcileShapeWritingSection(seamFixture, provisionalTail, '', 'Unexpected prose.', 'no_new_prose')
} catch (error) {
  rejectedContradictoryNoProse = error instanceof Error && error.message.includes('declared no_new_prose')
}
requireCondition(rejectedContradictoryNoProse, 'A no_new_prose response must not carry contradictory new prose.')

const troublesomeSource = [
  'PLAYER\nI correct what happened earlier.\n\nGAME MASTER\nUnderstood; the earlier description is superseded.\n\n',
  'A'.repeat(11_000),
  '\n\nPLAYER\nActually, that correction begins from the previous scene.\n\nGAME MASTER\nLocked in.\n\n',
  'B'.repeat(11_000),
  '\n\nPLAYER\nWe move on.\n\nGAME MASTER\nThe next event begins.\n\n',
  'C'.repeat(10_000),
].join('')
const recoverySubchunks = buildShapeRecoverySubchunks(troublesomeSource)
requireCondition(recoverySubchunks.length >= 2, 'A troublesome full writing section must be divisible into smaller recovery subsections.')
requireCondition(recoverySubchunks.join('') === troublesomeSource, 'Recovery subsections must preserve every source character exactly once.')
requireCondition(recoverySubchunks.every((part) => part.length <= 16_000), 'Recovery subsections must stay materially smaller than a normal writing section.')

const campaignJson = JSON.stringify({
  storage_schema: 2,
  adventure_name: 'Test Adventure',
  game_master_name: 'Malcolm',
  gameplay: { transcript: [
    { role: 'assistant', text: 'The door opens.' },
    { role: 'user', text: 'I go inside.' },
    { role: 'assistant', text: 'You enter the room.' },
  ] },
})
const extracted = extractWardensCampaignTranscript(campaignJson)
requireCondition(extracted?.title === 'Test Adventure', 'WardensPC JSON extraction must preserve the campaign title.')
requireCondition(extracted?.transcript.includes('MALCOLM\nThe door opens.'), 'WardensPC JSON extraction must label the Game Master.')
requireCondition(extracted?.transcript.includes('PLAYER\nI go inside.'), 'WardensPC JSON extraction must label player turns.')
requireCondition(extractWardensCampaignTranscript('{"hello":"world"}') === null, 'Arbitrary JSON must not be mistaken for a WardensPC campaign export.')

const windows = normalizeShapeTranscriptForFingerprint('One  \r\n\r\n\r\nTwo\t\r\n')
const unix = normalizeShapeTranscriptForFingerprint('One\n\nTwo\n')
requireCondition(windows === unix, 'Harmless line-ending and blank-line differences must normalize identically.')

console.log('RPG Your Way Shape runtime sanity checks passed: limits, chunk coverage, explicit no-new-prose handling, resilient seams, recovery subdivision, WardensPC import, and fingerprint normalization.')
