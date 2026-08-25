import type { CharacterIntakeResult } from '@/lib/aigm/types'

/**
 * Character Edit is a review transaction, not a return to Character Intake.
 * Intake-only clarification questions must therefore survive unchanged.
 * Edit-only questions live in CharacterEditProposal.blocking_questions instead.
 */
export function mergeCharacterEditProposalBoundary(
  currentResult: CharacterIntakeResult,
  proposedResult: CharacterIntakeResult,
): CharacterIntakeResult {
  return {
    ...proposedResult,
    document_assessment: currentResult.document_assessment,
    assistant_message: currentResult.assistant_message,
    confidence: currentResult.confidence,
    intake_settings: currentResult.intake_settings,
    opening_state: currentResult.opening_state,
    applied_assumptions: currentResult.applied_assumptions,
    clarification_questions: currentResult.clarification_questions.map((question) => ({ ...question })),
    character: {
      ...proposedResult.character,
      is_current_party_active_leader: currentResult.character.is_current_party_active_leader === true,
    },
  }
}


function isKnownLegacyCharacterEditQuestion(question: CharacterIntakeResult['clarification_questions'][number]) {
  if (question.priority !== 'required') return false
  const prompt = `${question.question} ${question.reason}`.replace(/\s+/g, ' ').trim()
  const genericEditQuestion = /\b(?:which|what|please provide)\b.{0,120}\b(?:missing|specific)\b.{0,120}\b(?:rule|rules|feature|item|spell|mechanic|detail|details|subclass)\b/i.test(prompt)
  const editReason = /\b(?:the request|requested feature|character-specific source text|saved source text|saved-source|record already|already contains|already includes|editable sources?)\b/i.test(prompt)
  return genericEditQuestion && editReason
}

/**
 * Build 4.11.31 briefly allowed Character Edit review questions to leak into the
 * Character Intake clarification list. In an already-running campaign those
 * questions are edit scaffolding, not unfinished intake. Remove only the known
 * leak signature so an old exported campaign can recover its ready roster.
 */
export function repairLegacyCharacterEditClarificationLeak(result: CharacterIntakeResult): CharacterIntakeResult {
  const clarificationQuestions = result.clarification_questions.filter((question) => !isKnownLegacyCharacterEditQuestion(question))
  if (clarificationQuestions.length === result.clarification_questions.length) return result
  return { ...result, clarification_questions: clarificationQuestions }
}
