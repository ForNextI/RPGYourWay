'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function safeReturnTo(formData: FormData) {
  const raw = requiredText(formData, 'returnTo')
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/account'
  return raw
}

function redirectWithQuery(pathname: string, key: string, value: string) {
  const url = new URL(pathname, 'https://rpgyourway.local')
  url.searchParams.set(key, value)
  redirect(`${url.pathname}${url.search}${url.hash}`)
}

function redirectError(returnTo: string, message: string) {
  if (returnTo === '/account') redirectWithQuery(returnTo, 'error', message)
  redirectWithQuery(returnTo, 'authError', message)
}

export async function signIn(formData: FormData) {
  const email = requiredText(formData, 'email')
  const password = requiredText(formData, 'password')
  const returnTo = safeReturnTo(formData)

  if (!email || !password) redirectError(returnTo, 'Enter your email and password.')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) redirectError(returnTo, error.message)
  if (returnTo === '/account') redirectWithQuery(returnTo, 'status', 'signed-in')
  redirect(returnTo)
}

export async function signUp(formData: FormData) {
  const email = requiredText(formData, 'email')
  const confirmEmail = requiredText(formData, 'confirmEmail')
  const password = requiredText(formData, 'password')
  const returnTo = safeReturnTo(formData)

  if (!email || !confirmEmail || !password) redirectError(returnTo, 'Enter your email twice and choose a password.')
  if (email.toLowerCase() !== confirmEmail.toLowerCase()) redirectError(returnTo, 'Those email addresses do not match.')
  if (password.length < 8) redirectError(returnTo, 'Use at least 8 characters for your password.')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) redirectError(returnTo, error.message)

  if (data.session) {
    if (returnTo === '/account') redirectWithQuery(returnTo, 'status', 'created')
    redirect(returnTo)
  }

  if (returnTo === '/account') redirectWithQuery(returnTo, 'status', 'check-email')
  redirectWithQuery(returnTo, 'authStatus', 'check-email')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirectWithQuery('/account', 'status', 'signed-out')
}
