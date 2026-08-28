export function shapeBetaEmails() {
  return (process.env.RPGYW_SHAPE_BETA_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function shapeAccessConfigured() {
  return shapeBetaEmails().length > 0
}

export function shapeEmailAllowed(email: string | null | undefined) {
  if (!email) return false
  const allowed = shapeBetaEmails()
  if (allowed.length === 0) return process.env.NODE_ENV !== 'production'
  return allowed.includes(email.trim().toLowerCase())
}
