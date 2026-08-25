export const OWNER_QA_EMAIL = 'brett@rpgyourway.com' as const

export function isOwnerQaEmail(email: string | null | undefined) {
  return (email || '').trim().toLocaleLowerCase('en-US') === OWNER_QA_EMAIL
}
