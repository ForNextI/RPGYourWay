'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function requiredText(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

function accountRedirect(key: 'error' | 'status', value: string): never {
  redirect(`/account?${key}=${encodeURIComponent(value)}`)
}

export async function signIn(formData: FormData) {
  const email = requiredText(formData, 'email')
  const password = requiredText(formData, 'password')

  if (!email || !password) accountRedirect('error', 'Enter your email and password.')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) accountRedirect('error', error.message)
  accountRedirect('status', 'signed-in')
}

export async function signUp(formData: FormData) {
  const email = requiredText(formData, 'email')
  const password = requiredText(formData, 'password')

  if (!email || !password) accountRedirect('error', 'Enter an email and password.')
  if (password.length < 8) accountRedirect('error', 'Use at least 8 characters for your password.')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) accountRedirect('error', error.message)
  accountRedirect('status', data.session ? 'created' : 'check-email')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  accountRedirect('status', 'signed-out')
}
